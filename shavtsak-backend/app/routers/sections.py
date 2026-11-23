from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app import models, schemas
from app.auth import get_current_soldier
from app.isolation import get_visible_section_ids, get_actor_company_id, create_auto_company, move_section_to_company
from app import permissions as perms
import uuid

router = APIRouter(prefix="/sections", tags=["sections"])


def _get_section(section_id: str, db: Session) -> models.Section:
    section = db.query(models.Section).filter(models.Section.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="מחלקה לא נמצאה")
    return section


def _can_manage_section(actor: models.Soldier, section: models.Section) -> bool:
    """מפקד הפלוגה של המחלקה, או מפקד המחלקה עצמה."""
    if perms.is_company_commander(actor) and actor.managed_company_id and section.company_id == actor.managed_company_id:
        return True
    return perms.is_section_commander(actor) and actor.sectionId == section.id


@router.get("", response_model=List[schemas.SectionOut])
def get_sections(db: Session = Depends(get_db), actor: models.Soldier = Depends(get_current_soldier)):
    visible = get_visible_section_ids(actor, db)
    q = db.query(models.Section)
    if visible is not None:
        q = q.filter(models.Section.id.in_(visible))
    return q.all()


@router.post("", response_model=schemas.SectionOut)
def add_section(body: schemas.SectionCreate, db: Session = Depends(get_db), actor: models.Soldier = Depends(get_current_soldier)):
    # רק מפקד פלוגה מוסיף מחלקות, ורק לפלוגה שלו
    perms.require(perms.is_company_commander(actor) and actor.managed_company_id is not None,
                  "רק מפקד פלוגה יכול להוסיף מחלקה")
    perms.require(body.company_id in (None, actor.managed_company_id), "אפשר להוסיף מחלקה רק לפלוגה שלך")
    section = models.Section(id=str(uuid.uuid4()), name=body.name, company_id=actor.managed_company_id)
    db.add(section)
    db.commit()
    db.refresh(section)
    return section


@router.put("/{section_id}", response_model=schemas.SectionOut)
def update_section(section_id: str, body: schemas.SectionUpdate, db: Session = Depends(get_db), actor: models.Soldier = Depends(get_current_soldier)):
    section = _get_section(section_id, db)
    perms.require(_can_manage_section(actor, section), "אין הרשאה לערוך מחלקה זו")
    section.name = body.name
    if body.company_id != section.company_id:
        # שינוי פלוגה: מפקד הפלוגה יכול רק לנתק מחלקה מהפלוגה שלו (היא הופכת לעצמאית).
        # הצטרפות לפלוגה אחרת — רק עם קוד הצטרפות (POST /sections/{id}/join).
        perms.require(perms.is_company_commander(actor) and body.company_id is None,
                      "הצטרפות לפלוגה נעשית עם קוד הצטרפות")
        move_section_to_company(section, None, db)
    db.commit()
    db.refresh(section)
    return section


@router.post("/{section_id}/join", response_model=schemas.SectionOut)
def join_company(section_id: str, body: schemas.JoinCompanyRequest, db: Session = Depends(get_db), actor: models.Soldier = Depends(get_current_soldier)):
    """
    מחלקה עצמאית מצטרפת לפלוגה עם קוד ההצטרפות שקיבלה ממפקד הפלוגה.
    המשימות, אנשי הקשר והשיבוצים של המחלקה עוברים לפלוגה, והפלוגה האוטומטית נמחקת.
    """
    section = _get_section(section_id, db)
    perms.require(perms.is_section_commander(actor) and actor.sectionId == section.id,
                  "רק מפקד המחלקה יכול לצרף אותה לפלוגה")
    perms.require(section.company is not None and section.company.is_auto, "המחלקה כבר שייכת לפלוגה")
    company = db.query(models.Company).filter(
        models.Company.join_code == body.code.strip().upper(),
        models.Company.is_auto.is_(False),
    ).first()
    if not company:
        raise HTTPException(status_code=404, detail="קוד הצטרפות שגוי")
    move_section_to_company(section, company.id, db)
    db.commit()
    db.refresh(section)
    return section


@router.delete("/{section_id}")
def delete_section(section_id: str, db: Session = Depends(get_db), actor: models.Soldier = Depends(get_current_soldier)):
    section = _get_section(section_id, db)
    perms.require(perms.is_company_commander(actor) and section.company_id == actor.managed_company_id,
                  "רק מפקד הפלוגה יכול למחוק מחלקה")
    # חיילים שהיו במחלקה — מאבדים שיוך למחלקה אבל נשארים בפלוגה
    db.query(models.Soldier).filter(models.Soldier.sectionId == section_id).update(
        {"sectionId": None, "company_id": section.company_id}, synchronize_session=False)
    db.delete(section)
    db.commit()
    return {"ok": True}
