# جعبه‌ابزار تیزهوشان (Tizhooshan toolkit)

21 interactive tools, practice, mock exams and child profiles for the
Iranian gifted-school (تیزهوشان) entrance exam, grades 4–6. Persian, right to
left, works offline (installable web app).

- **App:** Next.js 16 static export, React 19, TypeScript, Vitest (this folder).
- **API server (optional):** NestJS + Prisma + PostgreSQL in [`server/`](server/README.md).
  The app works fully without it; the server only adds sign-in by SMS code,
  syncing between devices, the parent report on another device and the teacher panel.

## Requirements

- Node.js 20 or newer (tested with 20.19) and npm
- Git
- Only for the API server: Docker Desktop

## Run the app

```bash
git clone <repository URL> tizhooshan
cd tizhooshan
npm install
npm run dev
```

Open <http://localhost:3100>. Register a child (only a name is needed) and
the tools open. Everything is stored in the browser on that device.

## Run the app with the API server

In one terminal:

```bash
cd server
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
npm install
npm run db:up               # PostgreSQL in Docker on port 5434
npm run db:migrate
npm run dev                 # API on http://localhost:3200/v1
```

In a second terminal, from the project folder:

```bash
# macOS / Linux
NEXT_PUBLIC_API_URL=http://localhost:3200 npm run dev
# Windows PowerShell
$env:NEXT_PUBLIC_API_URL="http://localhost:3200"; npm run dev
```

In development, SMS sign-in codes are not sent; they are written to the
server's log. More in [server/README.md](server/README.md).

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | App on port 3100, reloads on changes |
| `npm test` | Unit tests (Vitest) |
| `npm run lint` | ESLint |
| `npm run build` | Static site in `out/` plus the offline service worker |

Without `NEXT_PUBLIC_API_URL`, the build has no server features and can be
hosted anywhere as static files (for example by dragging `out/` into Netlify).

## Where things are

| Folder | Contents |
| --- | --- |
| `src/app/` | Pages (main page, tools, practice, profile, teacher panel) |
| `src/tools/` | The 21 tools, one folder each |
| `src/generators/` | Question generators |
| `src/practice/` | Practice engine, exams, profile, on-device storage |
| `src/toolkit/`, `src/engine-2d/`, `src/engine-3d/` | Shared tool layout and drawing engines |
| `server/` | API server |
| `docs/` | Plans and status (`phase2-plan.md`, `phase1-remaining.md`) |

## Privacy

Children's answers stay on the device unless a parent links an account. A
child's photo never leaves the device.
