"""soldiers.company_id — every soldier belongs to a company, even without a section

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('soldiers') as batch_op:
        batch_op.add_column(sa.Column('company_id', sa.String(), nullable=True))
        batch_op.create_foreign_key('fk_soldiers_company_id', 'companies', ['company_id'], ['id'])
    conn = op.get_bind()
    # לפי המחלקה, ואם אין מחלקה — מפקד הפלוגה שייך לפלוגה שהוא מנהל
    conn.execute(sa.text(
        "UPDATE soldiers SET company_id = (SELECT company_id FROM sections WHERE sections.id = soldiers.\"sectionId\") "
        "WHERE \"sectionId\" IS NOT NULL"
    ))
    conn.execute(sa.text(
        "UPDATE soldiers SET company_id = managed_company_id WHERE company_id IS NULL AND managed_company_id IS NOT NULL"
    ))
    # חיילים ישנים בלי מחלקה: אם יש בדיוק פלוגה אמיתית אחת — אליה
    real = [r[0] for r in conn.execute(sa.text("SELECT id FROM companies WHERE is_auto = false")).fetchall()]
    if len(real) == 1:
        conn.execute(sa.text("UPDATE soldiers SET company_id = :c WHERE company_id IS NULL"), {"c": real[0]})


def downgrade() -> None:
    with op.batch_alter_table('soldiers') as batch_op:
        batch_op.drop_constraint('fk_soldiers_company_id', type_='foreignkey')
        batch_op.drop_column('company_id')
