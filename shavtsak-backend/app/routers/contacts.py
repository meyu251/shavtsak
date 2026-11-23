from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app import models, schemas
from app.auth import get_current_soldier
from app.isolation import get_actor_company_id
from app import permissions as perms
import uuid

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.get("", response_model=List[schemas.ContactOut])
def get_contacts(db: Session = Depends(get_db), actor: models.Soldier = Depends(get_current_soldier)):
    company_id = get_actor_company_id(actor, db)
    if company_id is None:
        return []
    return db.query(models.ExtraContact).filter(models.ExtraContact.company_id == company_id).all()


@router.post("", response_model=schemas.ContactOut)
def add_contact(body: schemas.ContactCreate, db: Session = Depends(get_db), actor: models.Soldier = Depends(get_current_soldier)):
    perms.require(perms.can_manage_people(actor), "אין הרשאה לערוך את ספר הטלפונים")
    company_id = get_actor_company_id(actor, db)
    if company_id is None:
        raise HTTPException(status_code=403, detail="לא משויך לפלוגה")
    contact = models.ExtraContact(id=str(uuid.uuid4()), company_id=company_id, **body.model_dump())
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.put("/{contact_id}", response_model=schemas.ContactOut)
def update_contact(contact_id: str, body: schemas.ContactUpdate, db: Session = Depends(get_db), actor: models.Soldier = Depends(get_current_soldier)):
    perms.require(perms.can_manage_people(actor), "אין הרשאה לערוך את ספר הטלפונים")
    contact = db.query(models.ExtraContact).filter(models.ExtraContact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="איש קשר לא נמצא")
    company_id = get_actor_company_id(actor, db)
    if contact.company_id != company_id:
        raise HTTPException(status_code=403, detail="אין הרשאה")
    for field, value in body.model_dump().items():
        setattr(contact, field, value)
    db.commit()
    db.refresh(contact)
    return contact


@router.delete("/{contact_id}")
def delete_contact(contact_id: str, db: Session = Depends(get_db), actor: models.Soldier = Depends(get_current_soldier)):
    perms.require(perms.can_manage_people(actor), "אין הרשאה לערוך את ספר הטלפונים")
    contact = db.query(models.ExtraContact).filter(models.ExtraContact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="איש קשר לא נמצא")
    company_id = get_actor_company_id(actor, db)
    if contact.company_id != company_id:
        raise HTTPException(status_code=403, detail="אין הרשאה")
    db.delete(contact)
    db.commit()
    return {"ok": True}
