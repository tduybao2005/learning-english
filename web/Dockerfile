# syntax=docker/dockerfile:1
#
# Build context is the REPO ROOT, not web/ — run from the repo root:
#   docker build -f web/Dockerfile -t learning-english-web .
# (docker-compose.yml at the repo root already does this.)
#
# The seed scripts under web/scripts/seed/ resolve curriculum content as
# path.resolve(process.cwd(), "..") from web/, i.e. they expect
# phase_*/ and ielts_practice_tests/ to sit one level above web/ — this
# image replicates that layout under /app.

FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
COPY web/prisma ./prisma
RUN npm ci

FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app/web
COPY --from=deps /app/web/node_modules ./node_modules
COPY web/ ./
# Build only needs a syntactically valid, correctly-shaped URL — Prisma
# Client generation and `next build` never open a real connection. The real
# value is supplied at container runtime via docker-compose's `environment:`.
ENV DATABASE_URL="postgresql://user:password@localhost:5432/db"
ENV DIRECT_URL="postgresql://user:password@localhost:5432/db"
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app/web
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Full node_modules (not just next build's trimmed `.next/standalone` trace)
# so `prisma migrate deploy` / the seed scripts (tsx, prisma CLI) are runnable
# via `docker compose exec web ...` — see the Makefile.
COPY --from=builder /app/web/node_modules ./node_modules
COPY --from=builder /app/web/.next ./.next
COPY --from=builder /app/web/public ./public
COPY --from=builder /app/web/package.json ./package.json
COPY --from=builder /app/web/prisma ./prisma
COPY --from=builder /app/web/scripts ./scripts
# The seed scripts import app modules (e.g. ../../src/lib/db) via relative
# paths and are run with tsx at runtime, not from the compiled .next output —
# so the actual src/ TypeScript sources must be present in the runner image.
COPY --from=builder /app/web/src ./src
COPY --from=builder /app/web/next.config.ts ./next.config.ts
COPY --from=builder /app/web/tsconfig.json ./tsconfig.json
# Listening-set sources (web/content/listening/*.md) — ingest.ts seeds
# ListeningSet from these at runtime; without them the seed silently skips
# listening and the placement wizard shows "Phần nghe hiện chưa sẵn sàng".
COPY --from=builder /app/web/content ./content

# Curriculum content, laid out one level above web/ to match how the seed
# scripts resolve it locally (see comment at the top of this file).
COPY phase_1_foundation /app/phase_1_foundation
COPY phase_2_elementary /app/phase_2_elementary
COPY phase_3_intermediate /app/phase_3_intermediate
COPY phase_4_advanced /app/phase_4_advanced
COPY phase_5_ielts_prep /app/phase_5_ielts_prep
COPY ielts_practice_tests /app/ielts_practice_tests
# Bảng chủ đề từ vựng — cùng lý do bố trí như trên. Thiếu thư mục này thì
# lần `make seed-all` kế tiếp sẽ xoá sạch topicId của mọi từ (loadVocabTopics
# nay ném lỗi thay vì im lặng, nhưng vẫn phải COPY vào image).
COPY vocab_topics /app/vocab_topics

RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000
ENV PORT=3000
CMD ["npm", "run", "start"]

# ---------------------------------------------------------------------------
# Test stage — used ONLY by docker-compose.test.yml (`target: test`).
# Inherits `builder`, which already carries the full web/ tree (vitest.config.ts,
# vitest.setup.ts, src/, scripts/) and the devDependencies from `npm ci`. The
# prod `runner` stage above is untouched, so this adds nothing to the shipped
# image.
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
COPY vocab_topics /app/vocab_topics
ENV NODE_ENV=test
CMD ["npm", "run", "test:ci"]
