# Tizhooshan API server

NestJS + Prisma + PostgreSQL. It implements the contract in
[`../src/practice/api.ts`](../src/practice/api.ts): sign-in by SMS code for
parents and teachers, children's profiles, batched answers (graded again on
the server), the parent report, the next session, the daily challenge,
classrooms, assignments and the class skill map.

The app works fully offline; the server is only for syncing, the parent
report on another device and the teacher panel.

## How the shared code is used

The server does **not** reimplement any practice logic. It imports the
app's pure files from `../src` through one module,
[`src/shared/practice.ts`](src/shared/practice.ts):

| What | Shared function |
| --- | --- |
| Grading an answer again | `adapterFor(tool).grade(type, level, seed, response)` (`src/practice/adapters.ts`) |
| Score | `scoreOf` (`adaptive.ts`) |
| Skill states and the mistake notebook | `answer()` (`record.ts`): new answers are replayed onto the saved state; answers that arrive out of order (a second device) replay the child's whole history. Both give exactly the same state (θ is stored and read as text so no digit is lost) |
| Stage shown to teachers and parents | `stageOf` (never θ) |
| Next session | `planSession` (`session.ts`) with `SKILLS` (`catalog.ts`) |
| Daily challenge | `dailyChallenge(SKILLS, day)` (`rewards.ts`) |
| Parent report | `buildReport` (`report.ts`) |

Build: `tsc` compiles `server/src` **and** the shared files it reaches
(`rootDir` is the repository root, the `@/*` alias maps to `../src/*`),
then `tsc-alias` rewrites the alias to relative paths. Output:
`dist/server/src/main.js` and `dist/src/...`. Whatever
`src/practice/adapters.ts` exports at build time is what the server grades
with. Some adapters import helpers from `.tsx` files, so `react` is a
runtime dependency (only its JSX runtime module is loaded; nothing renders).

## Run locally (Windows, macOS or Linux)

Needs Node 20.12+ and Docker.

```sh
cd server
cp .env.example .env        # already set for local use
npm install
npm run db:up               # PostgreSQL 16 in Docker: container "tizhooshan-postgres", host port 5434
npm run db:migrate          # apply migrations to the dev database
npm run dev                 # API on http://localhost:3200/v1 (restarts on changes)
```

Sign-in codes are not sent anywhere in development: the log shows
`OTP for 0912***4567: 123456`.

Point the app at the server by building/running it with
`NEXT_PUBLIC_API_URL=http://localhost:3200`.

Other scripts:

| Script | What it does |
| --- | --- |
| `npm run build` / `npm start` | Compile to `dist/` and run the compiled server |
| `npm test` | e2e tests against the real PostgreSQL (database `tizhooshan_test`, wiped by the tests; the container must be up) |
| `npm run db:migrate:dev -- --name <change>` | After editing `prisma/schema.prisma`: create a new migration |
| `npm run db:reset` | Drop and recreate the dev database (all data lost) |
| `npm run db:down` | Stop the container (data stays in the `tizhooshan_tizhooshan-pg` volume) |

### Environment

| Variable | Default | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | — | PostgreSQL connection (port 5434 locally) |
| `TEST_DATABASE_URL` | `…/tizhooshan_test` | Used by `npm test` only |
| `PORT` | `3200` | API port |
| `CORS_ORIGINS` | `http://localhost:3100,http://localhost:3217` | App origins allowed to call the API |
| `SMS_SENDER` | `dev` | `dev` logs the code (masked phone). `kavenegar` is a **stub** of a real provider and throws until implemented (`src/auth/sms.ts`) |
| `SMS_API_KEY` | — | Key for the real provider |
| `OTP_SECRET` | — | Secret in the code hashes; long and random in production |
| `TRUST_PROXY` | — | Set to `1` behind one reverse proxy (needed for the request limits: otherwise every request comes from the proxy) |
| `RATE_LIMIT_PER_MIN` | `600` | Requests per minute from one address (a whole school may share one) |
| `RATE_LIMIT_AUTH_PER_MIN` | `30` | Sign-in requests per minute from one address, on top of 3 codes per phone per 10 minutes |
| `TZ` | system | Server calendar (assignment due dates); `Asia/Tehran` |

## Deploy on a rented Linux server with Docker

1. Install Docker Engine and the compose plugin; point a domain (say
   `api.example.ir`) at the server.
