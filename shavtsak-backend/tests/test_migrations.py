"""The data migrations must turn pre-multi-tenancy data into a working setup."""
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import text

from tests.conftest import reset_schema, engine

BACKEND_DIR = Path(__file__).resolve().parent.parent


def alembic_cfg():
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    return cfg


def test_legacy_single_unit_data_is_migrated():
    reset_schema()
    cfg = alembic_cfg()
    command.upgrade(cfg, "7c8deeda6a80")  # state of production before these fixes
    with engine.begin() as c:
        c.execute(text("INSERT INTO sections (id, name) VALUES ('s1', 'מחלקה 1'), ('s2', 'מחלקה 2')"))
        c.execute(text(
            'INSERT INTO soldiers (id, "firstName", "lastName", phone, role, rank, "isActive", "sectionId", "permissionLevel", email) VALUES '
            "('c1','מ','י','','','סרן',true,NULL,'company_commander',''),"
            "('a1','א','א','','','',true,'s1','soldier',NULL),"
            "('n1','ב','ב','','','',true,NULL,'soldier',NULL)"))
        c.execute(text(
            'INSERT INTO task_templates (id, name, "startTime", "endTime", "requiredCount", location, notes, hourly) VALUES '
            "('t1','שמירה','08:00','12:00',1,'','',false),('t2','מטבח','08:00','12:00',1,'','',false)"))
        c.execute(text("INSERT INTO assignments (id, date, \"taskId\") VALUES ('as1','2026-06-01','t1')"))
        c.execute(text("INSERT INTO assignment_soldiers (id, assignment_id, soldier_id) VALUES ('x1','as1','a1')"))
        c.execute(text("INSERT INTO extra_contacts (id, name, phone, notes) VALUES ('e1','רבש\"ץ','','')"))
    command.upgrade(cfg, "head")
    with engine.begin() as c:
        company = c.execute(text("SELECT managed_company_id FROM soldiers WHERE id='c1'")).scalar()
        assert company
        assert c.execute(text("SELECT COUNT(*) FROM sections WHERE company_id = :c"), {"c": company}).scalar() == 2
        assert c.execute(text("SELECT COUNT(*) FROM task_templates WHERE company_id = :c"), {"c": company}).scalar() == 2
        assert c.execute(text("SELECT company_id FROM extra_contacts")).scalar() == company
        assert c.execute(text("SELECT COUNT(*) FROM soldiers WHERE company_id = :c"), {"c": company}).scalar() == 3
        assert c.execute(text("SELECT email FROM soldiers WHERE id='c1'")).scalar() is None
        assert c.execute(text("SELECT join_code FROM companies WHERE id = :c"), {"c": company}).scalar()
    command.downgrade(cfg, "7c8deeda6a80")
    command.upgrade(cfg, "head")


def test_sections_of_unrelated_units_get_separate_auto_companies():
    reset_schema()
    cfg = alembic_cfg()
    command.upgrade(cfg, "7c8deeda6a80")
    with engine.begin() as c:
        c.execute(text("INSERT INTO companies (id, name) VALUES ('co', 'פלוגה')"))
        c.execute(text("INSERT INTO sections (id, name) VALUES ('s1', 'א'), ('s2', 'ב')"))
    command.upgrade(cfg, "head")
    with engine.begin() as c:
        rows = c.execute(text("SELECT s.company_id, co.is_auto FROM sections s JOIN companies co ON co.id = s.company_id")).fetchall()
        assert len({r[0] for r in rows}) == 2 and all(r[1] for r in rows)
