"""User stories: logging in, registering, Google linking, password reset, dev tools."""
import app.routers.auth as auth_router
from tests.conftest import (COMPANY_CMDR, SECTION1_CMDR, SOLDIER_S1, INDEPENDENT_CMDR,
                            PASSWORD, soldier_payload, TASK, Api)


def test_every_demo_user_can_log_in(login):
    for pn in ["1000001", "1000002", "1000003", "1000004", "1000005", "1000009"]:
        login(pn)


def test_wrong_password_and_unknown_user_are_rejected(anon):
    assert anon.post("/auth/password/login", json={"identifier": COMPANY_CMDR, "password": "nope"}).status_code == 401
    assert anon.post("/auth/password/login", json={"identifier": "9999999", "password": PASSWORD}).status_code == 401


def test_soldier_added_by_commander_registers_once(login, anon):
    cmdr = login(COMPANY_CMDR)
    assert cmdr.post("/soldiers", json=soldier_payload(personalNumber="7000001")).status_code == 200
    r = anon.post("/auth/register", json={"identifier": "7000001", "password": "abcdef"})
    assert r.status_code == 200
    assert anon.post("/auth/register", json={"identifier": "7000001", "password": "abcdef"}).status_code == 409
    login("7000001", "abcdef")


def test_register_rejects_unknown_number_and_short_password(anon):
    assert anon.post("/auth/register", json={"identifier": "7999999", "password": "abcdef"}).status_code == 404
    assert anon.post("/auth/register", json={"identifier": SOLDIER_S1, "password": "123"}).status_code == 400


def test_bootstrap_company_and_section(bootstrap, client):
    company = bootstrap("8000001", "פלוגה ב", "company")
    me = company.get("/auth/me").json()
    assert me["permissionLevel"] == "company_commander" and me["managedCompanyId"]
    assert company.post("/tasks", json=TASK).status_code == 200

    section = bootstrap("8000002", "מחלקה עצמאית ב", "section")
    me = section.get("/auth/me").json()
    assert me["permissionLevel"] == "section_commander" and me["unitIsAuto"] is True
    assert section.post("/tasks", json=TASK).status_code == 200


def test_bootstrap_rejects_existing_personal_number(client):
    r = client.post("/auth/bootstrap", json={"firstName": "x", "lastName": "y", "rank": "סמל",
                                              "personalNumber": COMPANY_CMDR, "password": PASSWORD,
                                              "unitName": "z", "unitType": "section"})
    assert r.status_code == 409


# ── Google ────────────────────────────────────────────────────────────────────

def fake_google(monkeypatch, email, sub):
    monkeypatch.setattr(auth_router, "GOOGLE_CLIENT_ID", "test")

    class Resp:
        def __init__(self, data):
            self.status_code = 200
            self._data = data

        def json(self):
            return self._data

    class FakeClient:
        def __init__(self, *a, **k): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): pass
        async def post(self, *a, **k): return Resp({"access_token": "t"})
        async def get(self, *a, **k): return Resp({"email": email, "id": sub})

    monkeypatch.setattr(auth_router.httpx, "AsyncClient", FakeClient)


def google_login(client):
    loc = client.get("/auth/google/callback?code=x", follow_redirects=False).headers["location"]
    return loc.split("/login", 1)[1]


def test_google_user_links_to_soldier_without_account(monkeypatch, client, login):
    cmdr = login(COMPANY_CMDR)
    cmdr.post("/soldiers", json=soldier_payload(personalNumber="7100001"))
    fake_google(monkeypatch, "new.soldier@gmail.com", "g-new")
    loc = google_login(client)
    assert "step=claim" in loc
    user_id = loc.split("userId=")[1]
    r = client.post("/auth/claim", json={"userId": user_id, "personalNumber": "7100001"})
    assert r.status_code == 200
    assert "token=" in google_login(client)


def test_google_user_with_unknown_number_gets_not_found(monkeypatch, client):
    fake_google(monkeypatch, "stranger@gmail.com", "g-stranger")
    user_id = google_login(client).split("userId=")[1]
    assert client.post("/auth/claim", json={"userId": user_id, "personalNumber": "7999999"}).status_code == 404


def test_google_links_to_existing_password_account_only_with_password(monkeypatch, client, login):
    """The bug Meir hit: password account + Google login used to get stuck."""
    fake_google(monkeypatch, "dana@gmail.com", "g-dana")
    user_id = google_login(client).split("userId=")[1]
    r = client.post("/auth/claim", json={"userId": user_id, "personalNumber": INDEPENDENT_CMDR})
    assert r.status_code == 409 and r.json()["detail"] == "password_required"
    r = client.post("/auth/claim", json={"userId": user_id, "personalNumber": INDEPENDENT_CMDR, "password": "wrong!"})
    assert r.status_code == 401
    r = client.post("/auth/claim", json={"userId": user_id, "personalNumber": INDEPENDENT_CMDR, "password": PASSWORD})
    assert r.status_code == 200
    assert "token=" in google_login(client)
    login(INDEPENDENT_CMDR)  # password still works


# ── Password reset ────────────────────────────────────────────────────────────

def test_commander_resets_password_for_own_soldier(login, anon):
    cmdr = login(COMPANY_CMDR)
    code = cmdr.post("/auth/reset-code/create", json={"soldierId": "5"}).json()["code"]
    r = anon.post("/auth/reset-code/use", json={"identifier": SOLDIER_S1, "code": code, "newPassword": "newpass1"})
    assert r.status_code == 200, r.text
    login(SOLDIER_S1, "newpass1")


def test_reset_code_cannot_target_other_units_or_be_created_by_soldiers(login):
    assert login(INDEPENDENT_CMDR).post("/auth/reset-code/create", json={"soldierId": "1"}).status_code == 403
    assert login(SECTION1_CMDR).post("/auth/reset-code/create", json={"soldierId": "6"}).status_code == 403
    assert login(SOLDIER_S1).post("/auth/reset-code/create", json={"soldierId": "8"}).status_code == 403


# ── Developer tools ───────────────────────────────────────────────────────────

def test_public_soldier_list_requires_developer(anon, login):
    assert anon.get("/soldiers/public").status_code in (401, 403)
    assert login(SOLDIER_S1).get("/soldiers/public").status_code == 403
    assert login(COMPANY_CMDR).get("/soldiers/public").status_code == 200


def test_impersonation_is_developer_only(login, client):
    assert login(SOLDIER_S1).post("/auth/impersonate/1").status_code == 403
    r = login(COMPANY_CMDR).post("/auth/impersonate/5")
    assert r.status_code == 200
    as_soldier = Api(client, r.json()["access_token"])
    assert as_soldier.get("/auth/me").json()["id"] == "5"
