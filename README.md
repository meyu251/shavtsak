# Shavtsak

Hebrew RTL web app for military unit force scheduling.
Full-stack monorepo: Next.js frontend + FastAPI backend.

## Starting the dev environment

Run both servers in parallel (two terminals):

### Backend
```bash
cd shavtsak-backend
venv\Scripts\activate
uvicorn app.main:app --reload
```
Runs on: http://localhost:8000

### Frontend
```bash
cd shavtsak-app
npm run dev
```
Runs on: http://localhost:3000

---

## After pulling / new migration

```bash
cd shavtsak-backend
venv\Scripts\activate
python -m alembic upgrade head
```

## Demo data (fresh database)

Run on an empty PostgreSQL database (set `DATABASE_URL` in `shavtsak-backend/.env`):

```bash
cd shavtsak-backend
venv\Scripts\activate
python -m alembic upgrade head
python seed.py
```

All demo users log in on the regular login screen with password `123456`:

| Personal number | User | Role |
|---|---|---|
| 1000001 | מאיר יוסט | Company commander (פלוגה א), has the DEV impersonation panel |
| 1000002 | ניר לוסטיג | Section commander, מחלקה 1 |
| 1000003 | מיכאל ירט | Section commander, מחלקה 2 |
| 1000004–1000008 | | Soldiers |
| 1000009 | דנה כהן | Section commander of a separate, independent unit (to check data isolation) |

The DEV button (top of every inner page, for 1000001) lets you switch to any user without logging out.

### Google login

Google sends users back to `GOOGLE_REDIRECT_URI` (default `BACKEND_URL/auth/google/callback`). In production set it on Render to `https://shavtsack.vercel.app/auth/google/callback` and add the same URL in Google Cloud Console → Credentials → OAuth client → Authorized redirect URIs. Vercel forwards that path to the backend (`next.config.ts`), so the Google window shows the site address instead of the Render address.

### Windows shortcuts

- `update.bat` — after every update: git pull, backend packages, database migrations, optional demo reset (asks first), frontend build.
- `start.bat` — opens the backend and the frontend in two windows and opens http://localhost:3000.

Join code of פלוגה א: `DEMO2026`. Log in as 1000009 (independent section), open "ניהול כוח אדם" and enter it to join the company.

Soldier signup codes: `SOLD2026` (פלוגה א) and `SOLD2027` (the independent section). A soldier the commander already added signs up with their personal number plus this code, then lands on the profile page to fill in missing details.

## Tests

The backend has user-story tests in `shavtsak-backend/tests` (login, Google linking, isolation between units,
permissions per role, schedule, phonebook, joining a company, data migrations).
They need an **empty, test-only** PostgreSQL database (every test wipes it):

```bash
cd shavtsak-backend
venv\Scripts\activate
pip install -r requirements-dev.txt
set TEST_DATABASE_URL=postgresql://...shavtsak_test...   # PowerShell: $env:TEST_DATABASE_URL="..."
pytest
```

## Local network (phone testing)

```bash
# Backend
uvicorn app.main:app --reload --host 0.0.0.0

# Frontend (from shavtsak-app/)
npm run dev -- --experimental-https=false
```

## One-time: grant developer access

To enable the impersonation dev panel for your account, run once after first Google login:

```bash
cd shavtsak-backend
venv\Scripts\activate
python -c "
from app.database import SessionLocal
from app import models
db = SessionLocal()
user = db.query(models.User).filter(models.User.email == 'YOUR_EMAIL').first()
user.is_developer = True
db.commit()
print('Done')
db.close()
"
```
