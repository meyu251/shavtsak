"""
auth.py — יצירה ואימות של JWT tokens.
JWT = JSON Web Token. זה כמו "תג כניסה" דיגיטלי שהשרת מנפיק.
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from app.database import get_db
from app import models

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
ALGORITHM = "HS256"
EXPIRE_HOURS = int(os.getenv("ACCESS_TOKEN_EXPIRE_HOURS", "24"))

security = HTTPBearer()


def create_token(soldier_id: str) -> str:
    """יוצר JWT עם תוקף."""
    expire = datetime.now(timezone.utc) + timedelta(hours=EXPIRE_HOURS)
    payload = {"sub": soldier_id, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_soldier(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> models.Soldier:
    """
    Dependency — מאמת את ה-JWT ומחזיר את החייל המחובר.
    אם הטוקן לא תקין — מחזיר שגיאה 401.
    """
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        soldier_id: Optional[str] = payload.get("sub")
        if soldier_id is None:
            raise ValueError("missing sub")
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="טוקן לא תקין או פג תוקף",
            headers={"WWW-Authenticate": "Bearer"},
        )

    soldier = db.query(models.Soldier).filter(models.Soldier.id == soldier_id).first()
    if not soldier:
        raise HTTPException(status_code=404, detail="חייל לא נמצא")
    return soldier
