# CLAUDE.md

@AGENTS.md

## Project
**שבצק** — Hebrew RTL military unit scheduling app.
Stack: Next.js + TypeScript + Tailwind CSS (frontend) + FastAPI + SQLAlchemy + SQLite (backend).
All pages `"use client"`. Backend runs on `http://localhost:8000`.

## Commands
```bash
# Frontend
npm run dev      # localhost:3000
npm run build    # production + TypeScript check (run before finishing)
npm run lint

# Backend
cd ../shavtsak-backend
source venv/bin/activate   # or venv\Scripts\activate on Windows
uvicorn app.main:app --reload   # localhost:8000
```

## Architecture
- **Frontend** calls the FastAPI backend via `lib/api.ts` for all data (soldiers, sections, tasks, assignments, contacts).
- **localStorage** is used only for:
  - `shavtsak_token` — JWT auth token
  - `shavtsak_current_user` — minimal user reference `{ soldierId }`
  - `shavtsak_schedule_order_<userId>` — per-user task order on the schedule page
- `lib/store.ts` handles localStorage auth helpers (`loadCurrentUser`, `saveCurrentUser`) and `menuOrder` persistence. The CRUD helpers in store.ts are legacy and unused.

## Data layer (`lib/`)
| File | Purpose |
|------|---------|
| `types.ts` | All interfaces — source of truth |
| `store.ts` | `loadCurrentUser()` / `saveCurrentUser()` + `menuOrder` helpers + migrations |
| `api.ts` | All backend API calls — use these for data reads/writes |
| `permissions.ts` | All permission checks — **always use these functions**, never read `permissionLevel` directly in components |
| `useAuth.ts` | Hook: `currentUser: Soldier`, `logout()`. Redirects to `/login` if not logged in. |

## Permissions (quick ref)
`company_commander` → everything · `section_commander` → own section · `soldier` → names+phones  
Extra: `extended_data` (see all details) · `management` (extended_data + grant within own section)

## Conventions
- **RTL everywhere.** `dir="ltr"` only on: phone, time, date, personal ID fields.
- **Tailwind only** — no CSS files.
- Adding fields to `Soldier`: update backend `models.py` + `schemas.py`, and add migration guard in `store.ts:loadData()` if field is also cached locally.
- `Rank` union in `types.ts` = source of truth. Keep `RANKS` array in `soldiers/page.tsx` in sync.
- `AppHeader` (`components/AppHeader.tsx`) on every page — never build custom page headers.
- Stale auth: `useAuth` caches the soldier at login. For fresh permission data, look up the soldier in the `soldiers` state array, not the `currentUser` from `useAuth`.
- Time utilities (generateHours, formatTimeRange) live in `lib/timeUtils.ts`.
