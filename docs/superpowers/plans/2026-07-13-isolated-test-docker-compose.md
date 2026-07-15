# Isolated Test Docker Compose — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Context

Hôm nay chỉ có một stack duy nhất: `docker-compose.yml` ở repo root chạy `db` (port 5432, volume `db_data` bền vững), `web` (port 3000) và `cloudflare` tunnel — tức là stack **production** đang phục vụ người dùng thật qua tunnel. Muốn thử một tính năng mới hay một thay đổi schema, hiện không có cách nào ngoài việc build/restart chính stack đó: rủi ro đụng port, đụng volume dữ liệu thật, và tunnel sẽ phát tán bản đang thử ra ngoài.

Plan này thêm một stack **test hoàn toàn tách biệt**: compose project riêng, port riêng (3100 / 5433), Postgres **ephemeral trên tmpfs** (mỗi lần `up` là DB sạch, `down` là bay hết), **không có cloudflare tunnel**. Dùng cho hai việc: (1) smoke-test app bằng trình duyệt ở `localhost:3100`, (2) chạy `vitest` + `prisma migrate deploy` + seed bên trong container trên DB sạch. Stack prod không bị chạm tới — không đổi port, không đổi container, không đổi volume.

**Goal:** Một `docker-compose.test.yml` + các target `make test-*` cho phép build/chạy/kiểm thử toàn bộ app trong môi trường cách ly, song song với stack prod đang chạy.

**Architecture:** Một file compose độc lập (không phải override) với `name: learning-english-test`, nên Docker tự tạo network/container/volume riêng và hai stack sống song song. Dùng lại `web/Dockerfile` sẵn có, bổ sung một stage `test` (kế thừa `builder`, đã có đủ devDependencies + `vitest.config.ts` + toàn bộ `src/`) để chạy unit test trong container mà không làm nặng image prod.

**Tech Stack:** Docker Compose v2, Postgres 16-alpine (tmpfs), Node 20-alpine, Next.js 15, Prisma 6, Vitest 4, GNU Make.

## Global Constraints

- **Không sửa `docker-compose.yml` (prod), không sửa các stage `deps`/`builder`/`runner` hiện có theo cách làm đổi image prod.** Chỉ được *thêm* stage mới vào cuối `web/Dockerfile`.
- Port test cố định mặc định: web `3100`, postgres `5433` — cả hai override được qua `.env.test`.
- Compose project name của stack test: `learning-english-test` (prod dùng default `learning_english`).
- DB test là **ephemeral**: `tmpfs: /var/lib/postgresql/data`, **tuyệt đối không** khai báo named volume.
- Stack test **không có** service `cloudflare`.
- `.env.test` là file local, phải nằm trong `.gitignore`; chỉ commit `.env.test.example`.
- Work happens directly on `main` (CLAUDE.md).
- Sau khi thêm file, KHÔNG cần chạy `build_index.py` (không phải content file).

---

### Task 1: Thêm stage `test` vào `web/Dockerfile` + script `test:ci`

Image `runner` hiện tại copy full `node_modules` (có devDeps) nhưng **không** copy `vitest.config.ts` / `vitest.setup.ts`, và `npm test` lại bind vào `dotenv -e .env.local` (file này không tồn tại trong container). Nên ta thêm một stage riêng cho test và một script không phụ thuộc `.env.local`.

**Files:**
- Modify: `web/Dockerfile` (append stage ở cuối file)
- Modify: `web/package.json` (thêm script `test:ci`)

**Interfaces:**
- Produces: build target `test` trong `web/Dockerfile`; npm script `test:ci` = `vitest run` (đọc env từ process env, không đọc `.env.local`).

- [ ] **Step 1: Thêm script `test:ci` vào `web/package.json`**

Trong block `"scripts"`, ngay dưới dòng `"test": ...`, thêm:

```json
    "test:ci": "vitest run",
```

(Giữ nguyên `"test"` để dev local trên host vẫn dùng `.env.local` như cũ.)

- [ ] **Step 2: Append stage `test` vào cuối `web/Dockerfile`**

