from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app import models, schemas
from app.auth import get_current_soldier
import uuid

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.get("", response_model=List[schemas.ContactOut])
def get_contacts(db: Session = Depends(get_db), _=Depends(get_current_soldier)):
    return db.query(models.ExtraContact).all()


@router.post("", response_model=schemas.ContactOut)
def add_contact(body: schemas.ContactCreate, db: Session = Depends(get_db), _=Depends(get_current_soldier)):
    contact = models.ExtraContact(id=str(uuid.uuid4()), **body.model_dump())
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.put("/{contact_id}", response_model=schemas.ContactOut)
def update_contact(contact_id: str, body: schemas.ContactUpdate, db: Session = Depends(get_db), _=Depends(get_current_soldier)):
    contact = db.query(models.ExtraContact).filter(models.ExtraContact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="איש קשר לא נמצא")
    for field, value in body.model_dump().items():
        setattr(contact, field, value)
    db.commit()
    db.refresh(contact)
    return contact


@router.delete("/{contact_id}")
def delete_contact(contact_id: str, db: Session = Depends(get_db), _=Depends(get_current_soldier)):
    contact = db.query(models.ExtraContact).filter(models.ExtraContact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="איש קשר לא נמצא")
    db.delete(contact)
    db.commit()
    return {"ok": True}
