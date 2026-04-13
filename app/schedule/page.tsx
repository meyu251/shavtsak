"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Soldier, TaskTemplate, Assignment } from "@/lib/types";
import { fullName } from "@/lib/permissions";
import {
  loadData,
  saveData,
  addAssignment,
  updateAssignment,
  deleteAssignment,
} from "@/lib/store";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function hebrewDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("he-IL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function SchedulePage() {
  const [date, setDate] = useState(today());
  const [soldiers, setSoldiers] = useState<Soldier[]>([]);
  const [tasks, setTasks] = useState<TaskTemplate[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [selectedSoldiers, setSelectedSoldiers] = useState<string[]>([]);

  useEffect(() => {
    const data = loadData();
    setSoldiers(data.soldiers.filter((s) => s.isActive));
    setTasks(data.taskTemplates);
    setAssignments(data.assignments);
  }, []);

  const dayAssignments = useMemo(
    () => assignments.filter((a) => a.date === date),
    [assignments, date]
  );

  // Which soldiers are already assigned for this day
  const assignedSoldierIds = useMemo(
    () => new Set(dayAssignments.flatMap((a) => a.soldierIds)),
    [dayAssignments]
  );

  function getAssignmentForTask(taskId: string) {
    return dayAssignments.find((a) => a.taskId === taskId);
  }

  function getSoldierById(id: string) {
    return soldiers.find((s) => s.id === id);
  }

  function startEditing(task: TaskTemplate) {
    const existing = getAssignmentForTask(task.id);
    setEditingTaskId(task.id);
    setSelectedSoldiers(existing?.soldierIds ?? []);
  }

  function cancelEditing() {
    setEditingTaskId(null);
    setSelectedSoldiers([]);
  }

  function toggleSoldier(id: string) {
    setSelectedSoldiers((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  function saveAssignment() {
    const data = loadData();
    const existing = data.assignments.find(
      (a) => a.date === date && a.taskId === editingTaskId!
    );
    let next = data;
    if (existing) {
      if (selectedSoldiers.length === 0) {
        next = deleteAssignment(data, existing.id);
      } else {
        next = updateAssignment(data, {
          ...existing,
          soldierIds: selectedSoldiers,
        });
      }
    } else if (selectedSoldiers.length > 0) {
      next = addAssignment(data, {
        date,
        taskId: editingTaskId!,
        soldierIds: selectedSoldiers,
      });
    }
    saveData(next);
    setAssignments(next.assignments);
    setEditingTaskId(null);
    setSelectedSoldiers([]);
  }

  const currentTask = tasks.find((t) => t.id === editingTaskId);

  // Sorted tasks by start time
  const sortedTasks = [...tasks].sort((a, b) =>
    a.startTime.localeCompare(b.startTime)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gray-900 text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors">
              ← ראשי
            </Link>
            <span className="text-gray-600">|</span>
            <span className="text-lg font-bold">📅 שיבוץ יומי</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Date picker */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 flex items-center gap-4">
          <label className="font-medium text-gray-700">תאריך:</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
            dir="ltr"
          />
          <span className="text-gray-600">{hebrewDate(date)}</span>
          <div className="mr-auto flex gap-3 text-sm">
            <button
              onClick={() => {
                const d = new Date(date);
                d.setDate(d.getDate() - 1);
                setDate(d.toISOString().slice(0, 10));
              }}
              className="bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg"
            >
              ← יום קודם
            </button>
            <button
              onClick={() => setDate(today())}
              className="bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-1.5 rounded-lg font-medium"
            >
              היום
            </button>
            <button
              onClick={() => {
                const d = new Date(date);
                d.setDate(d.getDate() + 1);
                setDate(d.toISOString().slice(0, 10));
              }}
              className="bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg"
            >
              יום הבא →
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="flex gap-3 mb-6 text-sm">
          <div className="bg-white rounded-lg px-3 py-2 shadow-sm border border-gray-200">
            <span className="font-bold text-purple-600">{assignedSoldierIds.size}</span>
            <span className="text-gray-600 mr-1">/ {soldiers.length} חיילים משובצים</span>
          </div>
          <div className="bg-white rounded-lg px-3 py-2 shadow-sm border border-gray-200">
            <span className="font-bold text-green-600">{dayAssignments.length}</span>
            <span className="text-gray-600 mr-1">/ {tasks.length} משימות מכוסות</span>
          </div>
        </div>

        {/* Tasks Grid */}
        {tasks.length === 0 ? (
          <div className="text-center text-gray-400 py-16">
            אין משימות מוגדרות.{" "}
            <Link href="/tasks" className="text-purple-600 underline">
              הגדר משימות כאן
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedTasks.map((task) => {
              const assignment = getAssignmentForTask(task.id);
              const filled = assignment?.soldierIds.length ?? 0;
              const needed = task.requiredCount;
              const isComplete = filled >= needed;

              return (
                <div
                  key={task.id}
                  className={`bg-white rounded-xl shadow-sm border-2 p-5 ${
                    isComplete && filled > 0
                      ? "border-green-300"
                      : filled > 0
                      ? "border-yellow-300"
                      : "border-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-base font-bold text-gray-800">{task.name}</h3>
                      <div className="text-sm text-gray-500 mt-0.5" dir="ltr">
                        {task.startTime} – {task.endTime}
                        {task.location && (
                          <span className="mr-2 text-gray-400">| {task.location}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          isComplete && filled > 0
                            ? "bg-green-100 text-green-700"
                            : filled > 0
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {filled}/{needed}
                      </span>
                    </div>
                  </div>

                  {/* Assigned soldiers */}
                  {assignment && assignment.soldierIds.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {assignment.soldierIds.map((sid) => {
                        const s = getSoldierById(sid);
                        return s ? (
                          <span
                            key={sid}
                            className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full"
                          >
                            {s.rank} {fullName(s)}
                          </span>
                        ) : null;
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 mb-3">לא שובצו חיילים</p>
                  )}

                  <button
                    onClick={() => startEditing(task)}
                    className="text-sm text-purple-600 hover:text-purple-800 font-medium"
                  >
                    {assignment ? "✏️ ערוך שיבוץ" : "➕ שבץ חיילים"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Unassigned soldiers */}
        {soldiers.length > 0 && (
          <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-700 mb-3">
              חיילים פנויים ({soldiers.filter((s) => !assignedSoldierIds.has(s.id)).length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {soldiers
                .filter((s) => !assignedSoldierIds.has(s.id))
                .map((s) => (
                  <span
                    key={s.id}
                    className="bg-gray-100 text-gray-700 text-sm px-3 py-1 rounded-full"
                  >
                    {s.rank} {fullName(s)}
                  </span>
                ))}
              {soldiers.every((s) => assignedSoldierIds.has(s.id)) && (
                <span className="text-green-600 font-medium">✅ כל החיילים משובצים</span>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Assignment Modal */}
      {editingTaskId && currentTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] flex flex-col">
            <h2 className="text-lg font-bold mb-1">שיבוץ: {currentTask.name}</h2>
            <p className="text-sm text-gray-500 mb-4" dir="ltr">
              {currentTask.startTime} – {currentTask.endTime} | נדרש: {currentTask.requiredCount} אנשים
            </p>

            <p className="text-sm font-medium text-gray-700 mb-2">
              בחר חיילים ({selectedSoldiers.length}/{currentTask.requiredCount}):
            </p>

            <div className="overflow-y-auto flex-1 space-y-1 mb-4">
              {soldiers.map((soldier) => {
                const isSelected = selectedSoldiers.includes(soldier.id);
                const isAssignedElsewhere =
                  assignedSoldierIds.has(soldier.id) &&
                  !getAssignmentForTask(editingTaskId)?.soldierIds.includes(soldier.id);

                return (
                  <label
                    key={soldier.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-purple-50 border border-purple-300"
                        : isAssignedElsewhere
                        ? "bg-gray-50 opacity-60"
                        : "hover:bg-gray-50 border border-transparent"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSoldier(soldier.id)}
                      className="w-4 h-4 accent-purple-600"
                    />
                    <span className="flex-1 font-medium">
                      {soldier.rank} {fullName(soldier)}
                    </span>
                    <span className="text-xs text-gray-400">{soldier.role}</span>
                    {isAssignedElsewhere && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                        משובץ
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={saveAssignment}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg font-medium transition-colors"
              >
                שמור שיבוץ
              </button>
              <button
                onClick={cancelEditing}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg font-medium"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
