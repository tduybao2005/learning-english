# Blue-Green Deploy + Versioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép cập nhật app mà người dùng vẫn dùng được (fallback về bản cũ trong ~1 giây), đồng thời đánh version rõ ràng và có đường di cư database sang VPS.

## Context

Hôm nay app chạy `docker compose` với đúng **một** container `web`; muốn update thì phải `make restart` → user thấy lỗi. Không có version (package.json vẫn `0.1.0`, không git tag, không CHANGELOG), không có backup DB, và Cloudflare Tunnel trỏ thẳng vào `web:3000` nên không có chỗ nào để chuyển traffic.

Plan này chèn một **nginx proxy** giữa tunnel và app, nhân đôi service web thành `web_blue`/`web_green`, và biến release thành thao tác đổi upstream + reload. Bản cũ vẫn chạy sau khi release → đó chính là fallback; rollback là đổi ngược lại, không build gì.

**Giới hạn phải hiểu rõ:** hai màu **dùng chung một Postgres**. Blue-green chỉ an toàn khi migration **tương thích ngược** (chỉ thêm bảng/cột nullable/index). Migration phá vỡ tương thích (DROP/RENAME/SET NOT NULL) sẽ làm hỏng bản cũ ngay khi apply → plan này **chặn** loại đó bằng một script kiểm tra, buộc dùng quy trình expand/contract (release N thêm cột, release N+1 mới xoá). Người dùng đã chốt: **không làm cửa sổ bảo trì / banner** — blue-green làm nó thừa.

**Architecture:** nginx đọc `proxy_pass http://$active:3000;` với `$active` nằm trong một file config bind-mount từ host. Release = build image mới → bật màu rảnh → migrate → smoke test thẳng vào màu mới → ghi lại file → `nginx -s reload`. Màu cũ vẫn sống làm fallback.

**Tech Stack:** Docker Compose, nginx:alpine, Next.js 15 (`next start`), Prisma 6 + Postgres 16, Vitest 4, GNU Make, bash.

## Global Constraints

- Package manager: **npm**, chạy trong `web/`. Test: `npm test` (`dotenv -e .env.local -- vitest run`).
- Test co-located cạnh source. UI test opt-in jsdom bằng pragma `// @vitest-environment jsdom`.
- Vitest include: `src/**/*.test.ts(x)` và `scripts/**/*.test.ts` — script mới đặt trong `web/scripts/` sẽ tự được pick up.
- Commit theo conventional commits (`feat(deploy):`, `test:`, `docs:`). Làm thẳng trên `main`.
- UI copy tiếng Việt (task này gần như không có UI).
- Không đổi `db` service: giữ postgres:16-alpine, bind mount `/data/postgres` (user vừa đổi từ named volume sang bind mount — **giữ nguyên**, nó làm việc lên VPS dễ hơn).
- SemVer là nguồn sự thật ở `web/package.json` → image tag → git tag `v<x.y.z>` → `CHANGELOG.md`.

---

## File Structure

| File | Trách nhiệm |
|---|---|
| `web/src/app/api/health/route.ts` | Endpoint public trả `{status, version}` + ping DB. Dùng để smoke test màu mới trước khi chuyển traffic. |
| `web/scripts/deploy/check-migrations.ts` | Hàm thuần `findBreakingMigrations()` + CLI: chặn release nếu migration chưa apply có DROP/RENAME/SET NOT NULL. |
| `web/scripts/deploy/check-migrations.test.ts` | Test cho hàm thuần trên. |
| `deploy/nginx/nginx.conf` | Config nginx tĩnh (server block, `proxy_pass http://$active:3000`). |
| `deploy/nginx/active.conf` | **File trạng thái**: chỉ chứa `set $active web_blue;`. Bind-mount; release ghi đè file này rồi reload. |
| `deploy/nginx/maintenance.html` | Trang 503 tĩnh khi cả hai màu đều chết (an toàn, không phải feature bảo trì). |
| `scripts/deploy/lib.sh` | Hàm dùng chung: đọc `.env`, suy ra màu active/idle, `compose()` wrapper. |
| `scripts/deploy/release.sh` | Chuỗi release đầy đủ (9 bước). |
| `scripts/deploy/switch.sh` | Nguyên thuỷ: ghi `active.conf` + `nginx -s reload` + cập nhật `ACTIVE_COLOR` trong `.env`. |
| `scripts/deploy/rollback.sh` | Gọi `switch.sh` về màu cũ. |
| `scripts/deploy/smoke.sh` | Curl `/api/health` + vài route vào một màu cụ thể, qua container proxy. |
| `scripts/deploy/status.sh` | In màu active, tag mỗi màu, health của cả hai. |
| `scripts/deploy/backup.sh` / `restore.sh` | `pg_dump` gzip vào `backups/`, và restore từ dump. |
| `docker-compose.yml` | Sửa: `web` → `web_blue` + `web_green` (YAML anchor), thêm `proxy`, bỏ `ports` của web. |
| `Makefile` | Sửa các target đang hardcode `web`; thêm nhóm release/backup. |
| `CHANGELOG.md` | Keep a Changelog, mỗi release một mục. |
| `docs/deploy-vps.md` | Runbook: dựng VPS, di cư DB, đổi Cloudflare Tunnel sang `proxy`. |

