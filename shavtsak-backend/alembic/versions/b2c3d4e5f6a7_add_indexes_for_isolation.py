"""add indexes for isolation

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-04-19 00:01:00.000000

הוספת אינדקסים לעמודות החדשות לשיפור ביצועי שאילתות הבידוד.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    existing = {row[0] for row in conn.execute(sa.text(
        "SELECT indexname FROM pg_indexes WHERE schemaname='public'"
        " UNION SELECT name FROM sqlite_master WHERE type='index'"
        " UNION SELECT '' WHERE 1=0"
    )).fetchall()} if False else _get_indexes(conn)
    if 'ix_section_company' not in existing:
        op.create_index('ix_section_company', 'sections', ['company_id'])
    if 'ix_soldier_managed_company' not in existing:
        op.create_index('ix_soldier_managed_company', 'soldiers', ['managed_company_id'])
    if 'ix_user_soldier' not in existing:
        op.create_index('ix_user_soldier', 'users', ['soldier_id'])
    if 'ix_user_google_sub' not in existing:
        op.create_index('ix_user_google_sub', 'users', ['google_sub'])


def _get_indexes(conn) -> set:
    from sqlalchemy import inspect
    insp = inspect(conn)
    result = set()
    for table in insp.get_table_names():
        for idx in insp.get_indexes(table):
            result.add(idx['name'])
    return result


def downgrade() -> None:
    op.drop_index('ix_user_google_sub', table_name='users')
    op.drop_index('ix_user_soldier', table_name='users')
    op.drop_index('ix_soldier_managed_company', table_name='soldiers')
    op.drop_index('ix_section_company', table_name='sections')
