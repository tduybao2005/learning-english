.PHONY: help env build up down restart logs ps sh dbsh migrate seed seed-all bootstrap clean \
        test-env test-build test-up test-migrate test-seed test-unit test-logs test-sh test-dbsh test-down test-reset

COMPOSE := docker compose

help:
	@echo "make bootstrap   - first-time setup: build, start db+web, migrate, seed everything"
	@echo "make up          - build (if needed) and start db + web"
	@echo "make down        - stop containers (keeps the database volume)"
	@echo "make restart     - down, then up"
	@echo "make logs        - tail web logs"
	@echo "make migrate     - apply Prisma migrations against the compose db"
	@echo "make seed        - seed lessons + vocab + exercises"
	@echo "make seed-all    - seed + seed the placement test + the 30 IELTS tests"
	@echo "make sh          - shell into the web container"
	@echo "make dbsh        - psql into the db container"
	@echo "make clean       - stop and DELETE the database volume (destructive)"
	@echo ""
	@echo "--- Môi trường TEST (cách ly, port 3100/5433, DB ephemeral) ---"
	@echo "make test-up     - dựng stack test + migrate + seed  -> http://localhost:3100"
	@echo "make test-unit   - chạy vitest trong container trên DB sạch"
	@echo "make test-logs   - tail log web của stack test"
	@echo "make test-down   - xoá stack test (DB tmpfs bay theo)"
	@echo "make test-reset  - test-down rồi test-up (DB sạch tinh)"

# Creates .env from .env.example on first run, with a freshly generated
# AUTH_SECRET. Every other target depends on this so `make up` etc. work
# standalone on a fresh checkout without a separate setup step.
env:
	@test -f .env || { \
		cp .env.example .env; \
		SECRET=$$(openssl rand -hex 32); \
		sed -i.bak "s/^AUTH_SECRET=.*/AUTH_SECRET=$$SECRET/" .env && rm -f .env.bak; \
		echo "Created .env with a generated AUTH_SECRET."; \
	}

build: env
	$(COMPOSE) build

up: env
	$(COMPOSE) up -d db
	$(COMPOSE) up -d --build web
	$(COMPOSE) up -d cloudflare
	@echo "Web: http://localhost:$$(grep '^WEB_PORT=' .env | cut -d= -f2 || echo 3000)"
	@echo "First time? Run: make migrate && make seed-all"

down:
	$(COMPOSE) down

restart: down up

logs:
	$(COMPOSE) logs -f web

ps:
	$(COMPOSE) ps

migrate: env
	$(COMPOSE) exec web npx prisma migrate deploy

seed: env
	$(COMPOSE) exec web npx tsx scripts/seed/ingest.ts

seed-all: seed
	$(COMPOSE) exec web npx tsx scripts/seed/seed-placement.ts
	$(COMPOSE) exec web npx tsx scripts/seed/seed-ielts.ts
# Seed vocab là delete+create, nên VocabWord.audioUrl vừa bị xoá sạch. Bước này
# ghi lại cột đó cho mọi từ đã có sẵn file mp3 trong image (public/audio/vocab).
# Từ nào CHƯA có file thì cần chạy `cd web && npm run audio:vocab` ở host (nơi
# có edge-tts) rồi `make build` lại — container không cài edge-tts.
	$(COMPOSE) exec web npx tsx scripts/generate-vocab-audio.ts
# Báo cáo tình trạng phân loại chủ đề (không chặn seed) — để không bao giờ
# seed xong mà không biết còn bao nhiêu từ chưa được gán chủ đề.
	$(COMPOSE) exec web npx tsx scripts/seed/check-vocab-topics.ts

# Cổng kiểm tra nghiêm ngặt cho bộ phân loại chủ đề: thoát 1 nếu có bất kỳ
# từ nào chưa phân loại, mapping trỏ sai chủ đề, mapping thừa (nội dung đã
# đổi), hay chủ đề bị trùng. Chạy trên host, không cần DB.
.PHONY: check-vocab
check-vocab:
	cd web && npx tsx scripts/seed/check-vocab-topics.ts --check

# Full first-run setup: build the image, start Postgres, wait for it to
# accept connections, start the app, migrate, then seed everything.
bootstrap: build
	$(COMPOSE) up -d db
	@echo "Waiting for Postgres..."
	@until $(COMPOSE) exec -T db pg_isready -U $$(grep '^POSTGRES_USER=' .env | cut -d= -f2) >/dev/null 2>&1; do sleep 1; done
	$(COMPOSE) up -d web
	@sleep 3
	$(MAKE) migrate
	$(MAKE) seed-all
	@echo "Ready: http://localhost:$$(grep '^WEB_PORT=' .env | cut -d= -f2 || echo 3000)"

sh:
	$(COMPOSE) exec web sh

dbsh: env
	$(COMPOSE) exec db psql -U $$(grep '^POSTGRES_USER=' .env | cut -d= -f2) -d $$(grep '^POSTGRES_DB=' .env | cut -d= -f2)

# Destructive: also removes the Postgres data volume, not just the containers.
clean:
	$(COMPOSE) down -v

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
# Giống seed-all: seed vocab là delete+create nên phải ghi lại VocabWord.audioUrl.
	$(TEST_COMPOSE) exec web npx tsx scripts/generate-vocab-audio.ts

# Dựng DB sạch, migrate, seed, rồi chạy vitest one-shot trong container test.
# Phải seed: src/app/api/attempts/answers.test.ts là integration test, nó tìm
# bài lesson_08_adjectives thật trong DB (findFirstOrThrow) chứ không mock.
test-unit: test-env
	$(TEST_COMPOSE) up -d db
	@until $(TEST_COMPOSE) exec -T db pg_isready -U $$(grep '^POSTGRES_USER=' .env.test | cut -d= -f2) >/dev/null 2>&1; do sleep 1; done
	$(TEST_COMPOSE) run --rm --build vitest sh -c "npx prisma migrate deploy && npx tsx scripts/seed/ingest.ts && npm run test:ci"

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