---

### Task 1: Health endpoint + APP_VERSION

Không có endpoint này thì không thể smoke test màu mới **trước khi** đẩy user vào nó — đây là mảnh khoá của toàn bộ plan.

**Files:**
- Create: `web/src/app/api/health/route.ts`
- Test: `web/src/app/api/health/route.test.ts`
- Modify: `web/Dockerfile` (thêm `ARG APP_VERSION`)

**Interfaces:**
- Produces: `GET /api/health` → `200 {"status":"ok","version":"0.2.0"}` hoặc `503 {"status":"error","version":"..."}` nếu DB không phản hồi. Task 4 (`smoke.sh`) dựa vào status code này.

- [ ] **Step 1: Viết test fail trước**

`web/src/app/api/health/route.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ db: { $queryRaw: vi.fn() } }));

import { db } from "@/lib/db";
import { GET } from "./route";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_VERSION = "9.9.9";
  });

  it("trả 200 + version khi DB sống", async () => {
    vi.mocked(db.$queryRaw).mockResolvedValue([{ "?column?": 1 }]);
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "ok", version: "9.9.9" });
  });

  it("trả 503 khi DB chết — smoke test phải fail, không được switch traffic", async () => {
    vi.mocked(db.$queryRaw).mockRejectedValue(new Error("ECONNREFUSED"));
    const res = await GET();
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ status: "error" });
  });

  it("version là 'unknown' khi image không được build với APP_VERSION", async () => {
    delete process.env.APP_VERSION;
    vi.mocked(db.$queryRaw).mockResolvedValue([{ "?column?": 1 }]);
    await expect((await GET()).json()).resolves.toEqual({ status: "ok", version: "unknown" });
  });
});
```

- [ ] **Step 2: Chạy để xác nhận fail**

Run: `cd web && npx vitest run src/app/api/health/route.test.ts`
Expected: FAIL — `Failed to resolve import "./route"`.

- [ ] **Step 3: Implement**

`web/src/app/api/health/route.ts`:

```ts
import { db } from "@/lib/db";

// Public (middleware chỉ match /dashboard, /learn, /ielts, /listening,
// /settings, /onboarding — /api/health không bị chặn auth).
// force-dynamic: không được cache, nếu không smoke test sẽ đọc phải
// kết quả cũ của màu trước.
export const dynamic = "force-dynamic";

export async function GET() {
  const version = process.env.APP_VERSION ?? "unknown";
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", version });
  } catch {
    return Response.json({ status: "error", version }, { status: 503 });
  }
}
```

- [ ] **Step 4: Chạy lại — pass**

Run: `cd web && npx vitest run src/app/api/health/route.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Bake version vào image**

Trong `web/Dockerfile`, ở stage `builder` — ngay trước `RUN npm run build`:

```dockerfile
ARG APP_VERSION=unknown
ENV APP_VERSION=${APP_VERSION}
```

và ở stage `runner`, ngay sau `ENV NODE_ENV=production`:

```dockerfile
ARG APP_VERSION=unknown
ENV APP_VERSION=${APP_VERSION}
```

(Cần cả hai: `ARG` không xuyên qua stage.)

- [ ] **Step 6: Commit**

```bash
git add web/src/app/api/health web/Dockerfile
git commit -m "feat(deploy): add /api/health with baked APP_VERSION"
```

---

### Task 2: Chặn migration phá vỡ tương thích ngược

Đây là thứ giữ cho fallback có ý nghĩa. Nếu green apply `DROP COLUMN`, blue chết ngay → "fallback" chỉ là một trang lỗi.

**Files:**
- Create: `web/scripts/deploy/check-migrations.ts`
- Test: `web/scripts/deploy/check-migrations.test.ts`

**Interfaces:**
- Produces: `findBreakingMigrations(migrations: { name: string; sql: string }[], applied: string[]): string[]` — trả về tên các migration **chưa apply** có câu lệnh phá vỡ tương thích. CLI đọc danh sách đã apply từ stdin (mỗi dòng một tên), exit 1 nếu có. Task 4 (`release.sh`) gọi CLI này.

- [ ] **Step 1: Viết test fail trước**

`web/scripts/deploy/check-migrations.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { findBreakingMigrations } from "./check-migrations";

const applied = ["20260703083328_init"];

