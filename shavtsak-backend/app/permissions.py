"""
permissions.py — בדיקות הרשאה בצד השרת.

הכללים תואמים ל-shavtsak-app/lib/permissions.ts. הפרונטאנד רק מסתיר כפתורים;
ההחלטה האמיתית מתקבלת כאן, כי כל אחד יכול לשלוח בקשה ישירות לשרת.
"""

from fastapi import HTTPException
from sqlalchemy.orm import Session
from app import models
from app.isolation import get_visible_soldier_ids, get_actor_company_id

COMPANY_COMMANDER = "company_commander"
SECTION_COMMANDER = "section_commander"


def forbid(detail: str = "אין הרשאה"):
    raise HTTPException(status_code=403, detail=detail)


def extras(actor: models.Soldier) -> set[str]:
    return {ep.permission for ep in actor.extra_permissions}


def is_company_commander(actor: models.Soldier) -> bool:
    return actor.permissionLevel == COMPANY_COMMANDER


def is_section_commander(actor: models.Soldier) -> bool:
    return actor.permissionLevel == SECTION_COMMANDER


def leads_independent_section(actor: models.Soldier) -> bool:
    """מפקד מחלקה עצמאית (מחלקה בפלוגה אוטומטית) — הוא גם "מפקד הפלוגה" של עצמו."""
    return (
        is_section_commander(actor)
        and actor.section is not None
        and actor.section.company is not None
        and actor.section.company.is_auto
    )


def can_manage_tasks(actor: models.Soldier) -> bool:
    return is_company_commander(actor) or "tasks" in extras(actor) or leads_independent_section(actor)


def can_schedule(actor: models.Soldier) -> bool:
    return is_company_commander(actor) or is_section_commander(actor) or "schedule" in extras(actor)


def can_manage_people(actor: models.Soldier) -> bool:
    """ניהול כוח אדם וספר טלפונים (אנשי קשר נוספים)."""
    return is_company_commander(actor) or is_section_commander(actor) or "management" in extras(actor)


def require(condition: bool, detail: str = "אין הרשאה"):
    if not condition:
        forbid(detail)


def visible_soldier_ids(actor: models.Soldier, db: Session) -> set[str] | None:
    ids = get_visible_soldier_ids(actor, db)
    return None if ids is None else set(ids)


def require_visible(actor: models.Soldier, soldier_ids, db: Session):
    """כל החיילים ברשימה חייבים להיות בתחום הנראות של ה-actor (בפרט — באותה פלוגה)."""
    visible = visible_soldier_ids(actor, db)
    if visible is None:
        return
    if any(sid not in visible for sid in soldier_ids):
        forbid("אחד החיילים לא שייך ליחידה שלך")


def same_section(actor: models.Soldier, target: models.Soldier) -> bool:
    return actor.sectionId is not None and actor.sectionId == target.sectionId


def can_edit_soldier(actor: models.Soldier, target: models.Soldier, db: Session) -> bool:
    """עריכת פרטי חייל אחר (לא רק את עצמך)."""
    visible = visible_soldier_ids(actor, db)
    if visible is not None and target.id not in visible:
        return False
    if is_company_commander(actor) or "management" in extras(actor):
        return True
    return is_section_commander(actor) and same_section(actor, target)


def can_delete_soldier(actor: models.Soldier, target: models.Soldier, db: Session) -> bool:
    if actor.id == target.id:
        return False
    visible = visible_soldier_ids(actor, db)
    if visible is not None and target.id not in visible:
        return False
    if is_company_commander(actor):
        return True
    return is_section_commander(actor) and same_section(actor, target)


def can_grant_permissions(actor: models.Soldier, target: models.Soldier) -> bool:
    if actor.id == target.id:
        return False
    if is_company_commander(actor):
        return True
    if is_section_commander(actor) or "management" in extras(actor):
        return same_section(actor, target)
    return False


def section_in_actor_company(actor: models.Soldier, section_id: str, db: Session) -> bool:
    company_id = get_actor_company_id(actor, db)
    section = db.query(models.Section).filter(models.Section.id == section_id).first()
    return section is not None and company_id is not None and section.company_id == company_id
