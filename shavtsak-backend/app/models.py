"""
models.py — הגדרת הטבלאות בבסיס הנתונים.
כל class כאן = טבלה אחת ב-SQLite.
מבוסס על types.ts מהפרונטאנד.
"""

import uuid
from sqlalchemy import Column, String, Boolean, Integer, ForeignKey, Text, Date, Index
from sqlalchemy.orm import relationship
from app.database import Base


def new_id():
    return str(uuid.uuid4())


# ── Companies (פלוגות) ────────────────────────────────────────────────────────

class Company(Base):
    __tablename__ = "companies"

    id = Column(String, primary_key=True, default=new_id)
    name = Column(String, nullable=False)
    battalion_id = Column(String, nullable=True)  # ללא FK — לשימוש עתידי עם טבלת גדודים

    sections = relationship("Section", back_populates="company")


# ── Sections (מחלקות) ─────────────────────────────────────────────────────────

class Section(Base):
    __tablename__ = "sections"

    id = Column(String, primary_key=True, default=new_id)
    name = Column(String, nullable=False)
    company_id = Column(String, ForeignKey("companies.id"), nullable=True)

    soldiers = relationship("Soldier", back_populates="section")
    company = relationship("Company", back_populates="sections")


# ── Soldiers (חיילים) ─────────────────────────────────────────────────────────

class Soldier(Base):
    __tablename__ = "soldiers"

    id = Column(String, primary_key=True, default=new_id)
    firstName = Column(String, nullable=False)
    lastName = Column(String, nullable=False)
    phone = Column(String, default="")
    role = Column(String, default="")
    rank = Column(String, nullable=False)
    isActive = Column(Boolean, default=True)
    sectionId = Column(String, ForeignKey("sections.id"), nullable=True)

    # פרטים אישיים
    personalNumber = Column(String, nullable=True)
    idNumber = Column(String, nullable=True)
    address = Column(String, nullable=True)
    birthDate = Column(String, nullable=True)  # "YYYY-MM-DD"

    # הרשאות
    permissionLevel = Column(String, default="soldier")  # soldier / section_commander / company_commander
    email = Column(String, nullable=True, unique=True)   # deprecated — ראה טבלת users
    managed_company_id = Column(String, ForeignKey("companies.id"), nullable=True)
    # ^ מגדיר את תחום ה-scope של מפקד פלוגה (כאשר אין לו sectionId)

    section = relationship("Section", back_populates="soldiers")
    extra_permissions = relationship("SoldierExtraPermission", back_populates="soldier", cascade="all, delete-orphan")


# ── Users (משתמשים) ───────────────────────────────────────────────────────────

class User(Base):
    """
    משתמש שמחובר לאפליקציה.
    נפרד מ-Soldier — חייל יכול להיות ברשימה בלי להיות משתמש.
    Claiming: קישור User ל-Soldier דרך personalNumber/idNumber.
    """
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=new_id)
    email = Column(String, nullable=True, unique=True)
    google_sub = Column(String, nullable=True, unique=True)  # Google user ID ("id" מ-userinfo)
    soldier_id = Column(String, ForeignKey("soldiers.id"), nullable=True, unique=True)

    soldier = relationship("Soldier")


class SoldierExtraPermission(Base):
    """הרשאות נוספות לחייל — כל שורה = הרשאה אחת (extended_data / management / schedule / tasks)"""
    __tablename__ = "soldier_extra_permissions"

    id = Column(String, primary_key=True, default=new_id)
    soldier_id = Column(String, ForeignKey("soldiers.id"), nullable=False)
    permission = Column(String, nullable=False)

    soldier = relationship("Soldier", back_populates="extra_permissions")


# ── Task Templates (תבניות משימות) ───────────────────────────────────────────

class TaskTemplate(Base):
    __tablename__ = "task_templates"

    id = Column(String, primary_key=True, default=new_id)
    name = Column(String, nullable=False)
    startTime = Column(String, nullable=False)   # "07:00"
    endTime = Column(String, nullable=False)     # "15:00"
    requiredCount = Column(Integer, default=1)
    location = Column(String, default="")
    notes = Column(Text, default="")
    hourly = Column(Boolean, default=False)

    assignments = relationship("Assignment", back_populates="task")


# ── Assignments (שיבוצים) ────────────────────────────────────────────────────

class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(String, primary_key=True, default=new_id)
    date = Column(String, nullable=False)   # "2026-04-15"
    taskId = Column(String, ForeignKey("task_templates.id"), nullable=False)

    task = relationship("TaskTemplate", back_populates="assignments")
    soldiers = relationship("AssignmentSoldier", back_populates="assignment", cascade="all, delete-orphan")
    hour_slots = relationship("HourSlot", back_populates="assignment", cascade="all, delete-orphan")


class AssignmentSoldier(Base):
    """חיילים משובצים למשימה — כל שורה = חייל אחד בשיבוץ"""
    __tablename__ = "assignment_soldiers"

    id = Column(String, primary_key=True, default=new_id)
    assignment_id = Column(String, ForeignKey("assignments.id"), nullable=False)
    soldier_id = Column(String, ForeignKey("soldiers.id"), nullable=False)

    assignment = relationship("Assignment", back_populates="soldiers")


class HourSlot(Base):
    """פירוט שעתי — שעה ספציפית בתוך שיבוץ"""
    __tablename__ = "hour_slots"

    id = Column(String, primary_key=True, default=new_id)
    assignment_id = Column(String, ForeignKey("assignments.id"), nullable=False)
    hour = Column(String, nullable=False)  # "10:00"

    assignment = relationship("Assignment", back_populates="hour_slots")
    soldiers = relationship("HourSlotSoldier", back_populates="hour_slot", cascade="all, delete-orphan")


class HourSlotSoldier(Base):
    """חיילים בשעה ספציפית"""
    __tablename__ = "hour_slot_soldiers"

    id = Column(String, primary_key=True, default=new_id)
    hour_slot_id = Column(String, ForeignKey("hour_slots.id"), nullable=False)
    soldier_id = Column(String, ForeignKey("soldiers.id"), nullable=False)

    hour_slot = relationship("HourSlot", back_populates="soldiers")


# ── Extra Contacts (אנשי קשר נוספים) ────────────────────────────────────────

class ExtraContact(Base):
    __tablename__ = "extra_contacts"

    id = Column(String, primary_key=True, default=new_id)
    name = Column(String, nullable=False)
    phone = Column(String, default="")
    notes = Column(Text, default="")


# ── Indexes ───────────────────────────────────────────────────────────────────

Index("ix_assignment_date", Assignment.date)
Index("ix_soldier_email", Soldier.email)
Index("ix_assignment_soldier_assignment", AssignmentSoldier.assignment_id)
Index("ix_hour_slot_assignment", HourSlot.assignment_id)
Index("ix_hour_slot_soldier_slot", HourSlotSoldier.hour_slot_id)
# Hierarchy + isolation indexes
Index("ix_section_company", Section.company_id)
Index("ix_soldier_managed_company", Soldier.managed_company_id)
Index("ix_user_soldier", User.soldier_id)
Index("ix_user_google_sub", User.google_sub)
