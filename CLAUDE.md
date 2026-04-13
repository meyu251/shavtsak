# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

**שבצק** — a Hebrew RTL web app for military unit force assignment. Commanders use it to manage soldiers, define task templates, and build daily schedules. Built for a single company (פלוגה).

## Commands

```bash
npm run dev      # dev server on localhost:3000
npm run build    # production build (also runs TypeScript check)
npm run lint     # ESLint
```

No test suite yet. Use `npm run build` to catch type errors before pushing.

## Architecture

**All pages are `"use client"`** — the app uses `localStorage` exclusively (no backend). Server Components are not used anywhere.

### Data layer (`lib/`)

| File | Purpose |
|------|---------|
| `types.ts` | All TypeScript interfaces and union types |
| `store.ts` | `loadData()` / `saveData()` + CRUD helpers. Contains `defaultData` (demo soldiers/tasks). Includes a migration in `loadData()` that converts old `name` field → `firstName`/`lastName`. |
| `permissions.ts` | Pure functions for permission checks + display labels. No state. |
| `useAuth.ts` | React hook — reads `shavtsak_current_user` from localStorage, redirects to `/login` if missing/invalid, exposes `currentUser: Soldier` and `logout()`. |

### Key data model

```typescript
Soldier {
  firstName, lastName, phone, rank, role, teamId,
  isActive, personalNumber, idNumber, address, birthDate,  // private fields
  permissionLevel: 'soldier' | 'team_commander' | 'company_commander',
  extraPermissions: ('extended_data' | 'management')[]
}
AppData { soldiers, teams, taskTemplates, assignments }
```

Two localStorage keys: `shavtsak_data` (all app data) and `shavtsak_current_user` (`{ soldierId }` of who is logged in).

### Permission system

Defined entirely in `lib/permissions.ts`. Three base levels set per soldier; two extra permissions granted manually:

- `company_commander` → sees/edits everything, grants anything to anyone
- `team_commander` → full details for own team only; grants to own team only
- `soldier` → sees names + phones of the whole company
- `extended_data` (extra) → sees full details of everyone, cannot grant
- `management` (extra) → `extended_data` + can grant permissions within own team

**Always check `permissions.ts` functions** (`canEditSoldier`, `canSeeFullDetails`, etc.) rather than checking `permissionLevel` directly in components.

### Shared UI

`components/AppHeader.tsx` — used by every page. Accepts `currentUser`, `onLogout`, optional `backHref`, `title`, and `actions` slot. Do not build page-level headers from scratch.

### Auth flow

`/login` → pick a soldier from the list (mock auth, no passwords) → saved to `shavtsak_current_user` → redirect to `/`. If no soldiers exist, shows a first-time setup form to create the first `company_commander`. Every protected page calls `useAuth()` and renders `null` while redirecting.

## Conventions

- **RTL everywhere.** Only add `dir="ltr"` to specific inputs that need it (phone, time, date, ID numbers).
- **Tailwind only** — no separate CSS files.
- When adding fields to `Soldier` or `AppData`, also update `defaultData` in `store.ts` and add a migration guard in `loadData()` so existing localStorage data doesn't break.
- The `Rank` union type in `types.ts` is the single source of truth for rank names. The `RANKS` array in `soldiers/page.tsx` must stay in sync with it.

## Roadmap

- [ ] Real auth with Google OAuth
- [ ] Cloud database (replacing localStorage)
- [ ] Role-based permissions enforced server-side
- [ ] Team management UI
- [ ] Daily schedule export (PDF / Excel)
- [ ] Week view for schedule
