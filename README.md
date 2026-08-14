# NestJS Microservices Reference Architecture

A production-shaped NestJS monorepo showing how asynchronous microservices fit together: RabbitMQ messaging
with manual acks, JWT access and refresh authentication, a MongoDB replica set, Elasticsearch search, and
Prometheus metrics. One stack, wired end to end, that boots with `docker compose up`.

> **What this is:** an opinionated reference architecture and starting point, not a finished product. It
> exists to show how the pieces fit together with correct boundaries, messaging semantics and auth flow.
> Scope is called out honestly in [Status & scope](#status--scope) below.

---

## Architecture at a glance

```mermaid
flowchart LR
  Client([Client]) -->|HTTP :3000| Orders

  subgraph Services["NestJS monorepo (apps/)"]
    Orders["orders<br/>HTTP API gateway"]
    Billing["billing<br/>event consumer"]
    Auth["auth<br/>JWT access + refresh"]
    User["user<br/>Mongoose CRUD"]
    Metrics["metrics<br/>Prometheus + logging"]
  end

  Orders -->|emit 'place-order' / send 'fetch-orders'| RMQ[(RabbitMQ)]
  RMQ --> Billing
  Auth -->|verify / issue tokens| User

  Orders -->|index / query| ES[(Elasticsearch)]
  Orders --> Mongo[(MongoDB<br/>replica set)]
  User --> Mongo
  Billing -->|invoices| PG[(PostgreSQL<br/>Prisma)]

  Metrics -.->|/metrics scrape| Prom{{Prometheus}}

  classDef svc fill:#1f2937,stroke:#4b5563,color:#e5e7eb;
  class Orders,Billing,Auth,User,Metrics svc;
```

**The messaging pattern:** `orders` talks to `billing` two ways over RabbitMQ.

- `client.emit('place-order', order)` is fire-and-forget, because no response is needed.
- `client.send({ cmd: 'fetch-orders' }, {})` is request/response, returning an RxJS `Observable`.

Messages are `persistent` with manual `ack` (`noAck: false`), so nothing is lost on consumer restart.

### Idempotent consumers

RabbitMQ guarantees at-least-once delivery, so a duplicate `place-order` event is a certainty rather than an
edge case, and a consumer that naively inserts would double-bill. `billing` therefore keys every invoice to
the producer-assigned `orderId` behind a unique index, and treats a unique-violation on insert as success.
The database is the guard, not the application. Two consumers can race, exactly one wins, and the loser's
message is still acked.

```bash
curl -X POST localhost:3000/place-order -H 'Content-Type: application/json' \
  -d '{"name":"Widget","quantity":3,"unitPriceCents":1250}'
# => {"message":"Order placed successfully","orderId":"d9e1400c-…"}

docker compose exec postgres psql -U billing -d billing -c 'SELECT * FROM invoices;'
# => one row: 3 x Widget, amount_cents = 3750
```

Replay that exact message on the queue (RabbitMQ UI at `localhost:15672`, guest/guest) and billing logs
`already invoiced — duplicate delivery ignored`. The invoice count stays at 1.

### Failure handling: nack, don't stall

A message that fails for a deterministic reason (bad payload, constraint violation) will fail on every
redelivery, so requeueing it spins hot. Silently not acking is worse. The delivery stays parked on the open
channel, invisible in the queue depth and never retried, until the connection drops. So `billing` nacks with
`requeue: false` onto a dead-letter exchange and declares `billing.dlq` at boot, because a DLX that routes
nowhere discards silently. Poison messages end up somewhere you can read them.

### Why two databases

This is deliberate, not accretion. Invoices are money, so they live in Postgres: ACID writes, a unique
constraint for idempotency, and `CHECK` constraints the database enforces even if application code is
bypassed. Amounts are stored as integer cents, never floats. Orders are documents, schema-loose and
read-heavy, so they stay in MongoDB and fan out to Elasticsearch. The two services share no database and
communicate only over RabbitMQ.

---

## Services

| App | Role | Highlights |
|---|---|---|
| **orders** | HTTP API gateway (`:3000`) | Places/fetches orders; emits + sends to `billing` over RabbitMQ; Elasticsearch search |
| **billing** | Async consumer | Consumes order events from RabbitMQ (decoupled from the request path); writes an idempotent invoice ledger to Postgres via Prisma |
| **auth** | Authentication | JWT access + refresh tokens, Passport (local / jwt / jwt-refresh), bcrypt, refresh-token rotation stored hashed, `httpOnly`+`secure` cookies |
| **user** | User domain | Mongoose user schema + CRUD (consumed by `auth`) |
| **metrics** | Observability | Prometheus metrics (`@willsoto/nestjs-prometheus`) + a request logging interceptor |
| **libs/common** | Shared kernel | `RmqService` (connection/ack), Mongoose DB module + base schema, Elasticsearch search module, order observer/subscriber |

---

## Tech stack

**Runtime:** NestJS 11 · TypeScript 5 · Node · RxJS
**Messaging:** RabbitMQ (`amqplib` + `amqp-connection-manager`, `@nestjs/microservices` `Transport.RMQ`)
**Data:** MongoDB (Mongoose) as a replica set (primary / secondary / arbiter) · PostgreSQL 16 + Prisma (billing ledger) · Elasticsearch 8
**Auth:** `@nestjs/jwt` · Passport (local + JWT + JWT-refresh) · bcrypt · httpOnly cookies
**Validation/config:** `class-validator` · Joi · `@nestjs/config`
**Observability:** Prometheus (`prom-client`) · logging interceptor · Swagger (`@nestjs/swagger`)
**Testing/CI:** Jest · GitHub Actions (`.github/workflows/ci.yml`, build + test on push and pull request)
**Ops:** Docker Compose (per-service Dockerfiles, dev target)

---

## Quickstart

**Prerequisites:** Docker + Docker Compose.

```bash
# 1. Clone
git clone <this-repo-url> && cd base-template-nestjs

# 2. Environment
# Root and per-service .env files are gitignored (never committed).
# Copy the examples and fill in values (see "Environment" below).
cp .env.example .env                      # then edit
cp apps/orders/.env.example  apps/orders/.env
cp apps/billing/.env.example apps/billing/.env

# 3. Run the stack (orders API + billing consumer + RabbitMQ + Mongo replica set)
docker compose up --build
```

Then:
- **Orders API** → http://localhost:3000 (health check: http://localhost:3000/health)
- **RabbitMQ** → amqp://localhost:5672 · management UI → http://localhost:15672 (`guest`/`guest`)
- **MongoDB** (replica set) → mongodb://localhost:27017
- **Elasticsearch** → http://localhost:9200

> First `docker compose up` pulls Elasticsearch (~1 GB) and boots the Mongo replica set. Give it a minute
> before the orders service reports healthy.

Run locally without Docker (per app):
```bash
npm install
npm run start:dev orders     # or: billing | auth | metrics
npm test                     # Jest suite
```

### Environment
Config is read via `@nestjs/config` (`ConfigService.getOrThrow`), so a missing var fails fast. Typical keys:

| Key | Used by | Example |
|---|---|---|
| `APP_PORT` | orders | `3000` |
| `MONGO_ATLAS_DB_URI` | mongo apps | `mongodb://root:password123@mongodb-primary:27017` |
| `RABBIT_MQ_URI` | orders, billing | `amqp://rabbitmq:5672` |
| `RABBIT_MQ_BILLING_QUEUE` | orders, billing | `billing` |
| `ELASTIC_SEARCH_URL` | orders (search) | `http://elasticsearch:9200` |
| `DATABASE_URL` | billing (invoices) | `postgresql://billing:billing_dev@postgres:5432/billing?schema=public`. Repoint at any hosted Postgres (Neon, RDS) to run against a cloud DB |
| `JWT_SECRET` / `JWT_REFRESH_TOKEN_SECRET` | auth | *(generate your own)* |
| `JWT_EXPIRATION` / `JWT_REFRESH_TOKEN_EXPIRATION` | auth | ms values |

> ⚠️ **Local-dev defaults, not for any network-reachable deployment.** All `.env` files are gitignored.
> - MongoDB passwords in `docker-compose.yml` (`password123`, `replicasetkey123`) are placeholders. Change them for any non-local use.
> - Elasticsearch runs with `xpack.security.enabled=false` (no auth) for local dev. Enable security before exposing `:9200`.
> - The RabbitMQ management UI (`:15672`) uses the default `guest`/`guest` login, so keep it local.
> - The compose publishes DB/broker ports on all interfaces for convenience. Bind them to `127.0.0.1`, or drop them, before running on a shared or routable host.

---

## Project structure
```
apps/
  orders/    HTTP gateway: emits/sends to billing, ES search
  billing/   RabbitMQ consumer
  auth/      JWT access+refresh, Passport strategies, guards
  user/      Mongoose user schema + CRUD
  metrics/   Prometheus + logging interceptor
libs/
  common/    RmqService, DB module + base schema, search (ES), observers
docker-compose.yml   orders + billing + rabbitmq + mongo replica set
```

---

## Status & scope
Honest about what is finished and what is illustrative, because a reference is only useful if you trust its
labels.

- ✅ **Solid:** the RabbitMQ messaging semantics (emit vs send, persistent + manual ack), bcrypt password and
  refresh-token hashing, the Mongo replica-set compose, the monorepo boundaries and shared `libs/common`.
  Billing's idempotency, its dead-lettering and log sanitization are covered by a Jest suite that runs in CI
  on every push and pull request.
- 🚧 **Scaffolded / illustrative:** the order to Elasticsearch observer/subscriber is written in a TypeORM
  idiom and marked `TODO` to port to Mongoose change-streams. The logging interceptor is a minimal
  before/after stub, and not every app has its own Dockerfile (the compose stack runs `orders` + `billing`).
- ⛔ **Not included:** no Kubernetes manifests. The empty local `k8s/` directory is untracked, so a clone
  will not contain it.

### Demo status & security
> **This is a reference and demo, not production-hardened. Don't deploy it with real data.** A July 2026
> review of the auth path produced the fixes below.

**Fixed (2026-07):**
- Login and refresh now work. The `CurrentUser` decorator was missing its `return`, and the refresh-cookie
  name is now aligned (`Refresh`).
- User responses no longer expose password or refresh-token hashes. A schema `toJSON`/`toObject` transform
  strips them from all serialized output, while auth still reads them from the live document.
- Auth cookies set an explicit `sameSite: 'lax'`, and the deprecated, unused legacy `elasticsearch` client
  was removed.

**Remaining (documented demo limitations, to do before any real deployment):**
- The auto-generated `User` CRUD (`ncrudify`) is guarded by authentication only, so it still allows
  cross-account writes with no object-level authZ. Gate it behind an owner or role check, or hand-write the
  endpoints. (`ncrudify` is v1.x with a single maintainer: fine for a demo, worth replacing for production.)
- `orders` HTTP endpoints have no auth guard, and the search `?q` param is unvalidated.
- Run `npm audit fix` (non-breaking). The toolchain has known advisories.

---

## License
UNLICENSED. Reference and portfolio use.
