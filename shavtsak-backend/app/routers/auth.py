import os
import httpx
import random
import string
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from app.database import get_db
from app import models, schemas
from app.auth import create_token, get_current_soldier
from app.isolation import create_auto_company
import uuid

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

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
        unitIsAuto=bool(s.section and s.section.company and s.section.company.is_auto),
    )


# ── Password login ───────────────────────────────────────────────────────────

def _find_soldier_by_identifier(identifier: str, db: Session):
    """
    Find soldier by personalNumber or idNumber.
    אם יש כמה חיילים עם אותו מספר (נתונים ישנים), מעדיפים את זה שיש לו חשבון —
    אחרת הכניסה הייתה נכשלת באקראי עם "פרטים שגויים".
    """
    ident = identifier.strip()
    if not ident:
        return None
    for field in (models.Soldier.personalNumber, models.Soldier.idNumber):
        matches = db.query(models.Soldier).filter(field == ident).all()
        if matches:
            for s in matches:
                if db.query(models.User).filter(models.User.soldier_id == s.id).first():
                    return s
            return matches[0]
    return None


@router.post("/register", response_model=schemas.TokenOut)
def register(body: schemas.RegisterRequest, db: Session = Depends(get_db)):
    """First-time registration: find soldier by identifier, create User + set password."""
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="הסיסמא חייבת להכיל לפחות 6 תווים")

    soldier = _find_soldier_by_identifier(body.identifier, db)
    if not soldier:
        raise HTTPException(status_code=404, detail="לא נמצא חייל עם המספר שהוזן")

    user = db.query(models.User).filter(models.User.soldier_id == soldier.id).first()
    if user and user.password_hash:
        raise HTTPException(status_code=409, detail="חשבון כבר קיים — התחבר עם סיסמא או Google")

    if not user:
        user = models.User(
            id=str(uuid.uuid4()),
            soldier_id=soldier.id,
        )
        db.add(user)

    user.password_hash = pwd_context.hash(body.password)
    db.commit()

    token = create_token(soldier.id)
    return schemas.TokenOut(access_token=token, soldier=soldier_to_out(soldier))


@router.post("/password/login", response_model=schemas.TokenOut)
def password_login(body: schemas.PasswordLoginRequest, db: Session = Depends(get_db)):
    """Login with personalNumber/idNumber + password."""
    soldier = _find_soldier_by_identifier(body.identifier, db)
    if not soldier:
        raise HTTPException(status_code=401, detail="פרטים שגויים")

    user = db.query(models.User).filter(models.User.soldier_id == soldier.id).first()
    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="פרטים שגויים")

    if not pwd_context.verify(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="פרטים שגויים")

    token = create_token(soldier.id)
    return schemas.TokenOut(access_token=token, soldier=soldier_to_out(soldier))


@router.post("/password/set")
def set_password(
    body: schemas.SetPasswordRequest,
    current_soldier: models.Soldier = Depends(get_current_soldier),
    db: Session = Depends(get_db),
):
    """Set or change password for the current user."""
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="הסיסמא חייבת להכיל לפחות 6 תווים")

    user = db.query(models.User).filter(models.User.soldier_id == current_soldier.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="משתמש לא נמצא")

    user.password_hash = pwd_context.hash(body.password)
    db.commit()
    return {"ok": True}


# ── Password reset (commander issues code, soldier uses it) ──────────────────

@router.post("/reset-code/create", response_model=schemas.ResetCodeOut)
def create_reset_code(
    body: schemas.ResetCodeCreateRequest,
    current_soldier: models.Soldier = Depends(get_current_soldier),
    db: Session = Depends(get_db),
):
    """
    Commander generates a one-time reset code for a soldier.
    Only section_commander or company_commander can do this.
    """
    if current_soldier.permissionLevel not in ("section_commander", "company_commander"):
        raise HTTPException(status_code=403, detail="אין הרשאה")

    target = db.query(models.Soldier).filter(models.Soldier.id == body.soldierId).first()
    if not target:
        raise HTTPException(status_code=404, detail="חייל לא נמצא")
    # רק לחיילים ביחידה שלך (אחרת מפקד מיחידה אחת יכול להשתלט על חשבון ביחידה אחרת)
    from app import permissions as perms
    perms.require(perms.can_edit_soldier(current_soldier, target, db), "אין הרשאה לאפס סיסמא לחייל זה")

    user = db.query(models.User).filter(models.User.soldier_id == target.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="לחייל זה אין חשבון רשום עדיין")

    # Invalidate previous unused codes for this user
    db.query(models.ResetCode).filter(
        models.ResetCode.user_id == user.id,
        models.ResetCode.used == False,
    ).update({"used": True})

    plain_code = "".join(random.choices(string.digits, k=6))
    reset = models.ResetCode(
        user_id=user.id,
        code_hash=pwd_context.hash(plain_code),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        used=False,
    )
    db.add(reset)
    db.commit()
    return schemas.ResetCodeOut(code=plain_code)


