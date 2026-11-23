"""User stories: task management, daily schedule, my tasks, phonebook contacts."""
from tests.conftest import (COMPANY_CMDR, SECTION1_CMDR, SOLDIER_S1, SOLDIER_S2, INDEPENDENT_CMDR,
                            TASK, as_update)

SEED_TASKS = {"1", "2", "3", "4", "5"}


def task_ids(api):
    return {t["id"] for t in api.get("/tasks").json()}


# ── tasks ─────────────────────────────────────────────────────────────────────

def test_everyone_in_company_sees_company_tasks_only(login):
    for pn in [COMPANY_CMDR, SECTION1_CMDR, SOLDIER_S1]:
        assert task_ids(login(pn)) == SEED_TASKS
    assert task_ids(login(INDEPENDENT_CMDR)) == {"6"}


def test_company_commander_creates_edits_deletes_task(login):
    cmdr = login(COMPANY_CMDR)
    t = cmdr.post("/tasks", json=TASK).json()
    assert cmdr.put(f"/tasks/{t['id']}", json={**TASK, "name": "שמירה מעודכנת"}).json()["name"] == "שמירה מעודכנת"
    assert cmdr.delete(f"/tasks/{t['id']}").status_code == 200
    assert task_ids(cmdr) == SEED_TASKS


def test_soldier_and_company_section_commander_cannot_manage_tasks(login):
    for pn in [SOLDIER_S1, SECTION1_CMDR]:
        api = login(pn)
        assert api.post("/tasks", json=TASK).status_code == 403
        assert api.put("/tasks/1", json=TASK).status_code == 403
        assert api.delete("/tasks/1").status_code == 403


def test_tasks_permission_lets_a_soldier_manage_tasks(login):
    cmdr = login(COMPANY_CMDR)
    s = cmdr.soldier("5")
    cmdr.put("/soldiers/5", json=as_update(s, extraPermissions=["tasks"]))
    assert login(SOLDIER_S1).post("/tasks", json=TASK).status_code == 200


def test_independent_section_commander_manages_own_tasks(login):
    dana = login(INDEPENDENT_CMDR)
    assert dana.post("/tasks", json=TASK).status_code == 200
    assert dana.put("/tasks/6", json={**TASK, "name": "x"}).status_code == 200


def test_other_unit_cannot_touch_company_tasks(login):
    dana = login(INDEPENDENT_CMDR)
    assert dana.put("/tasks/1", json=TASK).status_code == 403
    assert dana.delete("/tasks/1").status_code == 403


def test_delete_task_that_has_assignments(login):
    cmdr = login(COMPANY_CMDR)
    cmdr.post("/assignments", json={"date": "2026-12-01", "taskId": "1", "soldierIds": ["5"]})
    assert cmdr.delete("/tasks/1").status_code == 200
    assert cmdr.get("/assignments").json() == []


# ── schedule ──────────────────────────────────────────────────────────────────

def test_commander_schedules_and_soldier_sees_it_in_my_tasks(login):
    cmdr = login(COMPANY_CMDR)
    r = cmdr.post("/assignments", json={"date": "2026-12-01", "taskId": "4", "soldierIds": ["5", "6"],
                                        "slots": [{"hour": "07:00", "soldierIds": ["5"]}]})
    assert r.status_code == 200, r.text
    mine = login(SOLDIER_S1).get("/assignments").json()
    assert [a["taskId"] for a in mine] == ["4"] and "5" in mine[0]["soldierIds"]


def test_cannot_double_book_task_on_same_day(login):
    cmdr = login(COMPANY_CMDR)
    body = {"date": "2026-12-01", "taskId": "1", "soldierIds": ["5"]}
    assert cmdr.post("/assignments", json=body).status_code == 200
    assert cmdr.post("/assignments", json=body).status_code == 400


def test_soldier_cannot_schedule_unless_given_schedule_permission(login):
    body = {"date": "2026-12-01", "taskId": "1", "soldierIds": ["5"]}
    assert login(SOLDIER_S1).post("/assignments", json=body).status_code == 403
    cmdr = login(COMPANY_CMDR)
    cmdr.put("/soldiers/5", json=as_update(cmdr.soldier("5"), extraPermissions=["schedule"]))
    assert login(SOLDIER_S1).post("/assignments", json=body).status_code == 200


def test_section_commander_schedules_own_soldiers(login):
    sc = login(SECTION1_CMDR)
    assert sc.post("/assignments", json={"date": "2026-12-01", "taskId": "1", "soldierIds": ["5", "8"]}).status_code == 200


def test_cannot_assign_soldiers_or_tasks_of_another_unit(login):
    cmdr = login(COMPANY_CMDR)
    assert cmdr.post("/assignments", json={"date": "2026-12-01", "taskId": "1", "soldierIds": ["9"]}).status_code == 403
    assert cmdr.post("/assignments", json={"date": "2026-12-01", "taskId": "1", "soldierIds": ["5"],
                                           "slots": [{"hour": "08:00", "soldierIds": ["9"]}]}).status_code == 403
    assert cmdr.post("/assignments", json={"date": "2026-12-01", "taskId": "6", "soldierIds": ["5"]}).status_code == 403
    dana = login(INDEPENDENT_CMDR)
    assert dana.post("/assignments", json={"date": "2026-12-01", "taskId": "6", "soldierIds": ["5"]}).status_code == 403


def test_assignments_do_not_leak_between_units(login):
    cmdr = login(COMPANY_CMDR)
    a = cmdr.post("/assignments", json={"date": "2026-12-01", "taskId": "1", "soldierIds": ["5"]}).json()
    dana = login(INDEPENDENT_CMDR)
    assert dana.get("/assignments").json() == []
    assert dana.put(f"/assignments/{a['id']}", json={"soldierIds": ["9"], "slots": []}).status_code == 403
    assert dana.delete(f"/assignments/{a['id']}").status_code == 403


def test_update_and_delete_assignment(login):
    cmdr = login(COMPANY_CMDR)
    a = cmdr.post("/assignments", json={"date": "2026-12-01", "taskId": "1", "soldierIds": ["5"]}).json()
    r = cmdr.put(f"/assignments/{a['id']}", json={"soldierIds": ["6", "7"], "slots": []})
    assert r.status_code == 200 and set(r.json()["soldierIds"]) == {"6", "7"}
    assert [x["taskId"] for x in login(SOLDIER_S2).get("/assignments").json()] == ["1"]
    assert cmdr.delete(f"/assignments/{a['id']}").status_code == 200
    assert cmdr.get("/assignments").json() == []


# ── phonebook contacts ────────────────────────────────────────────────────────

def test_contacts_are_per_company_and_editable_by_commanders_only(login):
    cmdr = login(COMPANY_CMDR)
    c = cmdr.post("/contacts", json={"name": "רבש\"ץ", "phone": "04-0000000", "notes": ""}).json()
    assert [x["id"] for x in login(SOLDIER_S1).get("/contacts").json()] == [c["id"]]
    assert login(SOLDIER_S1).post("/contacts", json={"name": "x", "phone": "", "notes": ""}).status_code == 403
    assert login(SOLDIER_S1).delete(f"/contacts/{c['id']}").status_code == 403
    dana = login(INDEPENDENT_CMDR)
    assert dana.get("/contacts").json() == []
    assert dana.delete(f"/contacts/{c['id']}").status_code == 403
    assert login(SECTION1_CMDR).delete(f"/contacts/{c['id']}").status_code == 200