describe("findBreakingMigrations", () => {
  it("bỏ qua migration đã apply, dù nó có DROP", () => {
    const m = [{ name: "20260703083328_init", sql: "ALTER TABLE a DROP COLUMN b;" }];
    expect(findBreakingMigrations(m, applied)).toEqual([]);
  });

  it("cho qua migration chỉ thêm cột nullable", () => {
    const m = [{ name: "20260712_add_note", sql: `ALTER TABLE "User" ADD COLUMN "note" TEXT;` }];
    expect(findBreakingMigrations(m, applied)).toEqual([]);
  });

  it("cho qua CREATE TABLE / CREATE INDEX", () => {
    const m = [{ name: "20260712_new", sql: `CREATE TABLE "Note" (id TEXT);\nCREATE INDEX i ON "Note"(id);` }];
    expect(findBreakingMigrations(m, applied)).toEqual([]);
  });

  it("bắt DROP COLUMN", () => {
    const m = [{ name: "20260712_drop", sql: `ALTER TABLE "User" DROP COLUMN "otp";` }];
    expect(findBreakingMigrations(m, applied)).toEqual(["20260712_drop"]);
  });

  it("bắt DROP TABLE, RENAME, SET NOT NULL — không phân biệt hoa thường", () => {
    expect(findBreakingMigrations([{ name: "a", sql: "drop table x;" }], applied)).toEqual(["a"]);
    expect(findBreakingMigrations([{ name: "b", sql: `ALTER TABLE "x" RENAME TO "y";` }], applied)).toEqual(["b"]);
    expect(findBreakingMigrations([{ name: "c", sql: `ALTER TABLE "x" ALTER COLUMN "y" SET NOT NULL;` }], applied)).toEqual(["c"]);
  });

  it("bỏ qua khi tác giả khai báo @breaking-ok (đã lên kế hoạch downtime)", () => {
    const m = [{ name: "d", sql: `-- @breaking-ok: cột này không còn code nào đọc\nALTER TABLE "User" DROP COLUMN "otp";` }];
    expect(findBreakingMigrations(m, applied)).toEqual([]);
  });

  it("không bắt nhầm chữ 'drop' nằm trong tên cột/chuỗi", () => {
    const m = [{ name: "e", sql: `ALTER TABLE "User" ADD COLUMN "dropdown_pref" TEXT;` }];
    expect(findBreakingMigrations(m, applied)).toEqual([]);
  });
});
```

- [ ] **Step 2: Chạy để xác nhận fail**

Run: `cd web && npx vitest run scripts/deploy/check-migrations.test.ts`
Expected: FAIL — không resolve được `./check-migrations`.

- [ ] **Step 3: Implement**

`web/scripts/deploy/check-migrations.ts`:

```ts
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../prisma/migrations");

// Các câu lệnh làm schema mới KHÔNG còn tương thích với code của bản cũ
// đang chạy song song (blue). \b để "dropdown_pref" không bị bắt nhầm.
const BREAKING = [
  /\bDROP\s+TABLE\b/i,
  /\bDROP\s+COLUMN\b/i,
  /\bRENAME\s+(TO|COLUMN)\b/i,
  /\bSET\s+NOT\s+NULL\b/i,
  /\bDROP\s+TYPE\b/i,
];

const OPT_OUT = /--\s*@breaking-ok/i;

export function findBreakingMigrations(
  migrations: { name: string; sql: string }[],
  applied: string[],
): string[] {
  const appliedSet = new Set(applied);
  return migrations
    .filter((m) => !appliedSet.has(m.name))
    .filter((m) => !OPT_OUT.test(m.sql))
    .filter((m) => BREAKING.some((re) => re.test(m.sql)))
    .map((m) => m.name);
}

export function readMigrations(dir = MIGRATIONS_DIR) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({
      name: e.name,
      sql: readFileSync(path.join(dir, e.name, "migration.sql"), "utf8"),
    }));
}

// CLI: danh sách migration đã apply đọc từ stdin (mỗi dòng một tên).
//   docker compose exec -T db psql ... -tAc 'select migration_name from "_prisma_migrations"' \
//     | npx tsx scripts/deploy/check-migrations.ts
if (require.main === module) {
  const applied = readFileSync(0, "utf8").split("\n").map((s) => s.trim()).filter(Boolean);
  const breaking = findBreakingMigrations(readMigrations(), applied);
  if (breaking.length > 0) {
    console.error("Migration phá vỡ tương thích ngược — KHÔNG thể blue-green:");
    for (const name of breaking) console.error(`  - ${name}`);
    console.error(
      "\nBản cũ (fallback) sẽ vỡ ngay khi migration này chạy.\n" +
        "Hãy tách theo expand/contract: release này chỉ THÊM, release sau mới XOÁ.\n" +
        "Nếu đã chắc chắn không còn code nào đọc, thêm dòng `-- @breaking-ok: <lý do>`\n" +
        "vào đầu migration.sql và chấp nhận downtime ngắn.",
    );
    process.exit(1);
  }
  console.log("Tất cả migration chưa apply đều tương thích ngược.");
}
```

- [ ] **Step 4: Chạy lại — pass**

Run: `cd web && npx vitest run scripts/deploy/check-migrations.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Chạy thử CLI trên repo thật**

Run: `cd web && echo "" | npx tsx scripts/deploy/check-migrations.ts; echo "exit=$?"`
Expected: exit=1, liệt kê `20260709034036_drop_otp_code` (migration này có DROP COLUMN thật). Đây là bằng chứng script hoạt động — nó đang cảnh báo đúng.

- [ ] **Step 6: Commit**

