# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**שבצק** — Hebrew RTL web app for military unit force scheduling.
Full-stack monorepo: Next.js frontend (`shavtsak-app/`) + FastAPI backend (`shavtsak-backend/`).

## Commands

```bash
# Frontend (run from shavtsak-app/)
npm run dev              # dev server on localhost:3000
npm run build            # production build + TypeScript check — run before finishing
npm run lint

# Backend (run from shavtsak-backend/)
source venv/bin/activate          # Windows: venv\Scripts\activate
uvicorn app.main:app --reload     # API server on localhost:8000

# Expose to local network (phone testing)
npm run dev -- --experimental-https=false    # Next.js (from shavtsak-app/)
uvicorn app.main:app --reload --host 0.0.0.0 # FastAPI

# DB migrations (run from shavtsak-backend/)
alembic revision --autogenerate -m "description"
alembic upgrade head
```

## Architecture

```
shavtsak/
  shavtsak-app/       Next.js 16 + React 19 + TypeScript + Tailwind CSS 4
  shavtsak-backend/   FastAPI + SQLAlchemy + SQLite
```

**Request flow:** Browser → Next.js (`/api/*` proxy) → FastAPI (`localhost:8000/*`)
The proxy is defined in `shavtsak-app/next.config.ts` rewrites. All API calls go through `lib/api.ts`.

**Auth:** JWT (HS256) stored in `localStorage` as `shavtsak_token`. Google OAuth redirects back with `?token=...` and `login/page.tsx` stores it. The `useAuth` hook reads it and redirects to `/login` if missing.

**localStorage keys:**
- `shavtsak_token` — JWT
- `shavtsak_current_user` — `{ soldierId }` reference only
- `shavtsak_schedule_order_<userId>` — per-user task order on schedule page

## Frontend (`shavtsak-app/`)

All pages are `"use client"`. No server components with data fetching.

**Key files in `lib/`:**
| File | Purpose |
|------|---------|
| `types.ts` | All TypeScript interfaces — source of truth for data shapes |
| `api.ts` | All backend API calls — the only place to call the backend |
| `permissions.ts` | Permission checks — always use these, never read `permissionLevel` directly |
| `useAuth.ts` | Hook: `currentUser: Soldier`, `logout()` |
| `store.ts` | localStorage auth helpers + `menuOrder` persistence (CRUD functions here are dead legacy code) |
| `timeUtils.ts` | `generateHours()`, `formatTimeRange()` — shared time utilities |

**Permission levels:** `company_commander` → everything · `section_commander` → own section · `soldier` → names+phones. Extra bits: `extended_data`, `management`.

**Drag-and-drop:** Uses `@dnd-kit/core` + `@dnd-kit/sortable` (touch-compatible). Do not use HTML5 drag API.

**Conventions:**
- RTL everywhere. `dir="ltr"` only on phone, time, date, personal ID fields.
- Tailwind only — no CSS files.
- `AppHeader` component on every page — never build custom page headers.
- Always add `cursor-pointer` to interactive elements.
- For stale auth: look up the soldier in the `soldiers` state array, not `currentUser` from `useAuth`.
- `Rank` union in `types.ts` = source of truth. Keep `RANKS` array in `soldiers/page.tsx` in sync.
- Adding fields to `Soldier`: update backend `models.py` + `schemas.py`, run Alembic migration, add migration guard in `store.ts:loadData()` if also cached locally.

**Mobile layout:** Soldiers page uses 3-level navigation (sections → list → detail). The `mobileShowList` state tracks which column to show on mobile. Desktop shows all 3 columns via `md:` breakpoints.

## Backend (`shavtsak-backend/`)

**Structure:**
```
app/
  main.py        FastAPI app + CORS + router registration
  models.py      SQLAlchemy ORM models (source of truth for DB schema)
  schemas.py     Pydantic request/response schemas
  auth.py        JWT creation + verification
  database.py    SQLAlchemy engine + session + Base
  routers/       auth, soldiers, sections, tasks, assignments, contacts
alembic/         DB migrations (autogenerate from models.py)
seed.py          Initial data seeder
```

**DB:** SQLite (`shavtsak.db`) in development. The schema is managed by Alembic — run `alembic upgrade head` after pulling. Do not use `Base.metadata.create_all()` for schema changes; use migrations.

**Indexes defined at bottom of `models.py`:** `ix_assignment_date`, `ix_soldier_email`, `ix_assignment_soldier_assignment`, `ix_hour_slot_assignment`, `ix_hour_slot_soldier_slot`.

**CORS:** Allows `localhost:3000` and all local IPs matching `http://\d+\.\d+\.\d+\.\d+:3000` (for mobile dev).

**`SECRET_KEY`** for JWT is read from the `SECRET_KEY` env var (defaults to `"dev-secret-key"` — change in production).

## Important notes from AGENTS.md

> This is NOT the Next.js you know. This version (16.2.3) has breaking changes. Read `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
