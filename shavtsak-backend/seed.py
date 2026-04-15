"""
seed.py — מאכלס את בסיס הנתונים עם נתוני ברירת המחדל.
מקביל ל-defaultData שב-store.ts.

הרצה: python seed.py
"""

from app.database import SessionLocal, engine, Base
from app import models
import uuid

Base.metadata.create_all(bind=engine)
db = SessionLocal()

# ── בדיקה שה-DB לא מאוכלס כבר ──────────────────────────────────────────────
if db.query(models.Soldier).count() > 0:
    print("ה-DB כבר מאוכלס. אם רוצה לאפס, מחק את shavtsak.db והרץ מחדש.")
    db.close()
    exit()

# ── מחלקות ───────────────────────────────────────────────────────────────────
section1 = models.Section(id="section1", name="מחלקה 1")
section2 = models.Section(id="section2", name="מחלקה 2")
db.add_all([section1, section2])
db.flush()

# ── חיילים ───────────────────────────────────────────────────────────────────
soldiers_data = [
    dict(id="1", firstName="מאיר", lastName="יוסט", rank="סרן", phone="050-1234567",
         role="מפקד פלוגה", isActive=True, sectionId=None, permissionLevel="company_commander"),
    dict(id="2", firstName="ניר", lastName="לוסטיג", rank="סמל", phone="050-2234567",
         role="מפקד מחלקה", isActive=True, sectionId="section1", permissionLevel="section_commander"),
    dict(id="3", firstName="מיכאל", lastName="ירט", rank="סמל", phone="050-5234567",
         role="מפקד מחלקה", isActive=True, sectionId="section2", permissionLevel="section_commander"),
    dict(id="4", firstName="אביתר", lastName="בן-שושן", rank='רב טוראי (רב"ט)', phone="050-3234567",
         role="נהג", isActive=True, sectionId="section1", permissionLevel="soldier"),
    dict(id="5", firstName="יגאל", lastName="שטיינמיץ", rank="טוראי", phone="050-4234567",
         role="לוחם", isActive=True, sectionId="section1", permissionLevel="soldier"),
    dict(id="6", firstName="אסף", lastName="פרוינד", rank="טוראי", phone="050-6234567",
         role="לוחם", isActive=True, sectionId="section2", permissionLevel="soldier"),
    dict(id="7", firstName="אלון", lastName="האוקיפ", rank='רב טוראי (רב"ט)', phone="050-7234567",
         role="לוחם", isActive=True, sectionId="section2", permissionLevel="soldier"),
    dict(id="8", firstName="טאי", lastName="ארזואן", rank="טוראי", phone="050-8234567",
         role="לוחם", isActive=True, sectionId="section1", permissionLevel="soldier"),
]

for s in soldiers_data:
    db.add(models.Soldier(**s))
db.flush()

# ── משימות ───────────────────────────────────────────────────────────────────
tasks_data = [
    dict(id="1", name="סיור בוקר", startTime="07:00", endTime="15:00", requiredCount=3, location='כרמל א', notes="", hourly=False),
    dict(id="2", name="סיור ערב",  startTime="15:00", endTime="23:00", requiredCount=3, location='כרמל א', notes="", hourly=False),
    dict(id="3", name="סיור לילה", startTime="23:00", endTime="07:00", requiredCount=3, location='כרמל א', notes="", hourly=False),
    dict(id="4", name="שמירה בשער", startTime="07:00", endTime="19:00", requiredCount=2, location='שער הבסיס', notes="", hourly=True),
    dict(id="5", name="תורן",       startTime="00:00", endTime="23:59", requiredCount=1, location='חפ"ק', notes="", hourly=False),
]

for t in tasks_data:
    db.add(models.TaskTemplate(**t))

db.commit()
db.close()

print("✅ בסיס הנתונים אוכלס בהצלחה!")
print()
print("עכשיו אפשר להתחבר עם POST /auth/login")
print('דוגמה: { "soldierId": "1" }  ← מאיר יוסט (מפקד פלוגה)')
print('דוגמה: { "soldierId": "2" }  ← ניר לוסטיג (מפקד מחלקה)')
print('דוגמה: { "soldierId": "5" }  ← יגאל שטיינמיץ (חייל)')