```dockerfile

# ---------------------------------------------------------------------------
# Test stage — used ONLY by docker-compose.test.yml (`target: test`).
# Inherits `builder`, which already has the full web/ tree (vitest.config.ts,
# vitest.setup.ts, src/, scripts/) and devDependencies from `npm ci`. Prod's
# `runner` stage is untouched, so this adds nothing to the shipped image.
FROM builder AS test
WORKDIR /app/web
# Curriculum content, one level above web/ — the seed scripts resolve it as
# path.resolve(process.cwd(), "..") (see the note at the top of this file).
COPY phase_1_foundation /app/phase_1_foundation
COPY phase_2_elementary /app/phase_2_elementary
COPY phase_3_intermediate /app/phase_3_intermediate
COPY phase_4_advanced /app/phase_4_advanced
COPY phase_5_ielts_prep /app/phase_5_ielts_prep
COPY ielts_practice_tests /app/ielts_practice_tests
ENV NODE_ENV=test
CMD ["npm", "run", "test:ci"]
```

- [ ] **Step 3: Build thử stage test và chạy vitest — đây là bài test của task này**

```bash
cd /home/ncd/learnspaces/learning_english
docker build -f web/Dockerfile --target test -t le-web-test:tmp .
docker run --rm le-web-test:tmp
```

Expected: vitest chạy và in ra bảng kết quả (`Test Files ... passed`), exit code 0. Nếu báo `Cannot find module vitest.config` hoặc `Parse failure` → stage `test` chưa kế thừa đúng `builder`, xem lại Step 2.

- [ ] **Step 4: Xác nhận image prod KHÔNG đổi**

```bash
docker build -f web/Dockerfile --target runner -t le-web-prod:tmp .
docker run --rm le-web-prod:tmp node -e "console.log('runner ok')"
```

Expected: in `runner ok`. Dọn rác: `docker rmi le-web-test:tmp le-web-prod:tmp`

- [ ] **Step 5: Commit**

```bash
git add web/Dockerfile web/package.json
git commit -m "build(test): add a test stage to the web image and a test:ci script"
```

---

### Task 2: `docker-compose.test.yml` + `.env.test.example`

**Files:**
- Create: `docker-compose.test.yml` (repo root)
- Create: `.env.test.example` (repo root)
- Modify: `.gitignore` (ignore `.env.test`)

**Interfaces:**
- Consumes: build target `test` (Task 1).
- Produces: compose project `learning-english-test` với services `db` (port `${TEST_POSTGRES_PORT:-5433}`), `web` (port `${TEST_WEB_PORT:-3100}`), và `vitest` (profile `tools`, one-shot).

- [ ] **Step 1: Tạo `.env.test.example`**

```bash
# Env cho docker-compose.test.yml — môi trường TEST cách ly.
# Copy sang `.env.test`: `make test-env` (tự sinh AUTH_SECRET ngẫu nhiên).
#
# Stack này KHÔNG dùng chung gì với stack prod (docker-compose.yml + .env):
# khác compose project, khác network, khác port, và DB nằm trên tmpfs nên
# mất sạch sau `make test-down`. Chạy song song với prod thoải mái.

POSTGRES_USER=learning_english
POSTGRES_PASSWORD=learning_english
POSTGRES_DB=learning_english_test

# Port trên host — cố tình lệch prod (5432/3000) để không đụng nhau.
TEST_POSTGRES_PORT=5433
TEST_WEB_PORT=3100

# AUTH_SECRET được `make test-env` sinh ngẫu nhiên.
AUTH_SECRET=
# Google OAuth: để trống thì nút "đăng nhập Google" sẽ lỗi. Muốn test luồng
# đăng nhập thì dán client id/secret vào đây VÀ thêm
# http://localhost:3100/api/auth/callback/google vào Authorized redirect URIs
# của OAuth client trong Google Cloud Console.
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_URL=http://localhost:3100
```

- [ ] **Step 2: Tạo `docker-compose.test.yml`**

