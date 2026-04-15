import os
import httpx
from urllib.parse import urlencode
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.auth import create_token, get_current_soldier

router = APIRouter(prefix="/auth", tags=["auth"])

GOOGLE_CLIENT_ID     = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
FRONTEND_URL         = os.getenv("FRONTEND_URL", "http://localhost:3000")
BACKEND_URL          = os.getenv("BACKEND_URL", "http://localhost:8000")

GOOGLE_AUTH_URL     = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL    = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


def soldier_to_out(s: models.Soldier) -> schemas.SoldierOut:
    return schemas.SoldierOut(
        id=s.id,
        firstName=s.firstName,
        lastName=s.lastName,
        phone=s.phone,
        role=s.role,
        rank=s.rank,
        isActive=s.isActive,
        sectionId=s.sectionId,
        personalNumber=s.personalNumber,
        idNumber=s.idNumber,
        address=s.address,
        birthDate=s.birthDate,
        permissionLevel=s.permissionLevel,
        extraPermissions=[ep.permission for ep in s.extra_permissions],
        email=s.email,
    )


# ── כניסה רגילה (בחירת חייל מרשימה) ─────────────────────────────────────────

@router.post("/login", response_model=schemas.TokenOut)
def login(body: schemas.LoginRequest, db: Session = Depends(get_db)):
    """כניסה עם soldierId — מחזיר JWT."""
    soldier = db.query(models.Soldier).filter(models.Soldier.id == body.soldierId).first()
    if not soldier:
        raise HTTPException(status_code=404, detail="חייל לא נמצא")
    token = create_token(soldier.id)
    return schemas.TokenOut(access_token=token, soldier=soldier_to_out(soldier))


# ── מי אני? (לאחר כניסה עם Google) ──────────────────────────────────────────

@router.get("/me", response_model=schemas.SoldierOut)
def get_me(current_soldier: models.Soldier = Depends(get_current_soldier)):
    """מחזיר את פרטי החייל המחובר לפי ה-JWT."""
    return soldier_to_out(current_soldier)


# ── Google OAuth ──────────────────────────────────────────────────────────────

@router.get("/google")
def google_login():
    """מפנה את המשתמש לדף ההסכמה של Google."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google OAuth לא מוגדר בשרת")
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": f"{BACKEND_URL}/auth/google/callback",
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "online",
    }
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")


@router.get("/google/callback")
async def google_callback(
    code: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
):
    """Google מפנה לכאן לאחר שהמשתמש אישר. מחזיר JWT לפרונט."""

    if error or not code:
        return RedirectResponse(f"{FRONTEND_URL}/login?error=google_cancelled")

    async with httpx.AsyncClient() as client:
        # 1. החלפת קוד ב-access token
        token_res = await client.post(GOOGLE_TOKEN_URL, data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": f"{BACKEND_URL}/auth/google/callback",
            "grant_type": "authorization_code",
        })
        if token_res.status_code != 200:
            return RedirectResponse(f"{FRONTEND_URL}/login?error=google_error")

        access_token = token_res.json().get("access_token")

        # 2. שליפת המייל של המשתמש מ-Google
        userinfo_res = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if userinfo_res.status_code != 200:
            return RedirectResponse(f"{FRONTEND_URL}/login?error=google_error")

        email = userinfo_res.json().get("email")
        if not email:
            return RedirectResponse(f"{FRONTEND_URL}/login?error=no_email")

    # 3. חיפוש חייל לפי מייל בDB
    soldier = db.query(models.Soldier).filter(models.Soldier.email == email).first()
    if not soldier:
        # מייל לא רשום — מפנים לדף שגיאה עם המייל
        return RedirectResponse(
            f"{FRONTEND_URL}/login?error=not_registered&email={email}"
        )

    # 4. יצירת JWT והפניה לפרונט
    jwt = create_token(soldier.id)
    return RedirectResponse(f"{FRONTEND_URL}/login?token={jwt}")