@router.post("/reset-code/use", response_model=schemas.TokenOut)
def use_reset_code(body: schemas.ResetCodeUseRequest, db: Session = Depends(get_db)):
    """Soldier uses the 6-digit code to set a new password."""
    if len(body.newPassword) < 6:
        raise HTTPException(status_code=400, detail="הסיסמא חייבת להכיל לפחות 6 תווים")

    soldier = _find_soldier_by_identifier(body.identifier, db)
    if not soldier:
        raise HTTPException(status_code=401, detail="פרטים שגויים")

    user = db.query(models.User).filter(models.User.soldier_id == soldier.id).first()
    if not user:
        raise HTTPException(status_code=401, detail="פרטים שגויים")

    now = datetime.now(timezone.utc)
    reset = db.query(models.ResetCode).filter(
        models.ResetCode.user_id == user.id,
        models.ResetCode.used == False,
        models.ResetCode.expires_at > now,
    ).order_by(models.ResetCode.expires_at.desc()).first()

    if not reset or not pwd_context.verify(body.code, reset.code_hash):
        raise HTTPException(status_code=401, detail="קוד שגוי או פג תוקף")

    reset.used = True
    user.password_hash = pwd_context.hash(body.newPassword)
    db.commit()

    token = create_token(soldier.id)
    return schemas.TokenOut(access_token=token, soldier=soldier_to_out(soldier))


# ── כניסה רגילה (בחירת חייל מרשימה — לפיתוח בלבד) ────────────────────────────

@router.post("/login", response_model=schemas.TokenOut)
def login(body: schemas.LoginRequest, db: Session = Depends(get_db)):
    """כניסה ישירה עם soldierId — לסביבת פיתוח בלבד. מחזיר JWT."""
    if os.getenv("ENVIRONMENT") == "production":
        raise HTTPException(status_code=404, detail="Not found")
    soldier = db.query(models.Soldier).filter(models.Soldier.id == body.soldierId).first()
    if not soldier:
        raise HTTPException(status_code=404, detail="חייל לא נמצא")
    token = create_token(soldier.id)
    return schemas.TokenOut(access_token=token, soldier=soldier_to_out(soldier))


# ── מי אני? (לאחר כניסה) ─────────────────────────────────────────────────────

@router.get("/me", response_model=schemas.MeOut)
def get_me(
    current_soldier: models.Soldier = Depends(get_current_soldier),
    db: Session = Depends(get_db),
):
    """מחזיר את פרטי החייל המחובר לפי ה-JWT, כולל דגל isDeveloper."""
    user = db.query(models.User).filter(models.User.soldier_id == current_soldier.id).first()
    base = soldier_to_out(current_soldier)
    return schemas.MeOut(
        **base.model_dump(),
        isDeveloper=bool(user and user.is_developer),
        hasPassword=bool(user and user.password_hash),
    )


# ── התחזות למשתמש אחר (מפתח בלבד) ───────────────────────────────────────────

@router.post("/impersonate/{target_soldier_id}", response_model=schemas.TokenOut)
def impersonate(
    target_soldier_id: str,
    current_soldier: models.Soldier = Depends(get_current_soldier),
    db: Session = Depends(get_db),
):
    """מחזיר JWT של חייל אחר — זמין רק למשתמש עם is_developer=True."""
    user = db.query(models.User).filter(models.User.soldier_id == current_soldier.id).first()
    if not user or not user.is_developer:
        raise HTTPException(status_code=403, detail="אין הרשאה להתחזות למשתמש אחר")

    target = db.query(models.Soldier).filter(models.Soldier.id == target_soldier_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="חייל לא נמצא")

    token = create_token(target.id)
    return schemas.TokenOut(access_token=token, soldier=soldier_to_out(target))


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
        soldier = _find_soldier_by_identifier(body.personalNumber, db)
    if not soldier and body.idNumber:
        soldier = _find_soldier_by_identifier(body.idNumber, db)

    if not soldier:
        raise HTTPException(status_code=404, detail="לא נמצא חייל עם המספר שהוזן")

    # החייל כבר מקושר לחשבון אחר (למשל נרשם קודם עם סיסמא).
    # אם המשתמש מוכיח בעלות עם הסיסמא — מחברים את Google לחשבון הקיים.
    existing = db.query(models.User).filter(
        models.User.soldier_id == soldier.id
    ).first()
    if existing:
        if not existing.password_hash:
            raise HTTPException(status_code=409, detail="חייל זה כבר מקושר למשתמש אחר — פנה למפקד")
        if not body.password:
            raise HTTPException(status_code=409, detail="password_required")
        if not pwd_context.verify(body.password, existing.password_hash):
            raise HTTPException(status_code=401, detail="סיסמא שגויה")
        email, google_sub = user.email, user.google_sub
        db.delete(user)
        db.flush()
        if email and not existing.email:
            existing.email = email
        if google_sub:
            existing.google_sub = google_sub
        db.commit()
        token = create_token(soldier.id)
        return schemas.TokenOut(access_token=token, soldier=soldier_to_out(soldier))

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
    if not user and email:
        # fallback: חייל שמייל Google שלו שמור בטבלת soldiers (ולא ב-users)
        soldier_by_email = db.query(models.Soldier).filter(models.Soldier.email == email).first()
        if soldier_by_email:
            user = db.query(models.User).filter(models.User.soldier_id == soldier_by_email.id).first()
            if not user:
                # המפקד רשם את החייל עם המייל הזה וזו כניסה ראשונה — מקשרים אוטומטית
                user = models.User(
                    id=str(uuid.uuid4()),
                    email=email,
                    google_sub=google_sub,
                    soldier_id=soldier_by_email.id,
                )
                db.add(user)
                db.commit()
                db.refresh(user)

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


