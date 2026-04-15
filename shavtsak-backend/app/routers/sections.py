from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app import models, schemas
from app.auth import get_current_soldier
import uuid

router = APIRouter(prefix="/sections", tags=["sections"])


@router.get("", response_model=List[schemas.SectionOut])
def get_sections(db: Session = Depends(get_db), _=Depends(get_current_soldier)):
    return db.query(models.Section).all()


@router.post("", response_model=schemas.SectionOut)
def add_section(body: schemas.SectionCreate, db: Session = Depends(get_db), _=Depends(get_current_soldier)):
    section = models.Section(id=str(uuid.uuid4()), name=body.name)
    db.add(section)
    db.commit()
    db.refresh(section)
    return section


@router.put("/{section_id}", response_model=schemas.SectionOut)
def update_section(section_id: str, body: schemas.SectionUpdate, db: Session = Depends(get_db), _=Depends(get_current_soldier)):
    section = db.query(models.Section).filter(models.Section.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="מחלקה לא נמצאה")
    section.name = body.name
    db.commit()
    db.refresh(section)
    return section


@router.delete("/{section_id}")
def delete_section(section_id: str, db: Session = Depends(get_db), _=Depends(get_current_soldier)):
    section = db.query(models.Section).filter(models.Section.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="מחלקה לא נמצאה")
    # חיילים שהיו במחלקה — מאבדים שיוך
    db.query(models.Soldier).filter(models.Soldier.sectionId == section_id).update({"sectionId": None})
    db.delete(section)
    db.commit()
    return {"ok": True}
