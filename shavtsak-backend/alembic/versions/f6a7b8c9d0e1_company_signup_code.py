"""companies.signup_code — code soldiers enter when they first sign up

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
"""
from typing import Sequence, Union
import secrets

from alembic import op
import sqlalchemy as sa


revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, Sequence[str], None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def upgrade() -> None:
    with op.batch_alter_table('companies') as batch_op:
        batch_op.add_column(sa.Column('signup_code', sa.String(), nullable=True))
        batch_op.create_unique_constraint('uq_companies_signup_code', ['signup_code'])
    conn = op.get_bind()
    for (cid,) in conn.execute(sa.text("SELECT id FROM companies")).fetchall():
        code = "".join(secrets.choice(ALPHABET) for _ in range(8))
        conn.execute(sa.text("UPDATE companies SET signup_code = :c WHERE id = :id"), {"c": code, "id": cid})


def downgrade() -> None:
    with op.batch_alter_table('companies') as batch_op:
        batch_op.drop_constraint('uq_companies_signup_code', type_='unique')
        batch_op.drop_column('signup_code')
