.PHONY: help env build up down restart logs ps sh dbsh migrate seed seed-all bootstrap clean

COMPOSE := docker compose

help:
	@echo "make bootstrap   - first-time setup: build, start db+web, migrate, seed everything"
	@echo "make up          - build (if needed) and start db + web"
	@echo "make down        - stop containers (keeps the database volume)"
	@echo "make restart     - down, then up"
	@echo "make logs        - tail web logs (OTP codes print here, OTP_DEV_ECHO=true)"
	@echo "make migrate     - apply Prisma migrations against the compose db"
	@echo "make seed        - seed lessons + vocab + exercises"
	@echo "make seed-all    - seed + seed the placement test + the 30 IELTS tests"
	@echo "make sh          - shell into the web container"
	@echo "make dbsh        - psql into the db container"
	@echo "make clean       - stop and DELETE the database volume (destructive)"

# Creates .env from .env.example on first run, with a freshly generated
# SESSION_SECRET. Every other target depends on this so `make up` etc. work
# standalone on a fresh checkout without a separate setup step.
env:
	@test -f .env || { \
		cp .env.example .env; \
		SECRET=$$(openssl rand -hex 32); \
		sed -i.bak "s/^SESSION_SECRET=.*/SESSION_SECRET=$$SECRET/" .env && rm -f .env.bak; \
		echo "Created .env with a generated SESSION_SECRET."; \
	}

build: env
	$(COMPOSE) build

up: env
	$(COMPOSE) up -d db
	$(COMPOSE) up -d --build web
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
