"""
main.py — נקודת הכניסה של השרת.
כאן מגדירים את האפליקציה ורושמים את כל ה-routes.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routers import auth, soldiers, sections, tasks, assignments, contacts

# יצירת כל הטבלאות ב-DB אם לא קיימות
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="שבצק API",
    description="בקאנד לאפליקציית שיבוץ יחידתי",
    version="1.0.0",
)

# CORS — מאפשר לפרונטאנד Next.js לדבר עם הבקאנד
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # כתובת הפרונטאנד בפיתוח
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# רישום כל ה-routers
app.include_router(auth.router)
app.include_router(soldiers.router)
app.include_router(sections.router)
app.include_router(tasks.router)
app.include_router(assignments.router)
app.include_router(contacts.router)


@app.get("/")
def root():
    return {"status": "ok", "message": "שבצק API פועל"}
