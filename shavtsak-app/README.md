# Shavtsak — Frontend

Next.js 16 + React 19 + TypeScript + Tailwind CSS 4.

This is the frontend package of the Shavtsak monorepo.
See the root `README.md` for full startup instructions.

## Commands

```bash
npm run dev      # dev server on localhost:3000
npm run build    # production build + TypeScript check
npm run lint
```

## Key directories

```
app/             Pages (all "use client")
components/      Shared UI components (AppHeader, Modal, Toast, ...)
lib/             Data layer: types, api, permissions, useAuth, store, timeUtils
```

The backend must be running on `localhost:8000` for API calls to work.
All API calls go through `lib/api.ts` via the `/api/*` proxy defined in `next.config.ts`.
