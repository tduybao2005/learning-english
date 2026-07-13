# Môi trường test cách ly

Repo có **hai** stack Docker chạy song song được:

| | **prod** (`docker-compose.yml`) | **test** (`docker-compose.test.yml`) |
|---|---|---|
| Compose project | `learning_english` | `learning-english-test` |
| Web | `localhost:3000` | `localhost:3100` |
| Postgres | `localhost:5432` | `localhost:5433` |
| Dữ liệu DB | volume `db_data`, **bền vững** | **tmpfs — mất sạch khi `test-down`** |
| Cloudflare tunnel | có (ra Internet) | **không** |
| Env file | `.env` | `.env.test` (tạo bởi `make test-env`) |

Stack prod đang phục vụ người dùng thật. Mọi thử nghiệm — tính năng mới, đổi
schema, sửa UI — chạy trên stack test; nó không đụng port, không đụng volume,
và không bao giờ lộ ra Internet.

## Vòng làm việc thường ngày

```bash
make test-up      # build + dựng db/web, migrate, seed → http://localhost:3100
# ... sửa code ...
make test-reset   # dựng lại từ DB trắng tinh (down rồi up)
make test-down    # xong việc: xoá container + network, DB bay theo
```

Kiểm tra tự động:

```bash
make test-unit    # migrate + seed + vitest, tất cả bên trong container, DB sạch
```

`test-unit` **phải** seed trước khi chạy vitest: `web/src/app/api/attempts/answers.test.ts`
là integration test, nó tìm bài `lesson_08_adjectives` thật trong DB
(`findFirstOrThrow`) chứ không mock — DB rỗng là nó fail.

Các target khác: `make test-logs` (tail log web), `make test-sh` (shell vào
container web), `make test-dbsh` (psql vào DB test), `make test-build`.

## Cách nó hoạt động

`docker-compose.test.yml` khai báo `name: learning-english-test`, nên Docker
tạo network/container riêng và hai stack không biết đến nhau. Nó dùng lại
chính `web/Dockerfile`:

- service `web` → `target: runner` (đúng image như prod, để smoke-test cái sẽ ship);
- service `vitest` → `target: test`, một stage kế thừa `builder` nên có sẵn
  devDependencies + `vitest.config.ts`. Stage này nằm trong profile `tools`, chỉ
  chạy one-shot qua `docker compose run --rm`, và **không** làm nặng image prod.

## Lưu ý

- `make down` / `make clean` là của **prod**. Muốn hạ stack test thì dùng
  `make test-down`.
- Đăng nhập Google ở `localhost:3100` chỉ chạy nếu bạn điền `AUTH_GOOGLE_ID` /
  `AUTH_GOOGLE_SECRET` vào `.env.test` **và** thêm
  `http://localhost:3100/api/auth/callback/google` vào Authorized redirect URIs
  của OAuth client trong Google Cloud Console.
- `.env.test` là file local, đã nằm trong `.gitignore`; chỉ `.env.test.example`
  được commit.
