"""User stories: logging in, registering, Google linking, password reset, dev tools."""
import app.routers.auth as auth_router
from tests.conftest import (COMPANY_CMDR, SECTION1_CMDR, SOLDIER_S1, INDEPENDENT_CMDR,
                            PASSWORD, soldier_payload, TASK, Api, JOIN_CODE,
                            SIGNUP_CODE, INDEPENDENT_SIGNUP_CODE)


def test_every_demo_user_can_log_in(login):
    for pn in ["1000001", "1000002", "1000003", "1000004", "1000005", "1000009"]:
        login(pn)


def test_wrong_password_and_unknown_user_are_rejected(anon):
    assert anon.post("/auth/password/login", json={"identifier": COMPANY_CMDR, "password": "nope"}).status_code == 401
    assert anon.post("/auth/password/login", json={"identifier": "9999999", "password": PASSWORD}).status_code == 401


def test_soldier_added_by_commander_registers_once(login, anon):
    cmdr = login(COMPANY_CMDR)
    assert cmdr.post("/soldiers", json=soldier_payload(personalNumber="7000001")).status_code == 200
    r = anon.post("/auth/register", json={"identifier": "7000001", "password": "abcdef", "code": SIGNUP_CODE.lower()})
    assert r.status_code == 200
    assert anon.post("/auth/register", json={"identifier": "7000001", "password": "abcdef", "code": SIGNUP_CODE}).status_code == 409
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
    assert r.status_code == 403  # בלי קוד היחידה
    r = client.post("/auth/claim", json={"userId": user_id, "personalNumber": "7100001", "code": SIGNUP_CODE})
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


# ── New-user journeys ────────────────────────────────────────────────────────

def bootstrap_body(personal_number, unit_type="section", **extra):
    return {"firstName": "חדש", "lastName": personal_number, "rank": "סמל",
            "personalNumber": personal_number, "password": PASSWORD,
            "unitName": f"יחידה {personal_number}", "unitType": unit_type, **extra}


def test_new_section_joins_existing_company_with_code(client, login):
    r = client.post("/auth/bootstrap", json=bootstrap_body("8100001", joinCode=JOIN_CODE.lower()))
    assert r.status_code == 200, r.text
    new = Api(client, r.json()["access_token"])
    me = new.get("/auth/me").json()
    assert me["permissionLevel"] == "section_commander" and me["unitIsAuto"] is False
    # מפקד הפלוגה רואה את המפקד החדש ואת המחלקה שלו
    cmdr = login(COMPANY_CMDR)
    assert any(s["personalNumber"] == "8100001" for s in cmdr.get("/soldiers").json())
    # מפקד מחלקה בפלוגה אמיתית לא מנהל משימות לבד
    assert new.post("/tasks", json=TASK).status_code == 403


def test_bootstrap_with_wrong_or_misused_join_code(client):
    assert client.post("/auth/bootstrap", json=bootstrap_body("8100002", joinCode="NOPE1234")).status_code == 404
    assert client.post("/auth/bootstrap", json=bootstrap_body("8100003", "company", joinCode=JOIN_CODE)).status_code == 400
    # שום דבר לא נוצר בניסיון שנכשל
    assert client.post("/auth/bootstrap", json=bootstrap_body("8100002")).status_code == 200


def test_google_user_creates_unit_and_google_login_works_after(monkeypatch, client):
    fake_google(monkeypatch, "founder@gmail.com", "g-founder")
    user_id = google_login(client).split("userId=")[1]
    r = client.post("/auth/bootstrap", json=bootstrap_body("8100004", "company", googleUserId=user_id))
    assert r.status_code == 200, r.text
    assert "token=" in google_login(client)  # לא נתקע שוב במסך הקישור
    assert client.post("/auth/password/login", json={"identifier": "8100004", "password": PASSWORD}).status_code == 200
    # אי אפשר להשתמש באותו משתמש Google פעמיים
    assert client.post("/auth/bootstrap", json=bootstrap_body("8100005", googleUserId=user_id)).status_code == 400