```bash
git add web/scripts/deploy
git commit -m "feat(deploy): reject backward-incompatible migrations before blue-green release"
```

---

### Task 3: nginx proxy + hai màu web trong compose

**Files:**
- Create: `deploy/nginx/nginx.conf`, `deploy/nginx/active.conf`, `deploy/nginx/maintenance.html`
- Modify: `docker-compose.yml`, `.env.example`

**Interfaces:**
- Produces: service `proxy` nghe port 80 trong network, publish ra `${WEB_PORT:-3000}` trên host. Services `web_blue` / `web_green` chạy image `learning-english-web:${BLUE_TAG}` / `${GREEN_TAG}`. `.env` giữ 3 biến trạng thái: `ACTIVE_COLOR`, `BLUE_TAG`, `GREEN_TAG`. Task 4 đọc đúng ba biến này.

- [ ] **Step 1: Viết config nginx**

`deploy/nginx/active.conf` — file trạng thái, release ghi đè:

```nginx
set $active web_blue;
```

`deploy/nginx/nginx.conf`:

```nginx
events {}
http {
  resolver 127.0.0.11 valid=10s;   # Docker DNS: cho phép $active là biến

  server {
    listen 80;
    client_max_body_size 20m;

    include /etc/nginx/active.conf;

    location = /proxy-health { return 200 "proxy ok\n"; }

    error_page 502 503 504 /maintenance.html;
    location = /maintenance.html {
      root /usr/share/nginx/html;
      internal;
    }

    location / {
      # proxy_pass với biến ⇒ nginx resolve DNS lúc request, nên container
      # màu kia có thể chưa tồn tại khi nginx khởi động (không crash).
      proxy_pass http://$active:3000;
      proxy_http_version 1.1;
      proxy_set_header Host              $host;
      proxy_set_header X-Real-IP         $remote_addr;
      proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;
      proxy_set_header Upgrade           $http_upgrade;
      proxy_set_header Connection        "upgrade";
      proxy_read_timeout 60s;
    }
  }
}
```

`deploy/nginx/maintenance.html` (chỉ hiện khi cả hai màu cùng chết — không phải feature bảo trì):

```html
<!doctype html>
<html lang="vi">
  <head><meta charset="utf-8" /><title>Đang khởi động lại</title></head>
  <body style="font-family: system-ui; text-align: center; padding: 4rem;">
    <h1>Hệ thống đang khởi động lại</h1>
    <p>Vui lòng thử lại sau ít phút.</p>
  </body>
</html>
```

- [ ] **Step 2: Sửa docker-compose.yml**

Thay nguyên service `web` bằng anchor + hai màu, thêm `proxy`. Giữ `db` và `cloudflare` như hiện tại (kể cả bind mount `/data/postgres`).

```yaml
x-web: &web
  image: learning-english-web:${BLUE_TAG:-dev}   # bị override ở từng màu
  restart: unless-stopped
  depends_on:
    db:
      condition: service_healthy
  environment:
    DATABASE_URL: postgresql://${POSTGRES_USER:-learning_english}:${POSTGRES_PASSWORD:-learning_english}@db:5432/${POSTGRES_DB:-learning_english}
    DIRECT_URL: postgresql://${POSTGRES_USER:-learning_english}:${POSTGRES_PASSWORD:-learning_english}@db:5432/${POSTGRES_DB:-learning_english}
    AUTH_SECRET: ${AUTH_SECRET}
    AUTH_GOOGLE_ID: ${AUTH_GOOGLE_ID}
    AUTH_GOOGLE_SECRET: ${AUTH_GOOGLE_SECRET}
    AUTH_URL: ${AUTH_URL:-http://localhost:3000}
    AUTH_TRUST_HOST: "true"       # app giờ đứng sau proxy

services:
  # db: giữ nguyên

  web_blue:
    <<: *web
    image: learning-english-web:${BLUE_TAG:-dev}
  web_green:
    <<: *web
    image: learning-english-web:${GREEN_TAG:-dev}

  proxy:
    image: nginx:1.27-alpine
    restart: unless-stopped
    ports:
      - "${WEB_PORT:-3000}:80"
    volumes:
      - ./deploy/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./deploy/nginx/active.conf:/etc/nginx/active.conf:ro
      - ./deploy/nginx/maintenance.html:/usr/share/nginx/html/maintenance.html:ro

  cloudflare:
    # giữ nguyên, nhưng depends_on đổi từ web → proxy
    depends_on:
      - proxy
```

Bỏ `build:` và `ports:` khỏi web (build là việc của `release.sh`; chỉ proxy mở port). Bỏ khối `volumes: db_data` nếu không còn ai tham chiếu.

- [ ] **Step 3: Thêm biến trạng thái vào `.env.example`**

```bash
# --- Blue-green deploy (xem docs/deploy-vps.md) ---
# Màu đang phục vụ traffic. `make release` tự cập nhật — đừng sửa tay.
ACTIVE_COLOR=blue
# Image tag (= SemVer) của từng màu. Màu chưa dùng để `dev`.
BLUE_TAG=dev
GREEN_TAG=dev
```

