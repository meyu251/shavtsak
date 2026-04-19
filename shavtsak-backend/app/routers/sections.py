from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app import models, schemas
from app.auth import get_current_soldier
from app.isolation import get_visible_section_ids
import uuid

router = APIRouter(prefix="/sections", tags=["sections"])


@router.get("", response_model=List[schemas.SectionOut])
def get_sections(db: Session = Depends(get_db), actor: models.Soldier = Depends(get_current_soldier)):
    visible = get_visible_section_ids(actor, db)
    q = db.query(models.Section)
    if visible is not None:
        q = q.filter(models.Section.id.in_(visible))
    return q.all()


@router.post("", response_model=schemas.SectionOut)
def add_section(body: schemas.SectionCreate, db: Session = Depends(get_db), _=Depends(get_current_soldier)):
    section = models.Section(id=str(uuid.uuid4()), name=body.name, company_id=body.company_id)
    db.add(section)
    db.commit()
    db.refresh(section)
    return section


@router.put("/{section_id}", response_model=schemas.SectionOut)
def update_section(section_id: str, body: schemas.SectionUpdate, db: Session = Depends(get_db), actor: models.Soldier = Depends(get_current_soldier)):
    # בדיקת הרשאת גישה
    visible = get_visible_section_ids(actor, db)
    if visible is not None and section_id not in visible:
        raise HTTPException(status_code=403, detail="אין הרשאה לערוך מחלקה זו")

    section = db.query(models.Section).filter(models.Section.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="מחלקה לא נמצאה")
    section.name = body.name
    section.company_id = body.company_id
    db.commit()
    db.refresh(section)
    return section


@router.delete("/{section_id}")
def delete_section(section_id: str, db: Session = Depends(get_db), actor: models.Soldier = Depends(get_current_soldier)):
    # בדיקת הרשאת גישה
    visible = get_visible_section_ids(actor, db)
    if visible is not None and section_id not in visible:
        raise HTTPException(status_code=403, detail="אין הרשאה למחוק מחלקה זו")

    section = db.query(models.Section).filter(models.Section.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="מחלקה לא נמצאה")
    # חיילים שהיו במחלקה — מאבדים שיוך
    db.query(models.Soldier).filter(models.Soldier.sectionId == section_id).update({"sectionId": None})
    db.delete(section)
    db.commit()
    return {"ok": True}