```yaml
# Stack TEST — cách ly hoàn toàn với docker-compose.yml (prod).
#
#   make test-up      # dựng db + web test, migrate + seed, mở http://localhost:3100
#   make test-unit    # chạy vitest trong container trên DB sạch
#   make test-down    # xoá sạch (DB nằm trên tmpfs nên không còn dấu vết)
#
# Khác prod ở đúng 4 điểm: compose project name riêng, port riêng (3100/5433),
# Postgres ephemeral trên tmpfs (không có named volume), và KHÔNG có cloudflare
# tunnel — bản đang thử không bao giờ lộ ra Internet.
name: learning-english-test

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-learning_english}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-learning_english}
      POSTGRES_DB: ${POSTGRES_DB:-learning_english_test}
    ports:
      - "${TEST_POSTGRES_PORT:-5433}:5432"
    # Ephemeral: dữ liệu sống trong RAM, biến mất khi container dừng.
    tmpfs:
      - /var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-learning_english}"]
      interval: 3s
      timeout: 5s
      retries: 20

  web:
    build:
      context: .
      dockerfile: web/Dockerfile
      target: runner
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER:-learning_english}:${POSTGRES_PASSWORD:-learning_english}@db:5432/${POSTGRES_DB:-learning_english_test}
      DIRECT_URL: postgresql://${POSTGRES_USER:-learning_english}:${POSTGRES_PASSWORD:-learning_english}@db:5432/${POSTGRES_DB:-learning_english_test}
      AUTH_SECRET: ${AUTH_SECRET}
      AUTH_GOOGLE_ID: ${AUTH_GOOGLE_ID}
      AUTH_GOOGLE_SECRET: ${AUTH_GOOGLE_SECRET}
      AUTH_URL: ${AUTH_URL:-http://localhost:3100}
    ports:
      - "${TEST_WEB_PORT:-3100}:3000"

  # One-shot: `docker compose ... run --rm vitest`. Nằm trong profile "tools"
  # nên `up` thường KHÔNG dựng nó.
  vitest:
    profiles: ["tools"]
    build:
      context: .
      dockerfile: web/Dockerfile
      target: test
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER:-learning_english}:${POSTGRES_PASSWORD:-learning_english}@db:5432/${POSTGRES_DB:-learning_english_test}
      DIRECT_URL: postgresql://${POSTGRES_USER:-learning_english}:${POSTGRES_PASSWORD:-learning_english}@db:5432/${POSTGRES_DB:-learning_english_test}
      AUTH_SECRET: ${AUTH_SECRET:-test-secret}
      AUTH_URL: http://localhost:3100
```

- [ ] **Step 3: Ignore `.env.test`**

Thêm vào `.gitignore` (repo root), cạnh dòng ignore `.env` sẵn có:

```
.env.test
```

- [ ] **Step 4: Kiểm tra compose file hợp lệ và KHÔNG đụng prod**

```bash
cd /home/ncd/learnspaces/learning_english
cp .env.test.example .env.test
docker compose -f docker-compose.test.yml --env-file .env.test config | grep -E "name:|container_name|published|target|tmpfs"
```

Expected: thấy `name: learning-english-test`, `published: "3100"`, `published: "5433"`, `tmpfs`, và **không** thấy service `cloudflare`. Không có port 3000/5432 nào.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.test.yml .env.test.example .gitignore
git commit -m "build(test): add an isolated test compose stack on ports 3100/5433"
```

---

### Task 3: Các target `make test-*`

**Files:**
- Modify: `Makefile` (thêm block ở cuối, và thêm tên target vào dòng `.PHONY`)

**Interfaces:**
- Consumes: `docker-compose.test.yml`, `.env.test.example` (Task 2).
- Produces: `make test-env | test-build | test-up | test-migrate | test-seed | test-unit | test-logs | test-sh | test-dbsh | test-down | test-reset`.

- [ ] **Step 1: Mở rộng dòng `.PHONY` (dòng 1 của `Makefile`)**

```make
.PHONY: help env build up down restart logs ps sh dbsh migrate seed seed-all bootstrap clean \
        test-env test-build test-up test-migrate test-seed test-unit test-logs test-sh test-dbsh test-down test-reset