- [ ] **Step 4: Build image đầu tiên và verify thủ công**

```bash
docker build -f web/Dockerfile --build-arg APP_VERSION=0.1.0 -t learning-english-web:0.1.0 .
# đặt BLUE_TAG=0.1.0, ACTIVE_COLOR=blue trong .env
docker compose up -d db proxy web_blue
curl -fsS localhost:3000/proxy-health           # "proxy ok"
curl -fsS localhost:3000/api/health             # {"status":"ok","version":"0.1.0"}
```

Expected: cả hai lệnh curl trả 200 — proxy đang forward đúng vào blue.

- [ ] **Step 5: Verify nginx không chết khi màu kia chưa tồn tại**

Run: `docker compose logs proxy | tail -5` (green chưa được `up` bao giờ)
Expected: không có `host not found in upstream` — nhờ `resolver` + `proxy_pass` bằng biến.

- [ ] **Step 6: Commit**

```bash
git add deploy docker-compose.yml .env.example
git commit -m "feat(deploy): put nginx proxy in front of blue/green web containers"
```

---

### Task 4: Script release / switch / rollback / smoke / status

**Files:**
- Create: `scripts/deploy/lib.sh`, `switch.sh`, `smoke.sh`, `status.sh`, `release.sh`, `rollback.sh`
- Modify: `Makefile`

**Interfaces:**
- Consumes: `/api/health` (Task 1), CLI `check-migrations.ts` (Task 2), `.env` với `ACTIVE_COLOR`/`BLUE_TAG`/`GREEN_TAG` + `deploy/nginx/active.conf` (Task 3), `scripts/deploy/backup.sh` (Task 5).
- Produces: `make release VERSION=x.y.z`, `make rollback`, `make status`, `make smoke COLOR=green`.

- [ ] **Step 1: `scripts/deploy/lib.sh`**

```bash
#!/usr/bin/env bash
# Dùng chung cho mọi script deploy. source từ thư mục gốc repo.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ACTIVE_CONF="$ROOT/deploy/nginx/active.conf"
cd "$ROOT"

[ -f .env ] || { echo "Chưa có .env — chạy 'make env' trước."; exit 1; }

env_get()  { grep "^$1=" .env | head -1 | cut -d= -f2-; }
env_set()  { # env_set KEY VALUE — thêm dòng nếu chưa có
  if grep -q "^$1=" .env; then sed -i.bak "s|^$1=.*|$1=$2|" .env && rm -f .env.bak
  else printf '%s=%s\n' "$1" "$2" >> .env; fi
}

active_color() { env_get ACTIVE_COLOR; }
idle_color()   { [ "$(active_color)" = "blue" ] && echo green || echo blue; }
tag_key()      { [ "$1" = "blue" ] && echo BLUE_TAG || echo GREEN_TAG; }

compose() { docker compose "$@"; }
```

- [ ] **Step 2: `scripts/deploy/switch.sh` + `smoke.sh` + `status.sh`**

`switch.sh` — nguyên thuỷ duy nhất được phép đổi traffic:

```bash
#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"
COLOR="${1:?dùng: switch.sh <blue|green>}"

echo "set \$active web_$COLOR;" > "$ACTIVE_CONF"
compose exec -T proxy nginx -t                 # config sai thì dừng, chưa reload
compose exec -T proxy nginx -s reload          # worker cũ phục vụ nốt request đang dở
env_set ACTIVE_COLOR "$COLOR"
echo "Traffic → web_$COLOR"
```

`smoke.sh` — gọi thẳng vào một màu, không qua proxy routing, nên chạy được **trước** khi switch:

```bash
#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"
COLOR="${1:?dùng: smoke.sh <blue|green>}"
EXPECT_VERSION="${2:-}"

echo "Smoke test web_$COLOR..."
BODY=$(compose exec -T proxy curl -fsS --max-time 10 "http://web_$COLOR:3000/api/health")
echo "  /api/health → $BODY"
echo "$BODY" | grep -q '"status":"ok"' || { echo "DB không phản hồi từ web_$COLOR"; exit 1; }

if [ -n "$EXPECT_VERSION" ]; then
  echo "$BODY" | grep -q "\"version\":\"$EXPECT_VERSION\"" \
    || { echo "Sai version: mong đợi $EXPECT_VERSION"; exit 1; }
fi

# Trang login là route SSR công khai — 200 nghĩa là Next render được thật,
# không chỉ mỗi API route sống.
compose exec -T proxy curl -fsS -o /dev/null --max-time 10 "http://web_$COLOR:3000/login"
echo "  /login → 200"
echo "Smoke test PASS."
```

`status.sh`:

```bash
#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"
printf 'Active : %s\n' "$(active_color)"
printf 'blue   : tag=%s  ' "$(env_get BLUE_TAG)"
compose exec -T proxy curl -fsS --max-time 5 http://web_blue:3000/api/health 2>/dev/null || echo "(không chạy)"
printf 'green  : tag=%s  ' "$(env_get GREEN_TAG)"
compose exec -T proxy curl -fsS --max-time 5 http://web_green:3000/api/health 2>/dev/null || echo "(không chạy)"
```

