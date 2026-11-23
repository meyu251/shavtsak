"""User stories: units — independent sections, joining a company, company/section management."""
from tests.conftest import (COMPANY_CMDR, SECTION1_CMDR, SOLDIER_S1, INDEPENDENT_CMDR, JOIN_CODE, TASK)


def test_independent_sections_never_share_data(bootstrap):
    a = bootstrap("8200001", "מחלקה א")
    b = bootstrap("8200002", "מחלקה ב")
    a.post("/tasks", json=TASK)
    a.post("/contacts", json={"name": "x", "phone": "", "notes": ""})
    assert b.get("/tasks").json() == [] and b.get("/contacts").json() == []
    assert len(b.soldiers()) == 1


def test_only_the_company_commander_sees_the_join_code(login):
    companies = login(COMPANY_CMDR).get("/companies").json()
    assert companies[0]["joinCode"] == JOIN_CODE
    assert login(SECTION1_CMDR).get("/companies").json() == []
    assert login(INDEPENDENT_CMDR).get("/companies").json() == []


def test_independent_section_joins_company_with_code(login):
    """A section works alone, then a company is set up and the section joins it."""
    dana = login(INDEPENDENT_CMDR)
    dana.post("/tasks", json={**TASK, "name": "משימה של דנה"})
    dana.post("/contacts", json={"name": "איש קשר של דנה", "phone": "", "notes": ""})
    r = dana.post("/assignments", json={"date": "2026-12-01", "taskId": "6", "soldierIds": ["9"]})
    assert r.status_code == 200

    assert dana.post("/sections/section3/join", json={"code": "WRONG123"}).status_code == 404
    r = dana.post("/sections/section3/join", json={"code": JOIN_CODE.lower()})
    assert r.status_code == 200 and r.json()["companyId"] == "company1"

    cmdr = login(COMPANY_CMDR)
    assert "9" in cmdr.soldiers()
    names = {t["name"] for t in cmdr.get("/tasks").json()}
    assert {"משימה של דנה", "שמירה במחלקה העצמאית"} <= names
    assert "איש קשר של דנה" in {c["name"] for c in cmdr.get("/contacts").json()}
    assert any(a["taskId"] == "6" for a in cmdr.get("/assignments").json())

    me = dana.get("/auth/me").json()
    assert me["unitIsAuto"] is False
    # Now a regular section commander inside a company: tasks are managed by the company commander
    assert dana.post("/tasks", json=TASK).status_code == 403
    assert "9" in login(SOLDIER_S1).soldiers()


def test_join_rules(login, bootstrap):
    assert login(SECTION1_CMDR).post("/sections/section1/join", json={"code": JOIN_CODE}).status_code == 403
    assert login(SOLDIER_S1).post("/sections/section1/join", json={"code": JOIN_CODE}).status_code == 403
    other = bootstrap("8300001", "מחלקה אחרת")
    other_section = other.get("/auth/me").json()["sectionId"]
    # cannot join someone else's section
    assert login(INDEPENDENT_CMDR).post(f"/sections/{other_section}/join", json={"code": JOIN_CODE}).status_code == 403
    # cannot use an auto company's code
    assert other.post(f"/sections/{other_section}/join", json={"code": "nope"}).status_code == 404


def test_section_company_can_only_change_via_join(login):
    dana = login(INDEPENDENT_CMDR)
    assert dana.put("/sections/section3", json={"name": "x", "company_id": "company1"}).status_code == 403
    sc = login(SECTION1_CMDR)
    assert sc.put("/sections/section1", json={"name": "מחלקה 1 שונתה", "company_id": "company1"}).status_code == 200
    assert sc.put("/sections/section1", json={"name": "x", "company_id": None}).status_code == 403


def test_company_commander_detaches_section(login):
    cmdr = login(COMPANY_CMDR)
    r = cmdr.put("/sections/section2", json={"name": "מחלקה 2", "company_id": None})
    assert r.status_code == 200 and r.json()["companyId"] != "company1"
    assert "6" not in cmdr.soldiers()
    assert login("1000003").get("/auth/me").json()["unitIsAuto"] is True
    assert login("1000003").post("/tasks", json=TASK).status_code == 200


def test_sections_are_managed_by_their_company_only(login, bootstrap):
    cmdr = login(COMPANY_CMDR)
    new = cmdr.post("/sections", json={"name": "מחלקה 4", "company_id": None})
    assert new.status_code == 200 and new.json()["companyId"] == "company1"
    assert cmdr.post("/sections", json={"name": "x", "company_id": "company_auto1"}).status_code == 403
    assert login(SECTION1_CMDR).post("/sections", json={"name": "x", "company_id": None}).status_code == 403
    assert cmdr.put("/sections/section3", json={"name": "x", "company_id": None}).status_code == 403
    assert cmdr.delete("/sections/section3").status_code == 403
    other = bootstrap("8400001", "פלוגה ג", "company")
    assert other.delete("/sections/section1").status_code == 403


def test_deleting_a_section_keeps_its_soldiers_in_the_company(login):
    cmdr = login(COMPANY_CMDR)
    assert cmdr.delete("/sections/section2").status_code == 200
    soldiers = cmdr.soldiers()
    assert "6" in soldiers and soldiers["6"]["sectionId"] is None


def test_companies_are_managed_by_their_commander_only(login, bootstrap):
    other = bootstrap("8500001", "פלוגה ד", "company")
    assert other.put("/companies/company1", json={"name": "נפרצה"}).status_code == 403
    assert other.delete("/companies/company1").status_code == 403
    assert login(SOLDIER_S1).put("/companies/company1", json={"name": "x"}).status_code == 403
    assert login(COMPANY_CMDR).put("/companies/company1", json={"name": "פלוגה א'"}).status_code == 200
