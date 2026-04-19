import os
import httpx
from urllib.parse import urlencode
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.auth import create_token, get_current_soldier
import uuid

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
        managedCompanyId=s.managed_company_id,
    )


# ── כניסה רגילה (בחירת חייל מרשימה — לפיתוח בלבד) ────────────────────────────

@router.post("/login", response_model=schemas.TokenOut)
def login(body: schemas.LoginRequest, db: Session = Depends(get_db)):
    """כניסה ישירה עם soldierId — לסביבת פיתוח בלבד. מחזיר JWT."""
    soldier = db.query(models.Soldier).filter(models.Soldier.id == body.soldierId).first()
    if not soldier:
        raise HTTPException(status_code=404, detail="חייל לא נמצא")
    token = create_token(soldier.id)
    return schemas.TokenOut(access_token=token, soldier=soldier_to_out(soldier))


# ── מי אני? (לאחר כניסה) ─────────────────────────────────────────────────────

@router.get("/me", response_model=schemas.SoldierOut)
def get_me(current_soldier: models.Soldier = Depends(get_current_soldier)):
    """מחזיר את פרטי החייל המחובר לפי ה-JWT."""
    return soldier_to_out(current_soldier)


# ── Claiming — קישור User לחייל קיים ─────────────────────────────────────────

@router.post("/claim", response_model=schemas.TokenOut)
def claim_soldier(body: schemas.ClaimRequest, db: Session = Depends(get_db)):
    """
    מקשר User קיים לחייל לפי מספר אישי או תעודת זהות.
    מחזיר JWT עבור החייל המקושר.
    """
    if not body.personalNumber and not body.idNumber:
        raise HTTPException(status_code=400, detail="יש לספק מספר אישי או תעודת זהות")

    user = db.query(models.User).filter(models.User.id == body.userId).first()
    if not user:
        raise HTTPException(status_code=404, detail="משתמש לא נמצא")
    if user.soldier_id:
        raise HTTPException(status_code=400, detail="משתמש כבר מקושר לחייל")

    # חיפוש חייל לפי מספר אישי (עדיפות), אחר כך לפי ת"ז
    soldier = None
    if body.personalNumber:
        soldier = db.query(models.Soldier).filter(
            models.Soldier.personalNumber == body.personalNumber.strip()
        ).first()
    if not soldier and body.idNumber:
        soldier = db.query(models.Soldier).filter(
            models.Soldier.idNumber == body.idNumber.strip()
        ).first()

    if not soldier:
        raise HTTPException(status_code=404, detail="לא נמצא חייל עם המספר שהוזן")

    # בדיקה שהחייל לא כבר תפוס על ידי משתמש אחר
    existing = db.query(models.User).filter(
        models.User.soldier_id == soldier.id
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="חייל זה כבר מקושר למשתמש אחר — פנה למפקד")

    user.soldier_id = soldier.id
    db.commit()

    token = create_token(soldier.id)
    return schemas.TokenOut(access_token=token, soldier=soldier_to_out(soldier))


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
    """
    Google מפנה לכאן לאחר שהמשתמש אישר.
    תזרים:
      1. החלפת קוד ב-access_token
      2. שליפת email + google_sub מ-Google
      3. מציאה/יצירה של User לפי google_sub (fallback: email)
      4. אם User כבר קשור לחייל → JWT וחזרה לפרונט
         אם לא → הפנייה לדף claiming
    """
    if error or not code:
        return RedirectResponse(f"{FRONTEND_URL}/login?error=google_cancelled")

    async with httpx.AsyncClient() as client:
        # 1. החלפת קוד
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

        # 2. שליפת פרטי משתמש מ-Google
        # Google v2 userinfo מחזיר "id" (לא "sub") כ-Google user ID
        userinfo_res = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if userinfo_res.status_code != 200:
            return RedirectResponse(f"{FRONTEND_URL}/login?error=google_error")

        userinfo = userinfo_res.json()
        email = userinfo.get("email")
        google_sub = userinfo.get("id")   # "id" ב-v2, זה הוא Google user ID

        if not email:
            return RedirectResponse(f"{FRONTEND_URL}/login?error=no_email")

    # 3. מציאה/יצירה של User
    user = None
    if google_sub:
        user = db.query(models.User).filter(models.User.google_sub == google_sub).first()
    if not user and email:
        user = db.query(models.User).filter(models.User.email == email).first()

    if not user:
        # יצירת User חדש — עדיין לא מקושר לחייל
        user = models.User(
            id=str(uuid.uuid4()),
            email=email,
            google_sub=google_sub,
            soldier_id=None,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    elif google_sub and not user.google_sub:
        # עדכון google_sub אם נמצא לפי email בלבד
        user.google_sub = google_sub
        db.commit()

    # 4. אם מקושר לחייל — JWT וחזרה
    if user.soldier_id:
        jwt = create_token(user.soldier_id)
        return RedirectResponse(f"{FRONTEND_URL}/login?token={jwt}")

    # אחרת — הפנייה לדף claiming
    return RedirectResponse(f"{FRONTEND_URL}/login?step=claim&userId={user.id}")