```

- [ ] **Step 2: Thêm các dòng help vào target `help` (ngay trước dòng `@echo "make clean ..."`)**

```make
	@echo ""
	@echo "--- Môi trường TEST (cách ly, port 3100/5433, DB ephemeral) ---"
	@echo "make test-up     - dựng stack test + migrate + seed  -> http://localhost:3100"
	@echo "make test-unit   - chạy vitest trong container trên DB sạch"
	@echo "make test-logs   - tail log web của stack test"
	@echo "make test-down   - xoá stack test (DB tmpfs bay theo)"
	@echo "make test-reset  - test-down rồi test-up (DB sạch tinh)"
```

- [ ] **Step 3: Thêm block target test vào cuối `Makefile`**

```make
# ---------------------------------------------------------------------------
# Môi trường TEST — hoàn toàn tách biệt stack prod ở trên. Compose project
# riêng (learning-english-test), port riêng (3100/5433), Postgres trên tmpfs
# nên `test-down` là xoá sạch. Chạy song song với prod được, không đụng port
# và không đụng volume db_data.
TEST_COMPOSE := docker compose -f docker-compose.test.yml --env-file .env.test

test-env:
	@test -f .env.test || { \
		cp .env.test.example .env.test; \
		SECRET=$$(openssl rand -hex 32); \
		sed -i.bak "s/^AUTH_SECRET=.*/AUTH_SECRET=$$SECRET/" .env.test && rm -f .env.test.bak; \
		echo "Created .env.test with a generated AUTH_SECRET."; \
	}

test-build: test-env
	$(TEST_COMPOSE) build

test-up: test-env
	$(TEST_COMPOSE) up -d --build web
	@echo "Waiting for Postgres..."
	@until $(TEST_COMPOSE) exec -T db pg_isready -U $$(grep '^POSTGRES_USER=' .env.test | cut -d= -f2) >/dev/null 2>&1; do sleep 1; done
	@sleep 3
	$(MAKE) test-migrate
	$(MAKE) test-seed
	@echo "Test web: http://localhost:$$(grep '^TEST_WEB_PORT=' .env.test | cut -d= -f2)"

test-migrate: test-env
	$(TEST_COMPOSE) exec web npx prisma migrate deploy

test-seed: test-env
	$(TEST_COMPOSE) exec web npx tsx scripts/seed/ingest.ts
	$(TEST_COMPOSE) exec web npx tsx scripts/seed/seed-placement.ts
	$(TEST_COMPOSE) exec web npx tsx scripts/seed/seed-ielts.ts

# Dựng DB sạch, migrate, rồi chạy vitest one-shot trong container test.
test-unit: test-env
	$(TEST_COMPOSE) up -d db
	@until $(TEST_COMPOSE) exec -T db pg_isready -U $$(grep '^POSTGRES_USER=' .env.test | cut -d= -f2) >/dev/null 2>&1; do sleep 1; done
	$(TEST_COMPOSE) run --rm --build vitest sh -c "npx prisma migrate deploy && npm run test:ci"

test-logs:
	$(TEST_COMPOSE) logs -f web

test-sh:
	$(TEST_COMPOSE) exec web sh

test-dbsh: test-env
	$(TEST_COMPOSE) exec db psql -U $$(grep '^POSTGRES_USER=' .env.test | cut -d= -f2) -d $$(grep '^POSTGRES_DB=' .env.test | cut -d= -f2)

# Xoá container + network của stack test. DB nằm trên tmpfs nên không cần -v.
test-down:
	$(TEST_COMPOSE) down --remove-orphans

