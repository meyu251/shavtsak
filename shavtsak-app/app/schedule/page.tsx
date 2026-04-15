"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Soldier, TaskTemplate, Assignment, HourSlot } from "@/lib/types";
import { fullName, canAccessSchedule } from "@/lib/permissions";
import { useAuth } from "@/lib/useAuth";
import AppHeader from "@/components/AppHeader";
import * as api from "@/lib/api";
import { generateHours, isUniform, buildDisplayRows } from "@/lib/timeUtils";
import { showToast } from "@/components/Toast";
import {
  DndContext, closestCenter, DragEndEvent,
  PointerSensor, TouchSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, rectSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ── Sortable wrapper for task cards ──────────────────────────────────────────

function SortableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10);
}

function hebrewDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("he-IL", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const { currentUser, logout } = useAuth();
  const [date, setDate] = useState(today());
  const [soldiers, setSoldiers] = useState<Soldier[]>([]);
  const [tasks, setTasks] = useState<TaskTemplate[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  // Detail view modal
  const [viewingTaskId, setViewingTaskId] = useState<string | null>(null);

  // Edit modal
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [soldierHours, setSoldierHours] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  // Drag-to-reorder (per-user, persisted in localStorage)
  const [taskOrder, setTaskOrder] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  useEffect(() => {
    Promise.all([api.getSoldiers(), api.getTasks(), api.getAssignments()])
      .then(([s, t, a]) => {
        setSoldiers(s.filter(x => x.isActive));
        setTasks(t);
        setAssignments(a);
      })
      .catch(() => showToast('שגיאה בטעינת הנתונים'))
      .finally(() => setLoading(false));
  }, []);

  // Load/merge saved task order for this user
  useEffect(() => {
    if (!currentUser?.id || tasks.length === 0) return;
    const key = `shavtsak_schedule_order_${currentUser.id}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const saved: string[] = JSON.parse(raw);
        const merged = [
          ...saved.filter((id) => tasks.some((t) => t.id === id)),
          ...tasks.filter((t) => !saved.includes(t.id)).map((t) => t.id),
        ];
        setTaskOrder(merged);
        return;
      } catch { /* fall through */ }
    }
    setTaskOrder(tasks.map((t) => t.id));
  }, [tasks, currentUser?.id]);

  // Fresh permission data — look up in soldiers array, not stale auth cache
  const currentSoldier = useMemo(
    () => soldiers.find((s) => s.id === currentUser?.id),
    [soldiers, currentUser]
  );
  const canEdit = useMemo(
    () => (currentSoldier ? canAccessSchedule(currentSoldier) : false),
    [currentSoldier]
  );

  const dayAssignments = useMemo(
    () => assignments.filter((a) => a.date === date),
    [assignments, date]
  );

  const assignedSoldierIds = useMemo(
    () => new Set(dayAssignments.flatMap((a) => a.soldierIds)),
    [dayAssignments]
  );

  const orderedTasks = useMemo(() => {
    if (!taskOrder.length) return tasks;
    const map = new Map(tasks.map((t) => [t.id, t]));
    return taskOrder.map((id) => map.get(id)).filter(Boolean) as TaskTemplate[];
  }, [tasks, taskOrder]);

  function saveOrder(order: string[]) {
    if (!currentUser?.id) return;
    localStorage.setItem(`shavtsak_schedule_order_${currentUser.id}`, JSON.stringify(order));
    setTaskOrder(order);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = taskOrder.indexOf(active.id as string);
    const newIndex = taskOrder.indexOf(over.id as string);
    saveOrder(arrayMove(taskOrder, oldIndex, newIndex));
  }

  function getAssignmentForTask(taskId: string) {
    return dayAssignments.find((a) => a.taskId === taskId);
  }

  function getSoldierById(id: string) {
    return soldiers.find((s) => s.id === id);
  }

  // ── Edit handlers ─────────────────────────────────────────────────────────

  function startEditing(task: TaskTemplate) {
    const taskHours = generateHours(task.startTime, task.endTime);
    const existing = getAssignmentForTask(task.id);
    setEditingTaskId(task.id);

    if (existing?.slots?.length) {
      const sh: Record<string, string[]> = {};
      existing.slots.forEach((slot) => {
        slot.soldierIds.forEach((sid) => {
          if (!sh[sid]) sh[sid] = [];
          sh[sid].push(slot.hour);
        });
      });
      setSoldierHours(sh);
    } else if (existing?.soldierIds.length) {
      const sh: Record<string, string[]> = {};
      existing.soldierIds.forEach((sid) => { sh[sid] = [...taskHours]; });
      setSoldierHours(sh);
    } else {
      setSoldierHours({});
    }
  }

  function cancelEditing() {
    setEditingTaskId(null);
    setSoldierHours({});
  }

  function toggleSoldier(soldierId: string, taskHours: string[]) {
    setSoldierHours((prev) => {
      if (prev[soldierId] !== undefined) {
        const next = { ...prev };
        delete next[soldierId];
        return next;
      }
      const defaultHours = currentTask?.hourly ? [] : [...taskHours];
      return { ...prev, [soldierId]: defaultHours };
    });
  }

  function toggleHour(soldierId: string, hour: string) {
    setSoldierHours((prev) => {
      const current = prev[soldierId] ?? [];
      const newHours = current.includes(hour)
        ? current.filter((h) => h !== hour)
        : [...current, hour].sort();
      if (!newHours.length) {
        const next = { ...prev };
        delete next[soldierId];
        return next;
      }
      return { ...prev, [soldierId]: newHours };
    });
  }

  async function saveAssignment() {
    if (!editingTaskId || !currentTask) return;
    setSaving(true);
    try {
      const taskHours = generateHours(currentTask.startTime, currentTask.endTime);

      const slots: HourSlot[] = taskHours.map((hour) => ({
        hour,
        soldierIds: Object.entries(soldierHours)
          .filter(([, hours]) => hours.includes(hour))
          .map(([id]) => id),
      }));

      const allSoldierIds = [
        ...new Set(
          Object.entries(soldierHours)
            .filter(([, hours]) => hours.length > 0)
            .map(([id]) => id)
        ),
      ];

      const existing = assignments.find(a => a.date === date && a.taskId === editingTaskId);
      if (existing) {
        if (!allSoldierIds.length) {
          await api.deleteAssignment(existing.id);
          setAssignments(prev => prev.filter(a => a.id !== existing.id));
        } else {
          const updated = await api.updateAssignment(existing.id, { soldierIds: allSoldierIds, slots });
          setAssignments(prev => prev.map(a => a.id === existing.id ? updated : a));
        }
      } else if (allSoldierIds.length) {
        const created = await api.createAssignment({ date, taskId: editingTaskId, soldierIds: allSoldierIds, slots });
        setAssignments(prev => [...prev, created]);
      }
      setEditingTaskId(null);
      setSoldierHours({});
    } catch {
      showToast('שגיאה בשמירת השיבוץ');
    } finally {
      setSaving(false);
    }
  }

  const currentTask = tasks.find((t) => t.id === editingTaskId);
  const currentTaskHours = useMemo(
    () => (currentTask ? generateHours(currentTask.startTime, currentTask.endTime) : []),
    [currentTask]
  );

  const viewingTask = tasks.find((t) => t.id === viewingTaskId);

  if (!currentUser) return null;
  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-purple-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // ── Render: task card (shared between soldier and commander views) ─────────

  function renderTaskCard(task: TaskTemplate) {
    const assignment = getAssignmentForTask(task.id);
    const filled = assignment?.soldierIds.length ?? 0;
    const needed = task.requiredCount;
    const isComplete = filled >= needed;
    const taskHours = generateHours(task.startTime, task.endTime);
    const hasSlots = !!assignment?.slots?.length;
    const uniform = hasSlots && isUniform(assignment!.slots!, taskHours);
    const showBreakdown = task.hourly || (hasSlots && !uniform);

    // Highlight only tasks that include the current soldier (so commanders see highlights
    // only for tasks they're personally assigned to)
    const isAssignedToMe = !!currentSoldier && !!assignment?.soldierIds.includes(currentSoldier.id);
    const borderClass = isAssignedToMe ? "border-green-300" : "border-gray-200";

    return (
      <div
        onClick={() => setViewingTaskId(task.id)}
        className={`bg-white rounded-xl shadow-sm border-2 p-5 cursor-pointer hover:shadow-md transition-shadow ${borderClass}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-base font-bold text-gray-800">{task.name}</h3>
            <div className="text-sm text-gray-500 mt-0.5" dir="ltr">
              {task.startTime} – {task.endTime}
            </div>
          </div>
          {canEdit && (
            <span
              className={`text-sm px-2.5 py-1 rounded-full font-bold ${
                isAssignedToMe
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {filled}/{needed}
            </span>
          )}
        </div>

        {/* Assignment preview */}
        {!assignment || filled === 0 ? (
          <p className="text-sm text-gray-400 mb-3">לא שובצו חיילים</p>
        ) : showBreakdown && hasSlots ? (
          <div className="mb-3 space-y-0.5">
            {buildDisplayRows(assignment.slots!, taskHours, task.endTime).map((row, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-gray-400 text-xs font-mono shrink-0" dir="ltr">
                  {row.from}–{row.to}
                </span>
                <span className="text-gray-700">
                  {row.soldierIds.length > 0
                    ? row.soldierIds
                        .map((id) => getSoldierById(id))
                        .filter(Boolean)
                        .map((s) => fullName(s!))
                        .join(", ")
                    : <span className="text-gray-300">—</span>}
                </span>
              </div>
            ))}
          </div>
        ) : hasSlots && uniform ? (
          <div className="mb-3 text-sm text-gray-700">
            {assignment.soldierIds
              .map((id) => getSoldierById(id))
              .filter(Boolean)
              .map((s) => fullName(s!))
              .join(", ")}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 mb-3">
            {assignment.soldierIds.map((sid) => {
              const s = getSoldierById(sid);
              return s ? (
                <span key={sid} className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">
                  {fullName(s)}
                </span>
              ) : null;
            })}
          </div>
        )}

        {/* Edit button — commanders only; stop propagation so card click doesn't also open detail */}
        {canEdit && (
          <div>
            <button
              onClick={(e) => { e.stopPropagation(); startEditing(task); }}
              className="text-sm text-purple-600 hover:text-purple-800 font-medium cursor-pointer"
            >
              {assignment ? "✏️ ערוך שיבוץ" : "➕ שבץ חיילים"}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Render: soldier row in detail modal ───────────────────────────────────

  function renderSoldierRow(sid: string) {
    const s = getSoldierById(sid);
    if (!s) return null;
    return (
      <div key={sid} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-800">{fullName(s)}</div>
          <div className="text-xs text-gray-400 flex gap-3 flex-wrap mt-0.5">
            <span>{s.role}</span>
            {s.personalNumber && <span dir="ltr">מ&quot;א {s.personalNumber}</span>}
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AppHeader currentUser={currentUser} onLogout={logout} backHref="/" title='📅 שבצ"ק יומי' />

      <main className="max-w-5xl mx-auto px-6 py-8 w-full">
        {/* Date picker */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 flex items-center gap-4 flex-wrap">
          <label className="font-medium text-gray-700">תאריך:</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
            dir="ltr"
          />
          <span className="text-gray-600 text-sm">{hebrewDate(date)}</span>
          <div className="mr-auto flex gap-2 text-sm">
            <button
              onClick={() => {
                const d = new Date(date);
                d.setDate(d.getDate() - 1);
                setDate(d.toISOString().slice(0, 10));
              }}
              className="bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg cursor-pointer"
            >
              ← יום קודם
            </button>
            <button
              onClick={() => setDate(today())}
              className="bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-1.5 rounded-lg font-medium cursor-pointer"
            >
              היום
            </button>
            <button
              onClick={() => {
                const d = new Date(date);
                d.setDate(d.getDate() + 1);
                setDate(d.toISOString().slice(0, 10));
              }}
              className="bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg cursor-pointer"
            >
              יום הבא →
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="flex gap-3 mb-6 text-sm flex-wrap">
          <div className="bg-white rounded-lg px-3 py-2 shadow-sm border border-gray-200">
            <span className="font-bold text-purple-600">{assignedSoldierIds.size}</span>
            <span className="text-gray-600 mr-1">/ {soldiers.length} חיילים משובצים</span>
          </div>
          <div className="bg-white rounded-lg px-3 py-2 shadow-sm border border-gray-200">
            <span className="font-bold text-green-600">{dayAssignments.length}</span>
            <span className="text-gray-600 mr-1">/ {tasks.length} משימות מכוסות</span>
          </div>
        </div>

        {/* Tasks grid */}
        {tasks.length === 0 ? (
          <div className="text-center text-gray-400 py-16">
            אין משימות מוגדרות.{" "}
            {canEdit && (
              <Link href="/tasks" className="text-purple-600 underline">
                הגדר משימות כאן
              </Link>
            )}
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={taskOrder} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {orderedTasks.map((task) => (
                  <SortableCard key={task.id} id={task.id}>
                    {renderTaskCard(task)}
                  </SortableCard>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* Unassigned soldiers — commanders only */}
        {canEdit && soldiers.length > 0 && (
          <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-700 mb-3">
              חיילים פנויים ({soldiers.filter((s) => !assignedSoldierIds.has(s.id)).length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {soldiers
                .filter((s) => !assignedSoldierIds.has(s.id))
                .map((s) => (
                  <span key={s.id} className="bg-gray-100 text-gray-700 text-sm px-3 py-1 rounded-full">
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

      {/* ── Detail Modal ──────────────────────────────────────────────────────── */}
      {viewingTaskId && viewingTask && (() => {
        const assignment = getAssignmentForTask(viewingTaskId);
        const filled = assignment?.soldierIds.length ?? 0;
        const taskHours = generateHours(viewingTask.startTime, viewingTask.endTime);
        const hasSlots = !!assignment?.slots?.length;
        const uniform = hasSlots && isUniform(assignment!.slots!, taskHours);
        const showBreakdown = viewingTask.hourly || (hasSlots && !uniform);

        return (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setViewingTaskId(null)}
          >
            <div
              className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{viewingTask.name}</h2>
                  <div className="text-sm text-gray-500 mt-0.5" dir="ltr">
                    {viewingTask.startTime} – {viewingTask.endTime}
                    {viewingTask.location && (
                      <span className="mr-2 text-gray-400">| {viewingTask.location}</span>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <span
                    className={`text-sm px-2.5 py-1 rounded-full font-bold ${
                      (currentSoldier && assignment?.soldierIds.includes(currentSoldier.id))
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {filled}/{viewingTask.requiredCount}
                  </span>
                )}
              </div>

              {viewingTask.notes && (
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 mb-4">
                  {viewingTask.notes}
                </p>
              )}

              {/* Soldiers list */}
              <div className="overflow-y-auto flex-1">
                {!assignment || filled === 0 ? (
                  <p className="text-center text-gray-400 py-8">לא שובצו חיילים</p>
                ) : showBreakdown && hasSlots ? (
                  // Hourly / split-block breakdown
                  <div className="space-y-3">
                    {buildDisplayRows(assignment.slots!, taskHours, viewingTask.endTime).map(
                      (row, i) => (
                        <div key={i} className="border border-gray-100 rounded-lg overflow-hidden">
                          <div className="bg-gray-50 px-3 py-1.5 text-xs font-mono text-gray-500 border-b border-gray-100" dir="ltr">
                            {row.from} – {row.to}
                          </div>
                          {row.soldierIds.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-gray-300">—</div>
                          ) : (
                            <div className="divide-y divide-gray-50">
                              {row.soldierIds.map((sid) => renderSoldierRow(sid))}
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  // Block / uniform — list of soldiers
                  <div className="space-y-2">
                    {assignment.soldierIds.map((sid) => renderSoldierRow(sid))}
                  </div>
                )}
              </div>

              {/* Modal footer */}
              <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100">
                {canEdit && (
                  <button
                    onClick={() => {
                      setViewingTaskId(null);
                      startEditing(viewingTask);
                    }}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg font-medium cursor-pointer"
                  >
                    {assignment && filled > 0 ? "✏️ ערוך שיבוץ" : "➕ שבץ חיילים"}
                  </button>
                )}
                <button
                  onClick={() => setViewingTaskId(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg font-medium cursor-pointer"
                >
                  סגור
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Assignment Edit Modal ─────────────────────────────────────────────── */}
      {editingTaskId && currentTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] flex flex-col">
            <h2 className="text-lg font-bold mb-1">שיבוץ: {currentTask.name}</h2>
            <p className="text-sm text-gray-500 mb-4" dir="ltr">
              {currentTask.startTime} – {currentTask.endTime} | נדרש: {currentTask.requiredCount} אנשים
            </p>

            <div className="overflow-y-auto flex-1 space-y-0.5 mb-4">
              {soldiers.map((soldier) => {
                const isSelected = !!soldierHours[soldier.id];
                const assignedHours = soldierHours[soldier.id] ?? [];
                const isAssignedElsewhere =
                  assignedSoldierIds.has(soldier.id) &&
                  !getAssignmentForTask(editingTaskId)?.soldierIds.includes(soldier.id);

                return (
                  <div key={soldier.id} className="rounded-lg overflow-hidden">
                    <label
                      className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-purple-50 border border-purple-300 rounded-t-lg"
                          : isAssignedElsewhere
                          ? "bg-gray-50 opacity-60 border border-transparent rounded-lg"
                          : "hover:bg-gray-50 border border-transparent rounded-lg"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSoldier(soldier.id, currentTaskHours)}
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

                    {isSelected && currentTaskHours.length > 0 && (
                      <div className="flex flex-wrap gap-1 px-3 py-2 bg-purple-50 border border-t-0 border-purple-300 rounded-b-lg">
                        {currentTaskHours.map((hour) => (
                          <button
                            key={hour}
                            type="button"
                            onClick={() => toggleHour(soldier.id, hour)}
                            className={`text-xs px-2 py-0.5 rounded font-mono transition-colors cursor-pointer ${
                              assignedHours.includes(hour)
                                ? "bg-purple-600 text-white"
                                : "bg-white text-gray-400 border border-gray-200 hover:border-purple-300"
                            }`}
                          >
                            {hour}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={saveAssignment}
                disabled={saving}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white py-2 rounded-lg font-medium cursor-pointer"
              >
                {saving ? 'שומר...' : 'שמור שיבוץ'}
              </button>
              <button
                onClick={cancelEditing}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg font-medium cursor-pointer"
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
