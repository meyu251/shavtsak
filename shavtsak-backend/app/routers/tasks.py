from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app import models, schemas
from app.auth import get_current_soldier
import uuid

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=List[schemas.TaskOut])
def get_tasks(db: Session = Depends(get_db), _=Depends(get_current_soldier)):
    return db.query(models.TaskTemplate).all()


@router.post("", response_model=schemas.TaskOut)
def add_task(body: schemas.TaskCreate, db: Session = Depends(get_db), _=Depends(get_current_soldier)):
    task = models.TaskTemplate(id=str(uuid.uuid4()), **body.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.put("/{task_id}", response_model=schemas.TaskOut)
def update_task(task_id: str, body: schemas.TaskUpdate, db: Session = Depends(get_db), _=Depends(get_current_soldier)):
    task = db.query(models.TaskTemplate).filter(models.TaskTemplate.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="משימה לא נמצאה")
    for field, value in body.model_dump().items():
        setattr(task, field, value)
    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}")
def delete_task(task_id: str, db: Session = Depends(get_db), _=Depends(get_current_soldier)):
    task = db.query(models.TaskTemplate).filter(models.TaskTemplate.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="משימה לא נמצאה")
    db.delete(task)
    db.commit()
    return {"ok": True}
