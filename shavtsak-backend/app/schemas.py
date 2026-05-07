"""
schemas.py — הגדרת צורת הנתונים שנכנסים ויוצאים מה-API.
Pydantic מוודא שהנתונים תקינים לפני שמגיעים לקוד.
"""

from pydantic import BaseModel, Field
from typing import Optional, List


# ── Companies ─────────────────────────────────────────────────────────────────

class CompanyCreate(BaseModel):
    name: str
    battalion_id: Optional[str] = None

class CompanyUpdate(BaseModel):
    name: str
    battalion_id: Optional[str] = None

class CompanyOut(BaseModel):
    id: str
    name: str
    # validation_alias → קריאה מ-ORM (snake_case), פלט JSON → camelCase
    battalionId: Optional[str] = Field(None, validation_alias='battalion_id')
    model_config = {"from_attributes": True}


# ── Sections ──────────────────────────────────────────────────────────────────

class SectionCreate(BaseModel):
    name: str
    company_id: Optional[str] = None

class SectionUpdate(BaseModel):
    name: str
    company_id: Optional[str] = None

class SectionOut(BaseModel):
    id: str
    name: str
    companyId: Optional[str] = Field(None, validation_alias='company_id')
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
    managedCompanyId: Optional[str] = None

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
    managedCompanyId: Optional[str] = Field(None, validation_alias='managed_company_id')
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

class MeOut(SoldierOut):
    isDeveloper: bool = False
    hasPassword: bool = False


class LoginRequest(BaseModel):
    soldierId: str

class PasswordLoginRequest(BaseModel):
    identifier: str  # personalNumber or idNumber
    password: str

class ClaimRequest(BaseModel):
    userId: str
    personalNumber: Optional[str] = None
    idNumber: Optional[str] = None

class SetPasswordRequest(BaseModel):
    password: str

class ResetCodeCreateRequest(BaseModel):
    soldierId: str  # commander specifies which soldier needs a reset

class ResetCodeUseRequest(BaseModel):
    identifier: str  # personalNumber or idNumber
    code: str
    newPassword: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    soldier: SoldierOut

class ResetCodeOut(BaseModel):
    code: str  # plain 6-digit code shown once to the commander

class RegisterRequest(BaseModel):
    identifier: str  # personalNumber or idNumber
    password: str


class BootstrapIn(BaseModel):
    firstName: str
    lastName: str
    rank: str
    personalNumber: Optional[str] = None
    idNumber: Optional[str] = None
    phone: str = ""
    password: str
    unitName: str
    unitType: str  # "section" | "company"
