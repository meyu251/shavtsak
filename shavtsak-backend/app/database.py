"""
database.py — חיבור לבסיס הנתונים SQLite
כל פעם שמישהו שולח בקשה לשרת, נפתחת "session" (חיבור זמני לDB),
ובסוף הבקשה היא נסגרת אוטומטית.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./shavtsak.db")

# Neon/Render נותנים כתובת שמתחילה ב-postgresql:// (או postgres://).
# מ-SQLAlchemy 2.1 ברירת המחדל לכתובת כזו היא הדרייבר psycopg (גרסה 3),
# אבל בפרויקט מותקן psycopg2 — לכן קובעים את הדרייבר במפורש.
for _prefix in ("postgresql://", "postgres://"):
    if DATABASE_URL.startswith(_prefix):
        DATABASE_URL = "postgresql+psycopg2://" + DATABASE_URL[len(_prefix):]
        break

# connect_args רלוונטי רק ל-SQLite — מאפשר שימוש מספר threads
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """Dependency — מחזיר session ל-DB וסוגר אותה בסוף הבקשה."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
