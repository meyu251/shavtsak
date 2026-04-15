"""
schemas.py — הגדרת צורת הנתונים שנכנסים ויוצאים מה-API.
Pydantic מוודא שהנתונים תקינים לפני שמגיעים לקוד.
"""

from pydantic import BaseModel
from typing import Optional, List


# ── Sections ──────────────────────────────────────────────────────────────────

class SectionCreate(BaseModel):
    name: str

class SectionUpdate(BaseModel):
    name: str

class SectionOut(BaseModel):
    id: str
    name: str
    model_config = {"from_attributes": True}


# ── Soldiers ──────────────────────────────────────────────────────────────────

class SoldierCreate(BaseModel):
    firstName: str
    lastName: str
    phone: str = ""
    role: str = ""
    rank: str
    isActive: bool = True
    sectionId: Optional[str] = None
    personalNumber: Optional[str] = None
    idNumber: Optional[str] = None
    address: Optional[str] = None
    birthDate: Optional[str] = None
    permissionLevel: str = "soldier"
    extraPermissions: List[str] = []
    email: Optional[str] = None

class SoldierUpdate(SoldierCreate):
    pass

class SoldierOut(BaseModel):
    id: str
    firstName: str
    lastName: str
    phone: str
    role: str
    rank: str
    isActive: bool
    sectionId: Optional[str]
    personalNumber: Optional[str]
    idNumber: Optional[str]
    address: Optional[str]
    birthDate: Optional[str]
    permissionLevel: str
    extraPermissions: List[str]
    email: Optional[str]
    model_config = {"from_attributes": True}


# ── Task Templates ────────────────────────────────────────────────────────────

class TaskCreate(BaseModel):
    name: str
    startTime: str
    endTime: str
    requiredCount: int = 1
    location: str = ""
    notes: str = ""
    hourly: bool = False

class TaskUpdate(TaskCreate):
    pass

class TaskOut(BaseModel):
    id: str
    name: str
    startTime: str
    endTime: str
    requiredCount: int
    location: str
    notes: str
    hourly: bool
    model_config = {"from_attributes": True}


# ── Assignments ───────────────────────────────────────────────────────────────

class HourSlotIn(BaseModel):
    hour: str
    soldierIds: List[str]

class AssignmentCreate(BaseModel):
    date: str           # "2026-04-15"
    taskId: str
    soldierIds: List[str]
    slots: List[HourSlotIn] = []

class AssignmentUpdate(BaseModel):
    soldierIds: List[str]
    slots: List[HourSlotIn] = []

class HourSlotOut(BaseModel):
    hour: str
    soldierIds: List[str]

class AssignmentOut(BaseModel):
    id: str
    date: str
    taskId: str
    soldierIds: List[str]
    slots: List[HourSlotOut]
    model_config = {"from_attributes": True}


# ── Extra Contacts ────────────────────────────────────────────────────────────

class ContactCreate(BaseModel):
    name: str
    phone: str = ""
    notes: str = ""

class ContactUpdate(ContactCreate):
    pass

class ContactOut(BaseModel):
    id: str
    name: str
    phone: str
    notes: str
    model_config = {"from_attributes": True}


# ── Auth ──────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    soldierId: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    soldier: SoldierOut
