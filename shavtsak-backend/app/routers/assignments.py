from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app import models, schemas
from app.auth import get_current_soldier
from app.isolation import get_visible_soldier_ids, get_actor_company_id, company_soldier_ids
from app import permissions as perms
import uuid

router = APIRouter(prefix="/assignments", tags=["assignments"])


def assignment_to_out(a: models.Assignment) -> schemas.AssignmentOut:
    soldier_ids = [s.soldier_id for s in a.soldiers]
    slots = [
        schemas.HourSlotOut(
            hour=slot.hour,
            soldierIds=[hs.soldier_id for hs in slot.soldiers],
        )
        for slot in sorted(a.hour_slots, key=lambda s: s.hour)
    ]
    return schemas.AssignmentOut(
        id=a.id, date=a.date, taskId=a.taskId,
        soldierIds=soldier_ids, slots=slots,
    )


def _check_write(actor: models.Soldier, task: models.TaskTemplate, body, db: Session):
    """שיבוץ: רק מי שמורשה לשבץ, רק למשימות של הפלוגה, ורק חיילים מהפלוגה."""
    perms.require(perms.can_schedule(actor), "אין הרשאה לשבץ")
    company_id = get_actor_company_id(actor, db)
    perms.require(company_id is not None and task.company_id == company_id, "אין הרשאה")
    soldier_ids = set(body.soldierIds) | {sid for slot in body.slots for sid in slot.soldierIds}
    members = set(company_soldier_ids(company_id, db))
    perms.require(soldier_ids <= members, "אחד החיילים לא שייך ליחידה שלך")



@router.get("", response_model=List[schemas.AssignmentOut])
def get_assignments(
    date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
    actor: models.Soldier = Depends(get_current_soldier),
):
    visible = get_visible_soldier_ids(actor, db)
    company_id = get_actor_company_id(actor, db)
    if company_id is None:
        return []

    # רק שיבוצים של משימות הפלוגה שלי
    q = db.query(models.Assignment).join(models.TaskTemplate, models.Assignment.taskId == models.TaskTemplate.id) \
        .filter(models.TaskTemplate.company_id == company_id)
    if date:
        q = q.filter(models.Assignment.date == date)
    if visible is not None:
        # שמור שיבוץ אם לפחות אחד מהחיילים בו נמצא בתחום הנראות
        q = (
            q.join(models.AssignmentSoldier,
                   models.Assignment.id == models.AssignmentSoldier.assignment_id)
            .filter(models.AssignmentSoldier.soldier_id.in_(visible))
            .distinct()
        )
    return [assignment_to_out(a) for a in q.all()]


@router.post("", response_model=schemas.AssignmentOut)
def add_assignment(body: schemas.AssignmentCreate, db: Session = Depends(get_db), actor: models.Soldier = Depends(get_current_soldier)):
    task = db.query(models.TaskTemplate).filter(models.TaskTemplate.id == body.taskId).first()
    if not task:
        raise HTTPException(status_code=404, detail="משימה לא נמצאה")
    _check_write(actor, task, body, db)

    # בדיקה שאין כבר שיבוץ לאותה משימה באותו תאריך
    existing = db.query(models.Assignment).filter(
        models.Assignment.date == body.date,
        models.Assignment.taskId == body.taskId,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="כבר קיים שיבוץ למשימה זו בתאריך זה")

    a = models.Assignment(id=str(uuid.uuid4()), date=body.date, taskId=body.taskId)
    db.add(a)
    db.flush()

    for sid in body.soldierIds:
        db.add(models.AssignmentSoldier(id=str(uuid.uuid4()), assignment_id=a.id, soldier_id=sid))

    for slot in body.slots:
        hs = models.HourSlot(id=str(uuid.uuid4()), assignment_id=a.id, hour=slot.hour)
        db.add(hs)
        db.flush()
        for sid in slot.soldierIds:
            db.add(models.HourSlotSoldier(id=str(uuid.uuid4()), hour_slot_id=hs.id, soldier_id=sid))

    db.commit()
    db.refresh(a)
    return assignment_to_out(a)


@router.put("/{assignment_id}", response_model=schemas.AssignmentOut)
def update_assignment(assignment_id: str, body: schemas.AssignmentUpdate, db: Session = Depends(get_db), actor: models.Soldier = Depends(get_current_soldier)):
    a = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="שיבוץ לא נמצא")
    _check_write(actor, a.task, body, db)

    # מחיקת כל הנתונים הישנים ויצירה מחדש
    for s in a.soldiers:
        db.delete(s)
    for slot in a.hour_slots:
        for hs in slot.soldiers:
            db.delete(hs)
        db.delete(slot)
    db.flush()

    for sid in body.soldierIds:
        db.add(models.AssignmentSoldier(id=str(uuid.uuid4()), assignment_id=a.id, soldier_id=sid))

    for slot in body.slots:
        hs = models.HourSlot(id=str(uuid.uuid4()), assignment_id=a.id, hour=slot.hour)
        db.add(hs)
        db.flush()
        for sid in slot.soldierIds:
            db.add(models.HourSlotSoldier(id=str(uuid.uuid4()), hour_slot_id=hs.id, soldier_id=sid))

    db.commit()
    db.refresh(a)
    return assignment_to_out(a)


@router.delete("/{assignment_id}")
def delete_assignment(assignment_id: str, db: Session = Depends(get_db), actor: models.Soldier = Depends(get_current_soldier)):
    a = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="שיבוץ לא נמצא")
    perms.require(perms.can_schedule(actor), "אין הרשאה לשבץ")
    company_id = get_actor_company_id(actor, db)
    if a.task.company_id != company_id:
        raise HTTPException(status_code=403, detail="אין הרשאה")
    db.delete(a)
    db.commit()
    return {"ok": True}