test-reset: test-down test-up
```

- [ ] **Step 4: Chạy thử `make test-unit` — bài test của task này**

```bash
cd /home/ncd/learnspaces/learning_english
make test-unit
```

Expected: build image, Postgres lên, `prisma migrate deploy` in `migrations applied` (hoặc `No pending migrations`), rồi vitest in `Test Files ... passed` và exit 0.

- [ ] **Step 5: Chạy thử `make test-up` VÀ kiểm tra prod không bị đụng**

```bash
make test-up
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3100
docker compose ps            # stack prod: vẫn nguyên, vẫn 3000/5432
docker compose -f docker-compose.test.yml --env-file .env.test ps
```

Expected: `curl` trả `200` (hoặc `307` redirect sang trang đăng nhập). `docker compose ps` cho thấy các container prod vẫn `running` như trước, không container nào bị recreate.

- [ ] **Step 6: Chạy thử `make test-down` và xác nhận DB bay sạch**

```bash
make test-down
docker volume ls | grep -i test    # phải KHÔNG có volume test nào
```

Expected: không có volume nào của project `learning-english-test`.

- [ ] **Step 7: Commit**

```bash
git add Makefile
git commit -m "build(test): add make test-* targets driving the isolated test stack"
```

---

### Task 4: Tài liệu

**Files:**
- Create: `docs/test-environment.md`
- Modify: `CLAUDE.md` (mục "Commands")
- Modify: `docs/architecture.md` (một đoạn ngắn nói stack test tồn tại song song)

- [ ] **Step 1: Viết `docs/test-environment.md`**

Nội dung phải nêu rõ: mục đích (thử tính năng mới mà không đụng prod); bảng so sánh prod vs test (project name, port web 3000/3100, port db 5432/5433, DB volume bền vững / tmpfs ephemeral, có/không cloudflare tunnel); vòng đời làm việc thường ngày (`make test-up` → mở `localhost:3100` → sửa code → `make test-reset`); `make test-unit` để chạy vitest trên DB sạch; lưu ý Google OAuth cần thêm redirect URI `http://localhost:3100/api/auth/callback/google` nếu muốn test đăng nhập; và cảnh báo `make down` / `make clean` là của **prod**, không phải test.

- [ ] **Step 2: Thêm vào mục "Commands" của `CLAUDE.md`, ngay sau block runtime Docker Compose hiện có**

```markdown
Môi trường test cách ly (repo root) — dùng khi code tính năng mới / đổi
schema, **không đụng tới port và dữ liệu của stack prod**
(xem `docs/test-environment.md`):

```bash
make test-up     # dựng db+web test, migrate, seed → http://localhost:3100
make test-unit   # chạy vitest trong container trên DB sạch
make test-reset  # dựng lại từ DB trắng
make test-down   # xoá stack test (DB tmpfs bay theo)
```
```

- [ ] **Step 3: Thêm một đoạn vào `docs/architecture.md`**

Sau phần mô tả compose prod, thêm đoạn giải thích rằng `docker-compose.test.yml` là một compose project thứ hai (`learning-english-test`), dùng lại chính `web/Dockerfile` (stage `test`), chạy trên 3100/5433 với Postgres tmpfs và không có tunnel, nên có thể chạy đồng thời với prod.

- [ ] **Step 4: Kiểm tra lệnh trong docs chạy được**

```bash
make help | grep test-
```

Expected: thấy đủ các dòng help của `test-up`, `test-unit`, `test-logs`, `test-down`, `test-reset`.

- [ ] **Step 5: Commit**

```bash
git add docs/test-environment.md CLAUDE.md docs/architecture.md
git commit -m "docs(test): document the isolated test compose environment"
```

---

## Verification (end-to-end)

Chạy tuần tự từ repo root, **trong khi stack prod đang chạy** — đó chính là điều cần chứng minh:

1. `docker compose ps` → ghi lại danh sách container prod (id + state).
2. `make test-unit` → vitest xanh, exit 0.
3. `make test-up` → `curl -s -o /dev/null -w "%{http_code}" http://localhost:3100` trả 200/307.
4. Mở `http://localhost:3100` trong trình duyệt, click qua một bài học → nội dung đã được seed hiển thị.
5. `make test-dbsh` rồi `\dt` → thấy các bảng Prisma; `\q`.
6. `docker compose ps` lần nữa → **danh sách container prod giống hệt bước 1** (cùng id, vẫn running). Prod không bị chạm.
7. `make test-down` → `docker volume ls | grep learning-english-test` không ra gì; `docker compose ps` prod vẫn nguyên.
