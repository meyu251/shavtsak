"""initial schema

Revision ID: 8a7d80830fdd
Revises:
Create Date: 2026-04-15 16:15:13.070833

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '8a7d80830fdd'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('companies',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('battalion_id', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table('sections',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table('soldiers',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('firstName', sa.String(), nullable=False),
        sa.Column('lastName', sa.String(), nullable=False),
        sa.Column('phone', sa.String(), nullable=True),
        sa.Column('role', sa.String(), nullable=True),
        sa.Column('rank', sa.String(), nullable=False),
        sa.Column('isActive', sa.Boolean(), nullable=True),
        sa.Column('sectionId', sa.String(), nullable=True),
        sa.Column('personalNumber', sa.String(), nullable=True),
        sa.Column('idNumber', sa.String(), nullable=True),
        sa.Column('address', sa.String(), nullable=True),
        sa.Column('birthDate', sa.String(), nullable=True),
        sa.Column('permissionLevel', sa.String(), nullable=True),
        sa.Column('email', sa.String(), nullable=True),
        sa.Column('managed_company_id', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['sectionId'], ['sections.id']),
        sa.ForeignKeyConstraint(['managed_company_id'], ['companies.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email')
    )
    op.create_table('users',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=True),
        sa.Column('google_sub', sa.String(), nullable=True),
        sa.Column('soldier_id', sa.String(), nullable=True),
        sa.Column('is_developer', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('password_hash', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['soldier_id'], ['soldiers.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
        sa.UniqueConstraint('google_sub'),
        sa.UniqueConstraint('soldier_id')
    )
    op.create_table('reset_codes',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('code_hash', sa.String(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('used', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table('soldier_extra_permissions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('soldier_id', sa.String(), nullable=False),
        sa.Column('permission', sa.String(), nullable=False),
        sa.ForeignKeyConstraint(['soldier_id'], ['soldiers.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table('task_templates',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('startTime', sa.String(), nullable=False),
        sa.Column('endTime', sa.String(), nullable=False),
        sa.Column('requiredCount', sa.Integer(), nullable=True),
        sa.Column('location', sa.String(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('hourly', sa.Boolean(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table('assignments',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('date', sa.String(), nullable=False),
        sa.Column('taskId', sa.String(), nullable=False),
        sa.ForeignKeyConstraint(['taskId'], ['task_templates.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table('assignment_soldiers',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('assignment_id', sa.String(), nullable=False),
        sa.Column('soldier_id', sa.String(), nullable=False),
        sa.ForeignKeyConstraint(['assignment_id'], ['assignments.id']),
        sa.ForeignKeyConstraint(['soldier_id'], ['soldiers.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table('hour_slots',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('assignment_id', sa.String(), nullable=False),
        sa.Column('hour', sa.String(), nullable=False),
        sa.ForeignKeyConstraint(['assignment_id'], ['assignments.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table('hour_slot_soldiers',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('hour_slot_id', sa.String(), nullable=False),
        sa.Column('soldier_id', sa.String(), nullable=False),
        sa.ForeignKeyConstraint(['hour_slot_id'], ['hour_slots.id']),
        sa.ForeignKeyConstraint(['soldier_id'], ['soldiers.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table('extra_contacts',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('phone', sa.String(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_assignment_soldier_assignment', 'assignment_soldiers', ['assignment_id'])
    op.create_index('ix_assignment_date', 'assignments', ['date'])
    op.create_index('ix_hour_slot_soldier_slot', 'hour_slot_soldiers', ['hour_slot_id'])
    op.create_index('ix_hour_slot_assignment', 'hour_slots', ['assignment_id'])
    op.create_index('ix_soldier_email', 'soldiers', ['email'])
    op.create_index('ix_section_company', 'sections', ['company_id'])
    op.create_index('ix_soldier_managed_company', 'soldiers', ['managed_company_id'])
    op.create_index('ix_user_soldier', 'users', ['soldier_id'])
    op.create_index('ix_user_google_sub', 'users', ['google_sub'])


def downgrade() -> None:
    op.drop_table('extra_contacts')
    op.drop_table('hour_slot_soldiers')
    op.drop_table('hour_slots')
    op.drop_table('assignment_soldiers')
    op.drop_table('assignments')
    op.drop_table('task_templates')
    op.drop_table('soldier_extra_permissions')
    op.drop_table('reset_codes')
    op.drop_table('users')
    op.drop_table('soldiers')
    op.drop_table('sections')
    op.drop_table('companies')