# ── Bootstrap — יצירת מסגרת חדשה + מפקד ראשון ───────────────────────────────

@router.post("/bootstrap", response_model=schemas.TokenOut)
def bootstrap(body: schemas.BootstrapIn, db: Session = Depends(get_db)):
    """
    יצירת מסגרת חדשה (מחלקה/פלוגה) + חייל-מפקד + משתמש בטרנזקציה אחת.
    לשימוש מפקד שמקים מסגרת חדשה לגמרי ללא נתונים קיימים.
    """
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="הסיסמא חייבת להכיל לפחות 6 תווים")
    if not body.firstName.strip() or not body.lastName.strip():
        raise HTTPException(status_code=400, detail="שם פרטי ושם משפחה הם שדות חובה")
    if not body.unitName.strip():
        raise HTTPException(status_code=400, detail="שם המסגרת הוא שדה חובה")
    if body.unitType not in ("section", "company"):
        raise HTTPException(status_code=400, detail="סוג מסגרת לא תקין")
    if not body.personalNumber and not body.idNumber:
        raise HTTPException(status_code=400, detail="יש לספק מספר אישי או תעודת זהות")

    # בדיקת ייחודיות — מניעת כפילויות
    if body.personalNumber:
        existing = db.query(models.Soldier).filter(
            models.Soldier.personalNumber == body.personalNumber.strip()
        ).first()
        if existing:
            raise HTTPException(status_code=409, detail="מספר זה כבר רשום במערכת")
    if body.idNumber:
        existing = db.query(models.Soldier).filter(
            models.Soldier.idNumber == body.idNumber.strip()
        ).first()
        if existing:
            raise HTTPException(status_code=409, detail="מספר זה כבר רשום במערכת")

    # משתמש Google שעוד לא מקושר לחייל — החשבון שלו יקושר למפקד החדש
    google_user = None
    if body.googleUserId:
        google_user = db.query(models.User).filter(models.User.id == body.googleUserId).first()
        if not google_user or google_user.soldier_id:
            raise HTTPException(status_code=400, detail="חשבון Google לא תקין — התחבר מחדש")

    # מחלקה חדשה שמצטרפת מיד לפלוגה קיימת עם קוד הצטרפות
    join_company = None
    join_code = (body.joinCode or "").strip().upper()
    if join_code:
        if body.unitType != "section":
            raise HTTPException(status_code=400, detail="קוד הצטרפות מתאים רק להקמת מחלקה")
        join_company = db.query(models.Company).filter(
            models.Company.join_code == join_code,
            models.Company.is_auto == False,  # noqa: E712
        ).first()
        if not join_company:
            raise HTTPException(status_code=404, detail="קוד ההצטרפות לא נמצא — בדוק אותו מול מפקד הפלוגה")

    section_id = None
    company_id = None
    section_company = None

    if body.unitType == "section":
        # מחלקה עצמאית מקבלת פלוגה אוטומטית פרטית משלה (לא משותפת עם אף מחלקה אחרת)
        section_company = join_company or create_auto_company(body.unitName.strip(), db)
        section = models.Section(
            id=str(uuid.uuid4()),
            name=body.unitName.strip(),
            company_id=section_company.id,
        )
        db.add(section)
        db.flush()
        section_id = section.id
        permission_level = "section_commander"
    else:
        company = models.Company(
            id=str(uuid.uuid4()),
            name=body.unitName.strip(),
        )
        db.add(company)
        db.flush()
        company_id = company.id
        permission_level = "company_commander"

    soldier = models.Soldier(
        id=str(uuid.uuid4()),
        firstName=body.firstName.strip(),
        lastName=body.lastName.strip(),
        rank=body.rank,
        phone=body.phone.strip(),
        role="מפקד",
        isActive=True,
        sectionId=section_id,
        managed_company_id=company_id,
        company_id=company_id or section_company.id,
        personalNumber=body.personalNumber.strip() if body.personalNumber else None,
        idNumber=body.idNumber.strip() if body.idNumber else None,
        permissionLevel=permission_level,
    )
    db.add(soldier)
    db.flush()

    if google_user:
        google_user.soldier_id = soldier.id
        google_user.password_hash = pwd_context.hash(body.password)
    else:
        db.add(models.User(
            id=str(uuid.uuid4()),
            soldier_id=soldier.id,
            password_hash=pwd_context.hash(body.password),
        ))
    db.commit()

    token = create_token(soldier.id)
    return schemas.TokenOut(access_token=token, soldier=soldier_to_out(soldier))
