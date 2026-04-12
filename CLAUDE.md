@AGENTS.md

# שבצק — מערכת שיבוץ כוחות ומשימות

אפליקציית Web לניהול שיבוץ חיילים למשימות בפלוגה. בנויה עבור מפקדים בצבא.

## Tech Stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS** לעיצוב
- **localStorage** לאחסון נתונים (ללא שרת כרגע)
- RTL עברית מלאה (`dir="rtl"` ב-html)

## פקודות פיתוח

```bash
npm run dev      # הפעלת שרת פיתוח על localhost:3000
npm run build    # בנייה לייצור
npm run lint     # בדיקת קוד
```

## מבנה הפרויקט

```
app/
  page.tsx          # דף ראשי — ניווט בין הסעיפים
  soldiers/
    page.tsx        # ניהול כוח אדם (הוסף/ערוך/מחק חיילים)
  tasks/
    page.tsx        # ניהול משימות (הגדרת משימות, שעות, כמות)
  schedule/
    page.tsx        # שיבוץ יומי (שיבוץ חיילים למשימות לפי תאריך)
lib/
  types.ts          # טיפוסי TypeScript: Soldier, TaskTemplate, Assignment, AppData
  store.ts          # פונקציות CRUD + טעינה/שמירה מ-localStorage
```

## מודל הנתונים

```typescript
Soldier       — id, name, rank, phone, role, isActive
TaskTemplate  — id, name, startTime, endTime, requiredCount, location, notes
Assignment    — id, date (YYYY-MM-DD), taskId, soldierIds[]
AppData       — { soldiers, taskTemplates, assignments }
```

כל הנתונים נשמרים תחת המפתח `shavtsak_data` ב-localStorage.

## חוקי פיתוח

- כל דף הוא `"use client"` — אין Server Components (כי משתמשים ב-localStorage)
- RTL בכל מקום — לא להוסיף `dir="ltr"` אלא לשדות שדורשים זאת (טלפון, שעה)
- אין לשנות את מבנה `AppData` בלי לעדכן את `loadData()` ב-store.ts
- עיצוב: Tailwind בלבד, ללא קבצי CSS נפרדים

## תוכנית עתידית

- [ ] אימות משתמשים (Google Auth)
- [ ] הרשאות: מפקד / חייל / קריאה בלבד
- [ ] מסד נתונים בענן (PostgreSQL / Supabase)
- [ ] ייצוא שיבוץ ל-PDF / Excel
- [ ] תצוגת שבוע
