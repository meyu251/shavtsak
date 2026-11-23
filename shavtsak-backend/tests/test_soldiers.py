"""User stories: personnel management, phonebook visibility and permission escalation."""
from tests.conftest import (COMPANY_CMDR, SECTION1_CMDR, SOLDIER_S1, INDEPENDENT_CMDR,
                            soldier_payload, as_update)

COMPANY_A = {"1", "2", "3", "4", "5", "6", "7", "8"}


def test_company_commander_sees_whole_company_including_self(login):
    assert set(login(COMPANY_CMDR).soldiers()) == COMPANY_A


def test_section_commander_sees_only_own_section(login):
    assert set(login(SECTION1_CMDR).soldiers()) == {"2", "4", "5", "8"}


def test_soldier_phonebook_shows_only_own_company(login):
    """Meir's report: a soldier saw a soldier from the independent section."""
    soldier = login(SOLDIER_S1)
    assert set(soldier.soldiers()) == COMPANY_A
    assert {s["id"] for s in soldier.get("/sections").json()} == {"section1", "section2"}


def test_independent_unit_sees_only_itself(login):
    dana = login(INDEPENDENT_CMDR)
    assert set(dana.soldiers()) == {"9"}
    assert {s["id"] for s in dana.get("/sections").json()} == {"section3"}


def test_soldier_cannot_add_soldiers(login):
    assert login(SOLDIER_S1).post("/soldiers", json=soldier_payload()).status_code == 403


def test_section_commander_adds_only_to_own_section(login):
    r = login(SECTION1_CMDR).post("/soldiers", json=soldier_payload(sectionId="section2"))
    assert r.status_code == 200 and r.json()["sectionId"] == "section1"


def test_unassigned_soldier_stays_inside_the_company(login, bootstrap):
    cmdr = login(COMPANY_CMDR)
    new = cmdr.post("/soldiers", json=soldier_payload(sectionId=None, firstName="ללא")).json()
    assert new["id"] in cmdr.soldiers()
    assert new["id"] in login(SOLDIER_S1).soldiers()
    assert new["id"] not in login(INDEPENDENT_CMDR).soldiers()
    assert new["id"] not in bootstrap("8100001", "יחידה זרה").soldiers()


def test_two_soldiers_without_email(login):
    cmdr = login(COMPANY_CMDR)
    for i in range(2):
        assert cmdr.post("/soldiers", json=soldier_payload(email="", personalNumber=f"710000{i}")).status_code == 200


def test_duplicate_identifiers_are_rejected(login):
    cmdr = login(COMPANY_CMDR)
    assert cmdr.post("/soldiers", json=soldier_payload(personalNumber=SOLDIER_S1)).status_code == 409
    me = cmdr.soldier("4")
    assert cmdr.put("/soldiers/4", json=as_update(me, personalNumber=SOLDIER_S1)).status_code == 409


# ── self editing (profile page) ───────────────────────────────────────────────

def test_soldier_edits_own_profile(login):
    soldier = login(SOLDIER_S1)
    me = soldier.soldier("5")
    r = soldier.put("/soldiers/5", json=as_update(me, phone="052-1111111", address="חיפה"))
    assert r.status_code == 200 and r.json()["phone"] == "052-1111111"


def test_soldier_cannot_promote_self_or_take_over_a_company(login):
    soldier = login(SOLDIER_S1)
    me = soldier.soldier("5")
    assert soldier.put("/soldiers/5", json=as_update(me, permissionLevel="company_commander")).status_code == 403
    assert soldier.put("/soldiers/5", json=as_update(me, managedCompanyId="company_auto1")).status_code == 403
    assert soldier.put("/soldiers/5", json=as_update(me, extraPermissions=["management"])).status_code == 403
    assert soldier.put("/soldiers/5", json=as_update(me, sectionId="section2")).status_code == 403
    assert soldier.soldier("5")["permissionLevel"] == "soldier"


def test_soldier_cannot_edit_others(login):
    soldier = login(SOLDIER_S1)
    other = soldier.soldier("8")
    assert soldier.put("/soldiers/8", json=as_update(other, phone="1")).status_code == 403
    assert soldier.delete("/soldiers/8").status_code == 403


# ── commanders ────────────────────────────────────────────────────────────────

def test_section_commander_edits_only_own_section_and_cannot_promote(login):
    sc = login(SECTION1_CMDR)
    cmdr = login(COMPANY_CMDR)
    own = sc.soldier("5")
    assert sc.put("/soldiers/5", json=as_update(own, phone="053-0000000")).status_code == 200
    assert sc.put("/soldiers/5", json=as_update(own, extraPermissions=["schedule"])).status_code == 200
    assert sc.put("/soldiers/5", json=as_update(own, permissionLevel="section_commander")).status_code == 403
    other = cmdr.soldier("6")
    assert sc.put("/soldiers/6", json=as_update(other, phone="1")).status_code == 403
    assert sc.delete("/soldiers/6").status_code == 403


def test_company_commander_manages_company(login):
    cmdr = login(COMPANY_CMDR)
    s = cmdr.soldier("5")
    assert cmdr.put("/soldiers/5", json=as_update(s, sectionId="section2")).status_code == 200
    s = cmdr.soldier("5")
    assert cmdr.put("/soldiers/5", json=as_update(s, permissionLevel="section_commander")).status_code == 200
    assert login(SOLDIER_S1).get("/auth/me").json()["permissionLevel"] == "section_commander"


def test_company_commander_cannot_reach_into_other_units(login):
    cmdr = login(COMPANY_CMDR)
    s = cmdr.soldier("5")
    assert cmdr.put("/soldiers/5", json=as_update(s, sectionId="section3")).status_code == 403
    assert cmdr.put("/soldiers/5", json=as_update(s, managedCompanyId="company_auto1")).status_code == 403
    assert cmdr.post("/soldiers", json=soldier_payload(sectionId="section3")).status_code == 403
    dana = login(INDEPENDENT_CMDR).soldier("9")
    assert cmdr.put("/soldiers/9", json=as_update(dana, phone="1")).status_code == 403
    assert cmdr.delete("/soldiers/9").status_code == 403


def test_delete_soldier_who_has_assignments(login):
    cmdr = login(COMPANY_CMDR)
    assert cmdr.post("/assignments", json={"date": "2026-12-01", "taskId": "1", "soldierIds": ["4", "5"]}).status_code == 200
    assert cmdr.delete("/soldiers/4").status_code == 200
    assert cmdr.get("/assignments").json()[0]["soldierIds"] == ["5"]


def test_commander_cannot_delete_self(login):
    assert login(COMPANY_CMDR).delete("/soldiers/1").status_code == 403