def test_google_login_auto_links_soldier_registered_with_that_email(monkeypatch, client, login):
    cmdr = login(COMPANY_CMDR)
    r = cmdr.post("/soldiers", json=soldier_payload(personalNumber="7100002", email="pre@gmail.com"))
    assert r.status_code == 200, r.text
    fake_google(monkeypatch, "pre@gmail.com", "g-pre")
    assert "token=" in google_login(client)



# ── Signup code ───────────────────────────────────────────────────────────────

def test_register_requires_the_units_signup_code(login, anon):
    cmdr = login(COMPANY_CMDR)
    cmdr.post("/soldiers", json=soldier_payload(personalNumber="7200001"))
    body = {"identifier": "7200001", "password": "abcdef"}
    assert anon.post("/auth/register", json=body).status_code == 403
    assert anon.post("/auth/register", json={**body, "code": "WRONG123"}).status_code == 403
    # קוד של יחידה אחרת לא עובד
    assert anon.post("/auth/register", json={**body, "code": INDEPENDENT_SIGNUP_CODE}).status_code == 403
    # קוד הצטרפות המחלקות הוא לא קוד החיילים
    assert anon.post("/auth/register", json={**body, "code": JOIN_CODE}).status_code == 403
    assert anon.post("/auth/register", json={**body, "code": SIGNUP_CODE}).status_code == 200


def test_who_sees_which_code(login):
    cc = login(COMPANY_CMDR).get("/companies/my-codes").json()
    assert cc == {"signupCode": SIGNUP_CODE, "joinCode": JOIN_CODE}
    sc = login(SECTION1_CMDR).get("/companies/my-codes").json()
    assert sc == {"signupCode": SIGNUP_CODE, "joinCode": None}
    ind = login(INDEPENDENT_CMDR).get("/companies/my-codes").json()
    assert ind == {"signupCode": INDEPENDENT_SIGNUP_CODE, "joinCode": None}
    soldier = login(SOLDIER_S1).get("/companies/my-codes").json()
    assert soldier == {"signupCode": None, "joinCode": None}


def test_rotating_codes(login, anon):
    cmdr = login(COMPANY_CMDR)
    assert login(SECTION1_CMDR).post("/companies/my-codes/rotate", json={"kind": "signup"}).status_code == 403
    assert login(SOLDIER_S1).post("/companies/my-codes/rotate", json={"kind": "signup"}).status_code == 403
    new = cmdr.post("/companies/my-codes/rotate", json={"kind": "signup"}).json()
    assert new["signupCode"] != SIGNUP_CODE and new["joinCode"] == JOIN_CODE
    cmdr.post("/soldiers", json=soldier_payload(personalNumber="7200002"))
    body = {"identifier": "7200002", "password": "abcdef"}
    assert anon.post("/auth/register", json={**body, "code": SIGNUP_CODE}).status_code == 403
    assert anon.post("/auth/register", json={**body, "code": new["signupCode"]}).status_code == 200
    joined = cmdr.post("/companies/my-codes/rotate", json={"kind": "join"}).json()
    assert joined["joinCode"] != JOIN_CODE
    # מפקדת מחלקה עצמאית מחליפה את קוד החיילים שלה, אבל אין לה קוד הצטרפות
    ind = login(INDEPENDENT_CMDR)
    assert ind.post("/companies/my-codes/rotate", json={"kind": "signup"}).json()["signupCode"] != INDEPENDENT_SIGNUP_CODE
    assert ind.post("/companies/my-codes/rotate", json={"kind": "join"}).status_code == 400


def test_soldiers_of_independent_section_use_company_code_after_joining(login, anon):
    ind = login(INDEPENDENT_CMDR)
    ind.post("/soldiers", json=soldier_payload(personalNumber="7200003"))
    me = ind.get("/auth/me").json()
    assert ind.post(f"/sections/{me['sectionId']}/join", json={"code": JOIN_CODE}).status_code == 200
    body = {"identifier": "7200003", "password": "abcdef"}
    assert anon.post("/auth/register", json={**body, "code": INDEPENDENT_SIGNUP_CODE}).status_code == 403
    assert anon.post("/auth/register", json={**body, "code": SIGNUP_CODE}).status_code == 200
