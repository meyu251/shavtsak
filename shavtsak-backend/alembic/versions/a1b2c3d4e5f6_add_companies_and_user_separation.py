"""add companies and user separation

Revision ID: a1b2c3d4e5f6
Revises: 8a7d80830fdd
Create Date: 2026-04-19 00:00:00.000000

שינויים:
- יצירת טבלת companies (פלוגות)
- הוספת company_id לטבלת sections
- הוספת managed_company_id לטבלת soldiers
- יצירת טבלת users (הפרדת משתמש מחייל)
- מיגרציית נתונים: יצירת User לכל Soldier עם email

הערה: המיגרציה אידמפוטנטית — בודקת קיום לפני יצירה
(create_all הוסר מ-main.py, אך ייתכן שכבר רץ בעבר).
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '8a7d80830fdd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    existing_tables = inspector.get_table_names()

    # 1. יצירת טבלת companies (אם לא קיימת)
    if 'companies' not in existing_tables:
        op.create_table(
            'companies',
            sa.Column('id', sa.String(), nullable=False),
            sa.Column('name', sa.String(), nullable=False),
            sa.Column('battalion_id', sa.String(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
        )

    # 2. הוספת company_id לטבלת sections (אם לא קיימת)
    section_cols = [col['name'] for col in inspector.get_columns('sections')]
    if 'company_id' not in section_cols:
        with op.batch_alter_table('sections') as batch_op:
            batch_op.add_column(sa.Column('company_id', sa.String(), nullable=True))

    # 3. הוספת managed_company_id לטבלת soldiers (אם לא קיימת)
    soldier_cols = [col['name'] for col in inspector.get_columns('soldiers')]
    if 'managed_company_id' not in soldier_cols:
        with op.batch_alter_table('soldiers') as batch_op:
            batch_op.add_column(sa.Column('managed_company_id', sa.String(), nullable=True))

    # 4. יצירת טבלת users (אם לא קיימת)
    if 'users' not in existing_tables:
        op.create_table(
            'users',
            sa.Column('id', sa.String(), nullable=False),
            sa.Column('email', sa.String(), nullable=True),
            sa.Column('google_sub', sa.String(), nullable=True),
            sa.Column('soldier_id', sa.String(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('email'),
            sa.UniqueConstraint('google_sub'),
            sa.UniqueConstraint('soldier_id'),
        )

    # 5. מיגרציית נתונים — יצירת User לכל חייל שיש לו email
    import uuid
    soldiers_with_email = conn.execute(
        sa.text("SELECT id, email FROM soldiers WHERE email IS NOT NULL AND email != ''")
    ).fetchall()
    for row in soldiers_with_email:
        existing_user = conn.execute(
            sa.text("SELECT id FROM users WHERE soldier_id = :sid OR email = :email"),
            {"sid": row[0], "email": row[1]},
        ).fetchone()
        if not existing_user:
            conn.execute(
                sa.text(
                    "INSERT INTO users (id, email, google_sub, soldier_id) "
                    "VALUES (:uid, :email, NULL, :sid)"
                ),
                {"uid": str(uuid.uuid4()), "email": row[1], "sid": row[0]},
            )


def downgrade() -> None:
    op.drop_table('users')

    with op.batch_alter_table('soldiers') as batch_op:
        batch_op.drop_column('managed_company_id')

    with op.batch_alter_table('sections') as batch_op:
        batch_op.drop_column('company_id')

    op.drop_table('companies')
