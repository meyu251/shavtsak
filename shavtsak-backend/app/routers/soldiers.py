from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app import models, schemas
from app.auth import get_current_soldier
from app.isolation import get_visible_soldier_ids, get_actor_company_id
import uuid

router = APIRouter(prefix="/soldiers", tags=["soldiers"])


def soldier_to_out(s: models.Soldier) -> schemas.SoldierOut:
    return schemas.SoldierOut(
        id=s.id, firstName=s.firstName, lastName=s.lastName,
        phone=s.phone, role=s.role, rank=s.rank, isActive=s.isActive,
        sectionId=s.sectionId, personalNumber=s.personalNumber,
        idNumber=s.idNumber, address=s.address, birthDate=s.birthDate,
        permissionLevel=s.permissionLevel,
        extraPermissions=[ep.permission for ep in s.extra_permissions],
        email=s.email,
        managedCompanyId=s.managed_company_id,
    )


def _clean(v):
    """מחרוזת ריקה → None. שדות ייחודיים (מייל) לא יכולים להכיל "" אצל כמה חיילים."""
    if v is None:
        return None
    v = v.strip()
    return v or None


def _soldier_company_id(section_id, actor: models.Soldier, db: Session, fallback=None):
    """הפלוגה של חייל: של המחלקה שלו, ואם אין מחלקה — הקיימת / של מי שמוסיף אותו."""
    if section_id:
        section = db.query(models.Section).filter(models.Section.id == section_id).first()
        if section and section.company_id:
            return section.company_id
    return fallback or get_actor_company_id(actor, db)


def _normalize_and_check(body, db: Session, soldier_id: str | None = None):
    """מנקה שדות מזהים ובודק שמספר אישי / ת"ז / מייל לא שייכים לחייל אחר."""
    body.email = _clean(body.email)
    body.personalNumber = _clean(body.personalNumber)
    body.idNumber = _clean(body.idNumber)
    for field, value, label in (
        (models.Soldier.personalNumber, body.personalNumber, "מספר אישי"),
        (models.Soldier.idNumber, body.idNumber, "תעודת זהות"),
        (models.Soldier.email, body.email, "מייל"),
    ):
        if value is None:
            continue
        q = db.query(models.Soldier).filter(field == value)
        if soldier_id:
            q = q.filter(models.Soldier.id != soldier_id)
        if q.first():
            raise HTTPException(status_code=409, detail=f"{label} זה כבר רשום לחייל אחר")


@router.get("/public")
def get_soldiers_public(db: Session = Depends(get_db)):
    """ללא אימות — מחזיר רק שדות בסיסיים לדף הכניסה."""
    soldiers = db.query(models.Soldier).filter(models.Soldier.isActive == True).all()
    return [
        {"id": s.id, "firstName": s.firstName, "lastName": s.lastName,
         "rank": s.rank, "role": s.role, "permissionLevel": s.permissionLevel}
        for s in soldiers
    ]


@router.get("", response_model=List[schemas.SoldierOut])
def get_soldiers(db: Session = Depends(get_db), actor: models.Soldier = Depends(get_current_soldier)):
    visible = get_visible_soldier_ids(actor, db)
    q = db.query(models.Soldier)
    if visible is not None:
        q = q.filter(models.Soldier.id.in_(visible))
    return [soldier_to_out(s) for s in q.all()]


@router.post("", response_model=schemas.SoldierOut)
def add_soldier(body: schemas.SoldierCreate, db: Session = Depends(get_db), actor: models.Soldier = Depends(get_current_soldier)):
    _normalize_and_check(body, db)
    soldier = models.Soldier(
        id=str(uuid.uuid4()),
        firstName=body.firstName, lastName=body.lastName,
        phone=body.phone, role=body.role, rank=body.rank,
        isActive=body.isActive, sectionId=body.sectionId,
        personalNumber=body.personalNumber, idNumber=body.idNumber,
        address=body.address, birthDate=body.birthDate,
        permissionLevel=body.permissionLevel, email=body.email,
        managed_company_id=body.managedCompanyId,
        company_id=_soldier_company_id(body.sectionId, actor, db),
    )
    db.add(soldier)
    db.flush()
    for perm in body.extraPermissions:
        db.add(models.SoldierExtraPermission(id=str(uuid.uuid4()), soldier_id=soldier.id, permission=perm))
    db.commit()
    db.refresh(soldier)
    return soldier_to_out(soldier)


@router.put("/{soldier_id}", response_model=schemas.SoldierOut)
def update_soldier(soldier_id: str, body: schemas.SoldierUpdate, db: Session = Depends(get_db), actor: models.Soldier = Depends(get_current_soldier)):
    # בדיקת הרשאת גישה
    visible = get_visible_soldier_ids(actor, db)
    if visible is not None and soldier_id not in visible:
        raise HTTPException(status_code=403, detail="אין הרשאה לערוך חייל זה")

    soldier = db.query(models.Soldier).filter(models.Soldier.id == soldier_id).first()
    if not soldier:
        raise HTTPException(status_code=404, detail="חייל לא נמצא")
    _normalize_and_check(body, db, soldier_id)
    for field in ["firstName", "lastName", "phone", "role", "rank", "isActive",
                  "sectionId", "personalNumber", "idNumber", "address", "birthDate",
                  "permissionLevel", "email"]:
        setattr(soldier, field, getattr(body, field))
    soldier.managed_company_id = body.managedCompanyId
    soldier.company_id = _soldier_company_id(body.sectionId, actor, db, fallback=soldier.company_id)
    # עדכון הרשאות נוספות — מחיקה ויצירה מחדש
    for ep in soldier.extra_permissions:
        db.delete(ep)
    db.flush()
    for perm in body.extraPermissions:
        db.add(models.SoldierExtraPermission(id=str(uuid.uuid4()), soldier_id=soldier.id, permission=perm))
    user = db.query(models.User).filter(models.User.soldier_id == soldier.id).first()
    if user and body.email and user.email != body.email:
        # מייל של חשבון אחר שלא מקושר לאף חייל (ניסיון Google ישן) — משחררים אותו
        other = db.query(models.User).filter(models.User.email == body.email, models.User.id != user.id).first()
        if other and other.soldier_id is None:
            db.delete(other)
            db.flush()
            other = None
        if other is None:
            user.email = body.email
    db.commit()
    db.refresh(soldier)
    return soldier_to_out(soldier)


@router.delete("/{soldier_id}")
def delete_soldier(soldier_id: str, db: Session = Depends(get_db), actor: models.Soldier = Depends(get_current_soldier)):
    # בדיקת הרשאת גישה
    visible = get_visible_soldier_ids(actor, db)
    if visible is not None and soldier_id not in visible:
        raise HTTPException(status_code=403, detail="אין הרשאה למחוק חייל זה")

    soldier = db.query(models.Soldier).filter(models.Soldier.id == soldier_id).first()
    if not soldier:
        raise HTTPException(status_code=404, detail="חייל לא נמצא")
    user = db.query(models.User).filter(models.User.soldier_id == soldier_id).first()
    if user:
        user.soldier_id = None
    db.delete(soldier)
    db.commit()
    return {"ok": True}
