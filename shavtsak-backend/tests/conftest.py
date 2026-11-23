"""
Test setup.

The tests run against a real PostgreSQL database, because production uses
PostgreSQL and some behaviour (unique constraints, migrations) differs on SQLite.

    set TEST_DATABASE_URL=postgresql://user:pass@host/shavtsak_test   (Windows)
    export TEST_DATABASE_URL=...                                      (Linux/macOS)
    pytest

WARNING: every test wipes the database in TEST_DATABASE_URL. Never point it
at a database with real data.
"""
import os
import runpy
from pathlib import Path

import pytest

TEST_DB = os.getenv("TEST_DATABASE_URL")
if not TEST_DB:
    pytest.exit("Set TEST_DATABASE_URL to an EMPTY PostgreSQL database used only for tests.", returncode=2)
os.environ["DATABASE_URL"] = TEST_DB  # must happen before the app is imported

from sqlalchemy import text  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from app.database import engine, Base  # noqa: E402
from app import models  # noqa: E402,F401  (registers all tables)
from app.main import app as fastapi_app  # noqa: E402

BACKEND_DIR = Path(__file__).resolve().parent.parent
PASSWORD = "123456"


def reset_schema():
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))


@pytest.fixture
def seeded():
    """Fresh database with the demo data from seed.py."""
    reset_schema()
    Base.metadata.create_all(bind=engine)
    cwd = os.getcwd()
    os.chdir(BACKEND_DIR)
    try:
        runpy.run_path(str(BACKEND_DIR / "seed.py"), run_name="__main__")
    finally:
        os.chdir(cwd)
    yield


class Api:
    """Thin wrapper around TestClient that remembers who is logged in."""

    def __init__(self, client: TestClient, token: str | None = None):
        self.client = client
        self.token = token

    def _h(self):
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}

    def get(self, path, **kw):
        return self.client.get(path, headers=self._h(), **kw)

    def post(self, path, json=None, **kw):
        return self.client.post(path, json=json, headers=self._h(), **kw)

    def put(self, path, json=None, **kw):
        return self.client.put(path, json=json, headers=self._h(), **kw)

    def delete(self, path, **kw):
        return self.client.delete(path, headers=self._h(), **kw)

    # convenience
    def soldiers(self):
        r = self.get("/soldiers")
        assert r.status_code == 200, r.text
        return {s["id"]: s for s in r.json()}

    def soldier(self, soldier_id):
        return self.soldiers()[soldier_id]


@pytest.fixture
def client(seeded):
    return TestClient(fastapi_app)


@pytest.fixture
def login(client):
    def _login(identifier, password=PASSWORD) -> Api:
        r = client.post("/auth/password/login", json={"identifier": identifier, "password": password})
        assert r.status_code == 200, f"login {identifier}: {r.status_code} {r.text}"
        return Api(client, r.json()["access_token"])
    return _login


@pytest.fixture
def anon(client):
    return Api(client)


@pytest.fixture
def bootstrap(client):
    def _bootstrap(personal_number, unit_name, unit_type="section", first="בדיקה", last=None) -> Api:
        r = client.post("/auth/bootstrap", json={
            "firstName": first, "lastName": last or personal_number, "rank": "סמל",
            "personalNumber": personal_number, "password": PASSWORD,
            "unitName": unit_name, "unitType": unit_type,
        })
        assert r.status_code == 200, r.text
        return Api(client, r.json()["access_token"])
    return _bootstrap


# Demo users from seed.py
COMPANY_CMDR = "1000001"      # מאיר — מפקד פלוגה א (מפתח)
SECTION1_CMDR = "1000002"     # ניר — מפקד מחלקה 1
SECTION2_CMDR = "1000003"     # מיכאל — מפקד מחלקה 2
SOLDIER_S1 = "1000005"        # יגאל — חייל במחלקה 1 (id 5)
SOLDIER_S2 = "1000006"        # אסף — חייל במחלקה 2 (id 6)
INDEPENDENT_CMDR = "1000009"  # דנה — מפקדת מחלקה עצמאית (id 9)
JOIN_CODE = "DEMO2026"
SIGNUP_CODE = "SOLD2026"       # קוד חיילים של פלוגה א
INDEPENDENT_SIGNUP_CODE = "SOLD2027"


def soldier_payload(**overrides):
    base = {
        "firstName": "חדש", "lastName": "חייל", "phone": "050-0000000", "role": "לוחם",
        "rank": "טוראי", "isActive": True, "sectionId": "section1", "personalNumber": None,
        "idNumber": None, "address": "", "birthDate": "", "permissionLevel": "soldier",
        "extraPermissions": [], "email": "", "managedCompanyId": None,
    }
    base.update(overrides)
    return base


def as_update(soldier: dict, **overrides):
    """Turn a SoldierOut into a SoldierUpdate body, the way the frontend does."""
    body = {k: soldier[k] for k in soldier_payload().keys()}
    body.update(overrides)
    return body


TASK = {"name": "שמירה", "startTime": "08:00", "endTime": "12:00", "requiredCount": 1,
        "location": "", "notes": "", "hourly": False}
