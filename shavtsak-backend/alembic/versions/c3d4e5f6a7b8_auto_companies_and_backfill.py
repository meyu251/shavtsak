"""auto companies + backfill company_id for tasks and contacts

Revision ID: c3d4e5f6a7b8
Revises: 7c8deeda6a80

מה ה-migration עושה:
1. מוסיף companies.is_auto (פלוגה אוטומטית שעוטפת מחלקה בודדת).
2. מנקה מיילים ריקים ("") ל-NULL — אחרת אילוץ ה-unique חוסם שמירת חייל שני בלי מייל.
3. מפקד פלוגה בלי פלוגה מקבל פלוגה אמיתית משלו.
   נתונים מלפני multi-tenancy: אם יש בדיוק מפקד פלוגה אחד כזה ואין פלוגות קיימות,
   זו המערכת הישנה של יחידה אחת — כל המחלקות בלי פלוגה עוברות לפלוגה שלו.
4. כל מחלקה אחרת בלי פלוגה מקבלת פלוגה אוטומטית משלה (אף פעם לא משותפת).
5. משימות בלי company_id: לפי הפלוגה של החיילים שהיו משובצים אליהן.
   אם אין שיבוצים ויש בדיוק פלוגה אמיתית אחת — אליה.
   אנשי קשר בלי company_id: אם יש בדיוק פלוגה אמיתית אחת — אליה.
"""
from typing import Sequence, Union
from collections import Counter
import uuid

from alembic import op
import sqlalchemy as sa


revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = '7c8deeda6a80'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('companies') as batch_op:
        batch_op.add_column(sa.Column('is_auto', sa.Boolean(), nullable=False, server_default=sa.false()))

    conn = op.get_bind()

    # 2. מיילים ריקים → NULL
    conn.execute(sa.text("UPDATE soldiers SET email = NULL WHERE TRIM(email) = ''"))
    conn.execute(sa.text("UPDATE users SET email = NULL WHERE TRIM(email) = ''"))

    def new_company(name: str, is_auto: bool) -> str:
        cid = str(uuid.uuid4())
        conn.execute(
            sa.text("INSERT INTO companies (id, name, is_auto) VALUES (:id, :name, :auto)"),
            {"id": cid, "name": name, "auto": is_auto},
        )
        return cid

    # 3. מפקדי פלוגה בלי פלוגה
    had_companies = conn.execute(sa.text("SELECT COUNT(*) FROM companies")).scalar() > 0
    commanders = conn.execute(sa.text(
        "SELECT id, \"firstName\", \"lastName\" FROM soldiers "
        "WHERE \"permissionLevel\" = 'company_commander' AND managed_company_id IS NULL"
    )).fetchall()
    for sid, first, last in commanders:
        cid = new_company(f"הפלוגה של {first} {last}", False)
        conn.execute(sa.text("UPDATE soldiers SET managed_company_id = :c WHERE id = :s"), {"c": cid, "s": sid})
        if len(commanders) == 1 and not had_companies:
            conn.execute(sa.text("UPDATE sections SET company_id = :c WHERE company_id IS NULL"), {"c": cid})

    # 4. מחלקות בלי פלוגה
    sections = conn.execute(sa.text("SELECT id, name FROM sections WHERE company_id IS NULL")).fetchall()
    for sec_id, name in sections:
        cid = new_company(name, True)
        conn.execute(sa.text("UPDATE sections SET company_id = :c WHERE id = :s"), {"c": cid, "s": sec_id})

    real_companies = [r[0] for r in conn.execute(sa.text("SELECT id FROM companies WHERE is_auto = false")).fetchall()]
    single_real = real_companies[0] if len(real_companies) == 1 else None

    # 5. משימות בלי פלוגה
    tasks = [r[0] for r in conn.execute(sa.text("SELECT id FROM task_templates WHERE company_id IS NULL")).fetchall()]
    for task_id in tasks:
        rows = conn.execute(sa.text(
            "SELECT COALESCE(sec.company_id, s.managed_company_id) FROM assignments a "
            "JOIN assignment_soldiers ast ON ast.assignment_id = a.id "
            "JOIN soldiers s ON s.id = ast.soldier_id "
            "LEFT JOIN sections sec ON sec.id = s.\"sectionId\" "
            "WHERE a.\"taskId\" = :t"
        ), {"t": task_id}).fetchall()
        counts = Counter(r[0] for r in rows if r[0])
        target = counts.most_common(1)[0][0] if counts else single_real
        if target:
            conn.execute(sa.text("UPDATE task_templates SET company_id = :c WHERE id = :t"), {"c": target, "t": task_id})

    if single_real:
        conn.execute(sa.text("UPDATE extra_contacts SET company_id = :c WHERE company_id IS NULL"), {"c": single_real})


def downgrade() -> None:
    with op.batch_alter_table('companies') as batch_op:
        batch_op.drop_column('is_auto')
