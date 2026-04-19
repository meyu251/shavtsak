from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app import models, schemas
from app.auth import get_current_soldier
import uuid

router = APIRouter(prefix="/companies", tags=["companies"])


@router.get("", response_model=List[schemas.CompanyOut])
def get_companies(db: Session = Depends(get_db), actor: models.Soldier = Depends(get_current_soldier)):
    from app.isolation import get_visible_section_ids

    # מפקד פלוגה עם managed_company_id — רואה רק את הפלוגה שלו
    if actor.permissionLevel == "company_commander" and actor.managed_company_id:
        return db.query(models.Company).filter(
            models.Company.id == actor.managed_company_id
        ).all()

    # מפקד פלוגה ללא שיוך — רואה הכל (אחורה תואם)
    # רמות נמוכות — מחזיר רשימה ריקה (אין להם צורך בפלוגות)
    if actor.permissionLevel == "company_commander":
        return db.query(models.Company).all()

    return []


@router.post("", response_model=schemas.CompanyOut)
def add_company(
    body: schemas.CompanyCreate,
    db: Session = Depends(get_db),
    actor: models.Soldier = Depends(get_current_soldier),
):
    if actor.permissionLevel != "company_commander":
        raise HTTPException(status_code=403, detail="רק מפקד פלוגה יכול להוסיף פלוגה")
    company = models.Company(
        id=str(uuid.uuid4()),
        name=body.name,
        battalion_id=body.battalion_id,
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


@router.put("/{company_id}", response_model=schemas.CompanyOut)
def update_company(
    company_id: str,
    body: schemas.CompanyUpdate,
    db: Session = Depends(get_db),
    actor: models.Soldier = Depends(get_current_soldier),
):
    if actor.permissionLevel != "company_commander":
        raise HTTPException(status_code=403, detail="רק מפקד פלוגה יכול לערוך פלוגה")
    company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="פלוגה לא נמצאה")
    company.name = body.name
    company.battalion_id = body.battalion_id
    db.commit()
    db.refresh(company)
    return company


@router.delete("/{company_id}")
def delete_company(
    company_id: str,
    db: Session = Depends(get_db),
    actor: models.Soldier = Depends(get_current_soldier),
):
    if actor.permissionLevel != "company_commander":
        raise HTTPException(status_code=403, detail="רק מפקד פלוגה יכול למחוק פלוגה")
    company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="פלוגה לא נמצאה")
    # ניתוק המחלקות מהפלוגה
    db.query(models.Section).filter(models.Section.company_id == company_id).update({"company_id": None})
    # ניתוק מפקדים שמנוהלים תחת פלוגה זו
    db.query(models.Soldier).filter(models.Soldier.managed_company_id == company_id).update({"managed_company_id": None})
    db.delete(company)
    db.commit()
    return {"ok": True}
