"""
migrate_data.py — מעביר נתונים מ-SQLite המקומי ל-PostgreSQL (Neon).
הרץ פעם אחת: python migrate_data.py
"""
import sqlite3
import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()

SQLITE_PATH = "shavtsak.db"
PG_URL = os.getenv("DATABASE_URL")

BOOLEAN_COLUMNS = {
    "soldiers": ["isActive"],
    "users": ["is_developer"],
    "reset_codes": ["used"],
    "task_templates": ["hourly"],
}

TABLES = [
    "companies",
    "sections",
    "soldiers",
    "users",
    "reset_codes",
    "soldier_extra_permissions",
    "task_templates",
    "assignments",
    "assignment_soldiers",
    "hour_slots",
    "hour_slot_soldiers",
    "extra_contacts",
]

def migrate():
    sqlite = sqlite3.connect(SQLITE_PATH)
    sqlite.row_factory = sqlite3.Row

    pg = psycopg2.connect(PG_URL)
    pg_cur = pg.cursor()

    for table in TABLES:
        rows = sqlite.execute(f"SELECT * FROM {table}").fetchall()
        if not rows:
            print(f"  {table}: ריק, מדלג")
            continue

        cols = rows[0].keys()
        cols_str = ", ".join(f'"{c}"' for c in cols)
        placeholders = ", ".join(["%s"] * len(cols))

        # מחיקת נתונים קיימים (למקרה שמריצים שוב)
        pg_cur.execute(f'DELETE FROM "{table}"')

        bool_cols = BOOLEAN_COLUMNS.get(table, [])
        bool_idxs = [list(cols).index(c) for c in bool_cols if c in cols]

        def fix_row(row):
            row = list(row)
            for i in bool_idxs:
                row[i] = bool(row[i])
            return tuple(row)

        data = [fix_row(row) for row in rows]
        pg_cur.executemany(
            f'INSERT INTO "{table}" ({cols_str}) VALUES ({placeholders})',
            data
        )
        print(f"  {table}: {len(data)} שורות")

    pg.commit()
    pg_cur.close()
    pg.close()
    sqlite.close()
    print("\nהעברה הושלמה בהצלחה!")

if __name__ == "__main__":
    migrate()