2. Copy the repository (at least `src/` and `server/`) to the server.
3. Secrets:
   ```sh
   cp server/.env.production.example server/.env.production
   # set POSTGRES_PASSWORD, OTP_SECRET (e.g. `openssl rand -base64 32`), CORS_ORIGINS=https://<app domain>
   ```
4. Start the database and the API (the API applies migrations on start):
   ```sh
   docker compose -f server/docker-compose.prod.yml --env-file server/.env.production up -d --build
   docker compose -f server/docker-compose.prod.yml logs -f api
   ```
   The API listens on `127.0.0.1:3200` only; PostgreSQL is not published at all.
5. TLS in front, e.g. Caddy (`/etc/caddy/Caddyfile`):
   ```
   api.example.ir {
     reverse_proxy 127.0.0.1:3200
   }
   ```
6. Build the app with `NEXT_PUBLIC_API_URL=https://api.example.ir`.
7. Backups: `docker compose -f server/docker-compose.prod.yml exec db pg_dump -U tizhooshan tizhooshan > backup.sql`
   (they contain children's data: keep them encrypted, delete old ones).

Updating: pull the new code and run step 4 again.

The image alone: `docker build -f server/Dockerfile -t tizhooshan-api .`
from the repository root.

## Privacy

- No third-party services, no analytics. The only outgoing call will be
  the SMS provider once it is implemented.
- Stored about a child: nickname, avatar index, grade, birth year, daily
  limit, and the answers (how to rebuild each question, never the
  question). No full name, no birth date.
- Codes and tokens are stored only as hashes. Logs never contain a full
  phone number, a token, a nickname or a request body; database errors are
  logged by code only.
- `DELETE /v1/me` removes the user, their children, every answer, state,
  notebook entry, class membership, token and sign-in code (cascades in the
  schema). `DELETE /v1/children/:id` does the same for one child.
- Access control is checked twice. The application scopes each query to
  the signed-in parent or teacher, and PostgreSQL row-level security
  (migration `20261120140000_row_level_security`) enforces the same rules
  in the database: every signed-in request runs in one transaction as the
  role `tizhooshan_app` with the user's id set, so even a query that forgot
  its filter sees only that user's rows. A parent sees their own children
  and everything about them; a teacher sees their own classrooms, the
  children in them (nickname, picture, grade) and those children's answers
  from the day they joined. Sign-in tables are closed to the role. Sign-in,
  the token check, account deletion and the join-code lookup use the
  connecting user, which the rules do not limit.
- The migration creates the role `tizhooshan_app` (no login, no password),
  so the database user must be allowed to create roles. The Docker images'
  user is a superuser; on a managed database give the user `CREATEROLE`.
- Requests per address are limited (`RATE_LIMIT_PER_MIN`,
  `RATE_LIMIT_AUTH_PER_MIN`); past the limit the API answers `429`
  `{ "error": "rate_limited" }` with `Retry-After`. The counts are in the
  API process's memory, which fits the single API container.

## API notes beyond the contract

- Error codes: `bad_phone`, `bad_code`, `expired`, `too_many_tries`,
  `rate_limited`, `unauthorized`, `forbidden`, `not_found`, `bad_request`,
  `bad_json`, `payload_too_large`, `id_mismatch`, `too_many`, `bad_date`,
  `unknown_skill`, `bad_join_code`, `internal`.
- Rejection reasons in a batch: `malformed`, `unknown_child`,
  `unknown_tool`, `unknown_type`, `unknown_level`.
- Another parent's child, or another teacher's classroom, answers 404
  (`not_found`) so ids cannot be probed; `PUT` of a child id owned by
  someone else answers 403.
- `GET /v1/children/:id/session?assignment=<id>` draws only from that
  assignment's skills (as the app does for assignments).
- Trusted grading: the server's own tag is used for the state, report and
  heatmap when the device's `generatorVersion` equals the server's adapter
  version; otherwise (older app) the device's tag is used, because the
  server may rebuild a different question from the same seed. Both are
  stored.
- Review answers: an attempt does not carry the notebook entry it answered
  (the session item's `reviewOf` is not part of `Attempt`), so the replay
  matches a review answer to the longest-due entry of the same skill and
  level (then any due entry of the skill). Adding `reviewOf` to `Attempt`
  would make this exact.
- Heatmap: `answers` counts only answers given since the child joined the
  classroom (`createdAt >= joinedAt`); `stage` is `stageOf` of the child's
  current state for that skill.