- [ ] **Step 3: `scripts/deploy/release.sh`**

```bash
#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"
VERSION="${1:?dùng: make release VERSION=x.y.z}"

FROM=$(active_color); TO=$(idle_color)
echo "Release $VERSION: $FROM (đang chạy) → $TO"

# 1. Test + lint + build. Hỏng ở đây thì chưa có gì bị đụng.
(cd web && npm test && npm run lint && npm run build)

# 2. Bump version — package.json là nguồn sự thật của SemVer.
(cd web && npm version "$VERSION" --no-git-tag-version)

# 3. Build image gắn version.
docker build -f web/Dockerfile --build-arg "APP_VERSION=$VERSION" \
  -t "learning-english-web:$VERSION" .

# 4. Chặn migration phá vỡ tương thích ngược — bản cũ vẫn phải sống được
#    trên schema mới, nếu không "fallback" là vô nghĩa.
compose exec -T db psql -U "$(env_get POSTGRES_USER)" -d "$(env_get POSTGRES_DB)" \
  -tAc 'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL' \
  | (cd web && npx tsx scripts/deploy/check-migrations.ts)

# 5. Backup DB — đường lùi duy nhất nếu migration sai.
./scripts/deploy/backup.sh "pre-$VERSION"

# 6. Bật màu rảnh. $FROM vẫn giữ 100% traffic.
env_set "$(tag_key "$TO")" "$VERSION"
compose up -d "web_$TO"

# 7. Migrate (chỉ thay đổi cộng thêm, đã kiểm ở bước 4).
compose exec -T "web_$TO" npx prisma migrate deploy

# 8. Smoke test thẳng vào màu mới. Hỏng → tắt nó, user chưa từng thấy gì.
if ! ./scripts/deploy/smoke.sh "$TO" "$VERSION"; then
  echo "Smoke test FAIL — huỷ release, $FROM vẫn đang phục vụ."
  compose stop "web_$TO"
  exit 1
fi

# 9. Chuyển traffic. $FROM VẪN CHẠY = bản fallback.
./scripts/deploy/switch.sh "$TO"
git tag "v$VERSION"

echo
echo "Đã release $VERSION trên web_$TO."
echo "web_$FROM (tag $(env_get "$(tag_key "$FROM")")) vẫn chạy làm fallback."
echo "Có vấn đề?  make rollback     (≈1 giây, không build lại)"
echo "Ổn rồi?     git push --tags && cập nhật CHANGELOG.md"
```

- [ ] **Step 4: `scripts/deploy/rollback.sh`**

```bash
#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"
TO=$(idle_color)

compose ps --services --filter status=running | grep -qx "web_$TO" \
  || { echo "web_$TO không chạy — không có bản fallback. Xem 'make status'."; exit 1; }

./scripts/deploy/smoke.sh "$TO"
./scripts/deploy/switch.sh "$TO"
echo "Đã quay về web_$TO (tag $(env_get "$(tag_key "$TO")"))."
echo "LƯU Ý: migration của bản mới KHÔNG bị revert (chúng tương thích ngược nên bản cũ chạy được)."
echo "Nếu chính migration là thủ phạm: make restore FILE=backups/<pre-x.y.z>.sql.gz"
```

- [ ] **Step 5: `chmod +x` và sửa Makefile**

```bash
chmod +x scripts/deploy/*.sh
```

Trong `Makefile`: thêm biến màu ở đầu file, sửa mọi target đang gọi `exec web`, thêm nhóm release.

```make
.PHONY: help env build up down restart logs ps sh dbsh migrate seed seed-all \
        bootstrap clean release rollback switch status smoke backup restore check-migrations

COMPOSE := docker compose
# Màu đang phục vụ traffic — mọi target one-off (logs/sh/migrate/seed) phải
# nhắm vào nó, không phải màu fallback đang nằm chờ.
ACTIVE  = $(shell grep '^ACTIVE_COLOR=' .env 2>/dev/null | cut -d= -f2 || echo blue)
WEB     = web_$(ACTIVE)

logs:            ; $(COMPOSE) logs -f $(WEB)
sh:              ; $(COMPOSE) exec $(WEB) sh
migrate: env     ; $(COMPOSE) exec $(WEB) npx prisma migrate deploy
seed: env        ; $(COMPOSE) exec $(WEB) npx tsx scripts/seed/ingest.ts
seed-all: seed
	$(COMPOSE) exec $(WEB) npx tsx scripts/seed/seed-placement.ts
	$(COMPOSE) exec $(WEB) npx tsx scripts/seed/seed-ielts.ts

up: env
	$(COMPOSE) up -d db proxy $(WEB) cloudflare
	@echo "Web: http://localhost:$$(grep '^WEB_PORT=' .env | cut -d= -f2 || echo 3000) (đang chạy: $(WEB))"

release: env     ; ./scripts/deploy/release.sh $(VERSION)
rollback: env    ; ./scripts/deploy/rollback.sh
switch: env      ; ./scripts/deploy/switch.sh $(COLOR)
status: env      ; ./scripts/deploy/status.sh
smoke: env       ; ./scripts/deploy/smoke.sh $(COLOR)
```

