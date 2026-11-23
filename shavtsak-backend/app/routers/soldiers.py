from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app import models, schemas
from app.auth import get_current_soldier
from app.isolation import get_visible_soldier_ids, get_actor_company_id
from app import permissions as perms
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
        unitIsAuto=bool(s.section and s.section.company and s.section.company.is_auto),
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


VALID_LEVELS = {"soldier", "section_commander", "company_commander"}
VALID_EXTRAS = {"extended_data", "management", "schedule", "tasks"}


def _check_assignment_fields(actor: models.Soldier, body, db: Session, target: models.Soldier | None):
    """
    בודק שדות "רגישים": מחלקה, רמת הרשאה, פלוגה מנוהלת והרשאות נוספות.
    target=None → הוספת חייל חדש.
    """
    old_section = target.sectionId if target else None
    old_level = target.permissionLevel if target else "soldier"
    old_managed = target.managed_company_id if target else None
    old_extras = {ep.permission for ep in target.extra_permissions} if target else set()
    actor_company = get_actor_company_id(actor, db)

    if body.permissionLevel not in VALID_LEVELS:
        perms.forbid("רמת הרשאה לא תקינה")
    if not set(body.extraPermissions) <= VALID_EXTRAS:
        perms.forbid("הרשאה לא תקינה")

    # מחלקה — רק מחלקה בפלוגה של ה-actor; מפקד מחלקה — רק המחלקה שלו
    if body.sectionId != old_section:
        if body.sectionId is not None:
            perms.require(perms.section_in_actor_company(actor, body.sectionId, db), "המחלקה לא שייכת ליחידה שלך")
        if not perms.is_company_commander(actor):
            perms.require(body.sectionId == actor.sectionId, "רק מפקד פלוגה יכול להעביר חייל בין מחלקות")

    # רמת הרשאה ופלוגה מנוהלת — רק מפקד פלוגה, ורק בתוך הפלוגה שלו
    if body.permissionLevel != old_level:
        perms.require(perms.is_company_commander(actor), "רק מפקד פלוגה יכול לשנות רמת הרשאה")
    if body.managedCompanyId != old_managed:
        perms.require(perms.is_company_commander(actor), "רק מפקד פלוגה יכול לשנות שיוך פלוגה")
        perms.require(body.managedCompanyId in (None, actor_company), "אפשר לשייך רק לפלוגה שלך")

    # הרשאות נוספות — לפי כללי הענקת הרשאות
    if set(body.extraPermissions) != old_extras:
        if target is None:
            perms.require(perms.can_manage_people(actor), "אין הרשאה להעניק הרשאות")
        else:
            perms.require(perms.can_grant_permissions(actor, target), "אין הרשאה להעניק הרשאות לחייל זה")


@router.get("/public")
def get_soldiers_public(db: Session = Depends(get_db), actor: models.Soldier = Depends(get_current_soldier)):
    """רשימה מינימלית לפאנל ההתחזות — למפתחים בלבד (דורש התחברות)."""
    user = db.query(models.User).filter(models.User.soldier_id == actor.id).first()
    perms.require(bool(user and user.is_developer), "למפתחים בלבד")
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
    perms.require(perms.is_company_commander(actor) or perms.is_section_commander(actor), "אין הרשאה להוסיף חיילים")
    if perms.is_section_commander(actor):
        body.sectionId = actor.sectionId  # מפקד מחלקה מוסיף רק למחלקה שלו
    _check_assignment_fields(actor, body, db, None)
    perms.require(get_actor_company_id(actor, db) is not None, "לא משויך לפלוגה")
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
    for perm in set(body.extraPermissions):
        db.add(models.SoldierExtraPermission(id=str(uuid.uuid4()), soldier_id=soldier.id, permission=perm))
    db.commit()
    db.refresh(soldier)
    return soldier_to_out(soldier)


# שדות שחייל רשאי לעדכן בעצמו (דף הפרופיל)
SELF_EDITABLE = ["firstName", "lastName", "phone", "address", "birthDate", "email",
                 "personalNumber", "idNumber", "rank", "role"]


@router.put("/{soldier_id}", response_model=schemas.SoldierOut)
def update_soldier(soldier_id: str, body: schemas.SoldierUpdate, db: Session = Depends(get_db), actor: models.Soldier = Depends(get_current_soldier)):
    soldier = db.query(models.Soldier).filter(models.Soldier.id == soldier_id).first()
    if not soldier:
        raise HTTPException(status_code=404, detail="חייל לא נמצא")

    if perms.can_edit_soldier(actor, soldier, db):
        _check_assignment_fields(actor, body, db, soldier)
        fields = SELF_EDITABLE + ["isActive", "sectionId", "permissionLevel"]
        manage_fields = True
    elif actor.id == soldier.id:
        # עריכה עצמית: מותר לשנות פרטים אישיים, אסור לשנות הרשאות / מחלקה / סטטוס
        locked_changed = (
            body.sectionId != soldier.sectionId
            or body.permissionLevel != soldier.permissionLevel
            or body.managedCompanyId != soldier.managed_company_id
            or body.isActive != soldier.isActive
            or set(body.extraPermissions) != {ep.permission for ep in soldier.extra_permissions}
        )
        perms.require(not locked_changed, "אי אפשר לשנות לעצמך הרשאות, מחלקה או סטטוס")
        fields = SELF_EDITABLE
        manage_fields = False
    else:
        perms.forbid("אין הרשאה לערוך חייל זה")

    _normalize_and_check(body, db, soldier_id)
    for field in fields:
        setattr(soldier, field, getattr(body, field))
    if manage_fields:
        soldier.managed_company_id = body.managedCompanyId
        soldier.company_id = _soldier_company_id(body.sectionId, actor, db, fallback=soldier.company_id)
        # עדכון הרשאות נוספות — מחיקה ויצירה מחדש
        for ep in soldier.extra_permissions:
            db.delete(ep)
        db.flush()
        for perm in set(body.extraPermissions):
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
    soldier = db.query(models.Soldier).filter(models.Soldier.id == soldier_id).first()
    if not soldier:
        raise HTTPException(status_code=404, detail="חייל לא נמצא")
    perms.require(perms.can_delete_soldier(actor, soldier, db), "אין הרשאה למחוק חייל זה")
    user = db.query(models.User).filter(models.User.soldier_id == soldier_id).first()
    if user:
        user.soldier_id = None
    # הסרת החייל מכל השיבוצים (אחרת המחיקה נכשלת על מפתח זר)
    db.query(models.AssignmentSoldier).filter(models.AssignmentSoldier.soldier_id == soldier_id).delete(synchronize_session=False)
    db.query(models.HourSlotSoldier).filter(models.HourSlotSoldier.soldier_id == soldier_id).delete(synchronize_session=False)
    db.delete(soldier)
    db.commit()
    return {"ok": True}
