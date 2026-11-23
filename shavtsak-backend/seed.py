"""
seed.py — מאכלס את בסיס הנתונים עם נתוני ברירת המחדל.
מקביל ל-defaultData שב-store.ts.

הרצה: python seed.py
"""

from app.database import SessionLocal, engine, Base
from app import models
from app.routers.auth import pwd_context
import uuid

DEMO_PASSWORD = "123456"

Base.metadata.create_all(bind=engine)
db = SessionLocal()

# ── בדיקה שה-DB לא מאוכלס כבר ──────────────────────────────────────────────
if db.query(models.Soldier).count() > 0:
    print("ה-DB כבר מאוכלס. אם רוצה לאפס, צור DB ריק, הרץ alembic upgrade head והרץ מחדש.")
    db.close()
    exit()

# ── פלוגות ומחלקות ───────────────────────────────────────────────────────────
company = models.Company(id="company1", name="פלוגה א", join_code="DEMO2026", signup_code="SOLD2026")
# יחידה נפרדת לגמרי — לבדיקה שהנתונים לא מתערבבים בין יחידות
auto_company = models.Company(id="company_auto1", name="מחלקה עצמאית", is_auto=True, signup_code="SOLD2027")
db.add_all([company, auto_company])
db.flush()
section1 = models.Section(id="section1", name="מחלקה 1", company_id="company1")
section2 = models.Section(id="section2", name="מחלקה 2", company_id="company1")
section3 = models.Section(id="section3", name="מחלקה עצמאית", company_id="company_auto1")
db.add_all([section1, section2, section3])
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
    dict(id="9", firstName="דנה", lastName="כהן", rank="סמל", phone="050-9234567",
         role="מפקדת מחלקה", isActive=True, sectionId="section3", permissionLevel="section_commander"),
]

for s in soldiers_data:
    s["personalNumber"] = f"100000{s['id']}"
    s["company_id"] = "company_auto1" if s["sectionId"] == "section3" else "company1"
    if s["id"] == "1":
        s["managed_company_id"] = "company1"
    db.add(models.Soldier(**s))
db.flush()

# ── חשבונות משתמש (כולם עם אותה סיסמת דמו) ──────────────────────────────────
for s in soldiers_data:
    db.add(models.User(
        id=f"user{s['id']}",
        soldier_id=s["id"],
        password_hash=pwd_context.hash(DEMO_PASSWORD),
        is_developer=(s["id"] == "1"),  # מפקד הפלוגה רואה את פאנל ההתחזות
    ))
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
    db.add(models.TaskTemplate(company_id="company1", **t))
db.add(models.TaskTemplate(id="6", name="שמירה במחלקה העצמאית", startTime="08:00", endTime="16:00",
                           requiredCount=1, location="", notes="", hourly=False, company_id="company_auto1"))

db.commit()
db.close()

print("✅ בסיס הנתונים אוכלס בהצלחה!")
print()
print("קוד הצטרפות מחלקות לפלוגה א: DEMO2026")
print("קוד הרשמת חיילים: פלוגה א SOLD2026, מחלקה עצמאית SOLD2027")
print(f"כניסה במסך הרגיל עם מספר אישי וסיסמא {DEMO_PASSWORD}:")
for s in soldiers_data:
    print(f"  {s['personalNumber']}  {s['firstName']} {s['lastName']} ({s['role']})")