Cập nhật `help` để liệt kê nhóm mới. `bootstrap` phải `env_set ACTIVE_COLOR=blue` + build image `:dev` gán `BLUE_TAG=dev` trước khi `up`. `down`, `restart`, `ps`, `dbsh`, `clean`, `env` giữ nguyên.

- [ ] **Step 6: Verify end-to-end trên máy local**

```bash
make status                 # blue active, green không chạy
make release VERSION=0.2.0  # chạy hết 9 bước
make status                 # green active tag 0.2.0, blue vẫn chạy tag 0.1.0
curl -fsS localhost:3000/api/health   # version 0.2.0
make rollback
curl -fsS localhost:3000/api/health   # version 0.1.0 — fallback hoạt động
```

Expected: cả `release` lẫn `rollback` không có giây nào request bị 502. Kiểm chứng: chạy `while true; do curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/login; sleep 0.2; done` ở terminal khác trong lúc switch — phải toàn 200.

Lưu ý: `make release VERSION=0.2.0` ở bước 4 sẽ **fail** nếu migration `20260709034036_drop_otp_code` chưa apply trên DB local. Trên DB đang chạy nó đã apply rồi nên sẽ qua; nếu test trên DB trắng, apply hết migration cũ trước (`make migrate`) rồi mới release.

- [ ] **Step 7: Commit**

```bash
git add scripts/deploy Makefile
git commit -m "feat(deploy): blue-green release, rollback, smoke and status targets"
```

---

### Task 5: Backup / restore + runbook lên VPS

**Files:**
- Create: `scripts/deploy/backup.sh`, `scripts/deploy/restore.sh`, `docs/deploy-vps.md`
- Modify: `Makefile` (targets `backup` / `restore`), `.gitignore` (bỏ qua `backups/`)

**Interfaces:**
- Consumes: `lib.sh` (Task 4).
- Produces: `make backup` → `backups/<timestamp>[-<label>].sql.gz`. `make restore FILE=...`. `release.sh` bước 5 gọi `backup.sh "pre-$VERSION"`.

- [ ] **Step 1: `scripts/deploy/backup.sh`**

```bash
#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"
LABEL="${1:-manual}"
mkdir -p backups
OUT="backups/$(date +%Y%m%d-%H%M%S)-$LABEL.sql.gz"

compose exec -T db pg_dump -U "$(env_get POSTGRES_USER)" -d "$(env_get POSTGRES_DB)" \
  --clean --if-exists | gzip > "$OUT"

echo "Backup → $OUT ($(du -h "$OUT" | cut -f1))"
```

`--clean --if-exists` để dump tự drop object cũ khi restore — restore chạy được trên DB đã có dữ liệu mà không cần drop tay.

- [ ] **Step 2: `scripts/deploy/restore.sh`**

```bash
#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"
FILE="${1:?dùng: make restore FILE=backups/xxx.sql.gz}"
[ -f "$FILE" ] || { echo "Không thấy file: $FILE"; exit 1; }

echo "GHI ĐÈ toàn bộ database '$(env_get POSTGRES_DB)' bằng $FILE."
read -rp "Gõ 'yes' để xác nhận: " ok
[ "$ok" = "yes" ] || { echo "Huỷ."; exit 1; }

# Tắt web trước: Prisma đang giữ connection sẽ chặn DROP trong dump.
compose stop web_blue web_green 2>/dev/null || true
gunzip -c "$FILE" | compose exec -T db psql -U "$(env_get POSTGRES_USER)" -d "$(env_get POSTGRES_DB)"
compose up -d "web_$(active_color)"

echo "Đã restore. Kiểm tra: make smoke COLOR=$(active_color)"
```

- [ ] **Step 3: Thêm target + gitignore**

Makefile:

```make
backup: env      ; ./scripts/deploy/backup.sh $(LABEL)
restore: env     ; ./scripts/deploy/restore.sh $(FILE)
check-migrations: env
	$(COMPOSE) exec -T db psql -U $$(grep '^POSTGRES_USER=' .env | cut -d= -f2) \
	  -d $$(grep '^POSTGRES_DB=' .env | cut -d= -f2) \
	  -tAc 'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL' \
	  | (cd web && npx tsx scripts/deploy/check-migrations.ts)
```

`.gitignore`: thêm `backups/` (dump chứa dữ liệu người dùng — không commit).

- [ ] **Step 4: Verify backup/restore round-trip**

```bash
make backup LABEL=test
make dbsh   # \dt → đếm bảng, ghi lại số user: SELECT count(*) FROM "User";
make restore FILE=backups/<file vừa tạo>.sql.gz
make dbsh   # số user phải y hệt
```

Expected: số lượng bảng và số user không đổi sau round-trip.

- [ ] **Step 5: Viết `docs/deploy-vps.md`**

