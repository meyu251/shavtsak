"""
isolation.py — בידוד נתונים לפי רמת הרשאה.
מחזיר את רשימות ה-ID שמשתמש מורשה לראות.
None = אין הגבלה (רואה הכל).
"""

from sqlalchemy.orm import Session
from app import models


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
        if not section_ids:
            return [actor.id]  # פלוגה ללא מחלקות — רואה רק עצמו
        ids = [
            r[0] for r in db.query(models.Soldier.id).filter(
                models.Soldier.sectionId.in_(section_ids)
            ).all()
        ]
        return ids or [actor.id]

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
