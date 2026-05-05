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
