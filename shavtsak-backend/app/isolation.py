"""
isolation.py — בידוד נתונים לפי רמת הרשאה.
מחזיר את רשימות ה-ID שמשתמש מורשה לראות.
None = אין הגבלה (רואה הכל).
"""

from sqlalchemy.orm import Session
from app import models
import uuid


def get_visible_soldier_ids(actor: models.Soldier, db: Session) -> list[str] | None:
    """
    מחזיר את ה-IDs של החיילים שה-actor רשאי לראות.
    None = רואה הכל (אין הגבלה).
    """
    level = actor.permissionLevel

    if level == "company_commander":
        if actor.managed_company_id is None:
            # אחורה תואם — מפקד פלוגה שעדיין לא שויך לפלוגה רואה הכל
            return None
        section_ids = [
            r[0] for r in db.query(models.Section.id).filter(
                models.Section.company_id == actor.managed_company_id
            ).all()
        ]
        # חיילי המחלקות של הפלוגה + סגל הפלוגה עצמו (מפקדים שמנהלים את הפלוגה ולא שייכים למחלקה)
        ids = {
            r[0] for r in db.query(models.Soldier.id).filter(
                models.Soldier.managed_company_id == actor.managed_company_id
            ).all()
        }
        if section_ids:
            ids.update(
                r[0] for r in db.query(models.Soldier.id).filter(
                    models.Soldier.sectionId.in_(section_ids)
                ).all()
            )
        ids.add(actor.id)
        return list(ids)

    if level == "section_commander":
        if actor.sectionId is None:
            # מפקד מחלקה ללא מחלקה — רואה רק עצמו
            return [actor.id]
        ids = [
            r[0] for r in db.query(models.Soldier.id).filter(
                models.Soldier.sectionId == actor.sectionId
            ).all()
        ]
        return ids or [actor.id]

    # soldier — רואה את כל החיילים (שמות וטלפונים), פרטים רגישים מסוננים בפרונטאנד
    return None


def get_visible_section_ids(actor: models.Soldier, db: Session) -> list[str] | None:
    """
    מחזיר את ה-IDs של המחלקות שה-actor רשאי לראות.
    None = רואה הכל.
    """
    level = actor.permissionLevel

    if level == "company_commander":
        if actor.managed_company_id is None:
            return None
        return [
            r[0] for r in db.query(models.Section.id).filter(
                models.Section.company_id == actor.managed_company_id
            ).all()
        ]

    if level == "section_commander":
        return [actor.sectionId] if actor.sectionId else []

    # soldier — רואה את כל המחלקות (לצורך ספר טלפונים)
    return None


def get_actor_company_id(actor: models.Soldier, db: Session) -> str | None:
    """מחזיר את ה-company_id של ה-actor. None = לא משויך לפלוגה."""
    if actor.managed_company_id:
        return actor.managed_company_id
    if actor.sectionId:
        section = db.query(models.Section).filter(models.Section.id == actor.sectionId).first()
        return section.company_id if section else None
    return None


# ── פלוגות אוטומטיות (עוטפות מחלקה בודדת) ─────────────────────────────────────

def create_auto_company(section_name: str, db: Session) -> models.Company:
    """יוצר פלוגה אוטומטית חדשה ופרטית למחלקה אחת. לעולם לא משותפת בין מחלקות."""
    company = models.Company(id=str(uuid.uuid4()), name=section_name, is_auto=True)
    db.add(company)
    db.flush()
    return company


def move_section_to_company(section: models.Section, new_company_id: str | None, db: Session) -> None:
    """
    משייך מחלקה לפלוגה. אם new_company_id ריק — המחלקה מקבלת פלוגה אוטומטית משלה.
    אם המחלקה יוצאת מפלוגה אוטומטית — המשימות ואנשי הקשר עוברים לפלוגה החדשה,
    והפלוגה האוטומטית נמחקת כשלא נשארו בה מחלקות.
    """
    old_company = section.company
    if new_company_id is None:
        if old_company is not None and old_company.is_auto:
            return  # כבר בעוטפת משלה
        section.company_id = create_auto_company(section.name, db).id
        db.flush()
        return
    if old_company is not None and old_company.id == new_company_id:
        return

    section.company_id = new_company_id
    db.flush()
    if old_company is not None and old_company.is_auto:
        db.query(models.TaskTemplate).filter(models.TaskTemplate.company_id == old_company.id) \
            .update({"company_id": new_company_id}, synchronize_session=False)
        db.query(models.ExtraContact).filter(models.ExtraContact.company_id == old_company.id) \
            .update({"company_id": new_company_id}, synchronize_session=False)
        remaining = db.query(models.Section).filter(models.Section.company_id == old_company.id).count()
        if remaining == 0:
            db.query(models.Soldier).filter(models.Soldier.managed_company_id == old_company.id) \
                .update({"managed_company_id": None}, synchronize_session=False)
            db.delete(old_company)
            db.flush()