Runbook, các mục:

1. **Chuẩn bị VPS**: cài Docker + compose plugin; `mkdir -p /data/postgres` (compose đang bind-mount đúng path này — trên VPS nó nằm trên disk thật, nhớ để trên volume có backup của nhà cung cấp); clone repo; `make env` rồi điền `AUTH_*`, `TUNNEL_TOKEN`, `AUTH_URL=https://<domain>`.
2. **Di cư DB**: trên máy cũ `make backup LABEL=migrate-to-vps` → `scp backups/<file> vps:~/learning_english/backups/` → trên VPS `make bootstrap` (dựng schema trắng) rồi `make restore FILE=backups/<file>`. Không dùng `make seed-all` trên VPS nếu đã restore — dump đã chứa toàn bộ nội dung.
   - Cách thay thế (nhanh hơn, nhưng chỉ đúng nếu VPS cùng version Postgres 16): rsync thẳng thư mục `/data/postgres` khi container db đã dừng.
3. **Đổi Cloudflare Tunnel**: Zero Trust → Networks → Tunnels → public hostname, đổi service từ `http://web:3000` sang **`http://proxy:80`**. Đây là lần cuối phải đụng vào dashboard — từ đó mọi việc chuyển version diễn ra trong Docker network.
4. **Backup định kỳ**: crontab `0 3 * * * cd /path/repo && make backup LABEL=nightly` + xoá dump quá 14 ngày (`find backups -name '*nightly*' -mtime +14 -delete`).
5. **Vận hành hằng ngày**: `make status` → `make release VERSION=x.y.z` → nếu hỏng `make rollback`.

- [ ] **Step 6: Commit**

```bash
git add scripts/deploy/backup.sh scripts/deploy/restore.sh docs/deploy-vps.md Makefile .gitignore
git commit -m "feat(deploy): pg_dump backup/restore + VPS migration runbook"
```

---

### Task 6: CHANGELOG + tài liệu hoá quy trình version

**Files:**
- Create: `CHANGELOG.md`
- Modify: `CLAUDE.md` (mục Commands + Hard rules), `web/package.json` (version → `0.2.0`)

- [ ] **Step 1: `CHANGELOG.md`** theo Keep a Changelog

```markdown
# Changelog

Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/),
version theo [SemVer](https://semver.org/lang/vi/).

Quy ước riêng của dự án: **MINOR** cho tính năng mới, **PATCH** cho sửa lỗi,
**MAJOR** cho thay đổi phá vỡ tương thích DB (loại phải downtime — xem
`docs/deploy-vps.md`).

## [Unreleased]

## [0.2.0] — 2026-07-11

### Added
- Blue-green deploy: hai container web song song sau nginx proxy; release
  không downtime, rollback về bản cũ trong ~1 giây (`make rollback`).
- `/api/health` trả version đang chạy + tình trạng DB.
- Backup/restore Postgres (`make backup` / `make restore`) và runbook lên VPS.
- Chặn tự động migration phá vỡ tương thích ngược trước khi release.

## [0.1.0]
- Bản đầu: lộ trình học, luyện nghe, đề IELTS, placement test, đăng nhập Google.
```

- [ ] **Step 2: Cập nhật `CLAUDE.md`**

Vào mục **Commands**, thêm:

```bash
make status                    # màu nào đang phục vụ, version nào
make release VERSION=0.3.0     # test → build → migrate → smoke → switch
make rollback                  # quay về bản cũ đang chạy sẵn (~1 giây)
make backup                    # pg_dump vào backups/
```

Vào **Hard rules**, thêm:

- Migration Prisma phải **tương thích ngược** (chỉ thêm bảng / cột nullable / index). Bản cũ vẫn chạy song song sau khi release nên `DROP COLUMN` / `RENAME` / `SET NOT NULL` sẽ làm nó vỡ. Muốn xoá cột: release N thêm cột mới + ghi cả hai chỗ, release N+1 (sau khi bản cũ hết dùng) mới xoá. `make release` sẽ chặn nếu vi phạm.
- Mỗi release cập nhật `CHANGELOG.md` và `git push --tags`.

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md CLAUDE.md web/package.json
git commit -m "docs: changelog + blue-green release rules"
```

---

## Verification (toàn bộ hệ thống)

1. `cd web && npm test` — toàn bộ suite Vitest xanh, gồm test mới cho `/api/health` và `check-migrations`.
2. `make status` — in đúng màu active + version của cả hai màu.
3. `make release VERSION=0.2.0` với một vòng lặp curl chạy song song (`while true; do curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/login; sleep 0.2; done`) — **không có mã nào khác 200** trong suốt quá trình.
4. `curl localhost:3000/api/health` sau release → `version` là bản mới; `make rollback` → `version` là bản cũ. Đây là bằng chứng fallback hoạt động thật.
5. Tạo thử một migration có `DROP COLUMN` (không commit), chạy `make check-migrations` → exit 1 kèm hướng dẫn expand/contract. Xoá migration thử đi.
6. `make backup` → `make restore FILE=...` → số user trong DB không đổi.
