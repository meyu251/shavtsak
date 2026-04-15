"use client";

import { useState, useEffect, useMemo } from "react";
import { Soldier, TaskTemplate, Assignment } from "@/lib/types";
import { fullName } from "@/lib/permissions";
import { useAuth } from "@/lib/useAuth";
import AppHeader from "@/components/AppHeader";
import * as api from "@/lib/api";
import { generateHours, isUniform, buildDisplayRows } from "@/lib/timeUtils";
import { showToast } from "@/components/Toast";

// ── Date helpers ──────────────────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Returns the Sunday of the week containing dateStr */
function getWeekStart(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - date.getDay()); // getDay(): 0=Sun
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDayHeader(dateStr: string): { weekday: string; dayMonth: string } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return {
    weekday: date.toLocaleDateString("he-IL", { weekday: "short" }),
    dayMonth: `${d}/${m}`,
  };
}

function formatFullDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("he-IL", {
    weekday: "long", day: "numeric", month: "long",
  });
}

// ── Assignment helpers ────────────────────────────────────────────────────────

/** The specific hours this user is assigned to, as a display range */
function myTimeRange(assignment: Assignment, userId: string, taskStart: string, taskEnd: string): string {
  if (!assignment.slots?.length) return `${taskStart}–${taskEnd}`;
  const myHours = assignment.slots
    .filter(s => s.soldierIds.includes(userId))
    .map(s => s.hour)
    .sort();
  if (!myHours.length) return `${taskStart}–${taskEnd}`;
  const last = myHours[myHours.length - 1];
  const toH = (Number(last.split(":")[0]) + 1) % 24;
  const to = `${String(toH).padStart(2, "0")}:00`;
  return `${myHours[0]}–${to}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MyTasksPage() {
  const { currentUser, logout } = useAuth();
  const [soldiers, setSoldiers] = useState<Soldier[]>([]);
  const [tasks, setTasks] = useState<TaskTemplate[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [view, setView] = useState<"day" | "week">("week");
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [viewing, setViewing] = useState<{ taskId: string; date: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getSoldiers(), api.getTasks(), api.getAssignments()])
      .then(([s, t, a]) => {
        setSoldiers(s.filter(x => x.isActive));
        setTasks(t);
        setAssignments(a);
      })
      .catch(() => showToast('שגיאה בטעינת המשימות'))
      .finally(() => setLoading(false));
  }, []);

  const myId = currentUser?.id ?? "";

  const myAssignments = useMemo(
    () => assignments.filter((a) => a.soldierIds.includes(myId)),
    [assignments, myId]
  );

  const weekStart = useMemo(() => getWeekStart(selectedDate), [selectedDate]);

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  function getTasksForDate(dateStr: string) {
    return myAssignments
      .filter((a) => a.date === dateStr)
      .flatMap((a) => {
        const task = tasks.find((t) => t.id === a.taskId);
        return task ? [{ assignment: a, task }] : [];
      })
      .sort((a, b) => a.task.startTime.localeCompare(b.task.startTime));
  }

  function getSoldierById(id: string) {
    return soldiers.find((s) => s.id === id);
  }

  const today = todayStr();

  // ── Detail modal ──────────────────────────────────────────────────────────

  const viewingTask = viewing ? tasks.find((t) => t.id === viewing.taskId) : null;
  const viewingAssignment = viewing
    ? assignments.find((a) => a.date === viewing.date && a.taskId === viewing.taskId)
    : null;

  function renderSoldierRow(sid: string) {
    const s = getSoldierById(sid);
    if (!s) return null;
    const isMe = s.id === myId;
    return (
      <div
        key={sid}
        className={`flex items-center gap-3 p-3 rounded-lg border ${isMe ? "bg-purple-50 border-purple-200" : "bg-gray-50 border-gray-100"}`}
      >
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-semibold ${isMe ? "text-purple-800" : "text-gray-800"}`}>
            {fullName(s)}{isMe && " (את/ה)"}
          </div>
          <div className="text-xs text-gray-400 flex gap-3 flex-wrap mt-0.5">
            <span>{s.role}</span>
            {s.personalNumber && <span dir="ltr">מ&quot;א {s.personalNumber}</span>}
          </div>
        </div>
      </div>
    );
  }

  // ── Task chip ─────────────────────────────────────────────────────────────

  function TaskChip({ assignment, task, compact }: { assignment: Assignment; task: TaskTemplate; compact?: boolean }) {
    const range = myTimeRange(assignment, myId, task.startTime, task.endTime);
    return (
      <button
        onClick={() => setViewing({ taskId: task.id, date: assignment.date })}
        className={`w-full text-right bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors cursor-pointer ${compact ? "px-1.5 py-1" : "px-3 py-2"}`}
      >
        <div className={`font-semibold text-purple-800 leading-tight ${compact ? "text-xs" : "text-sm"}`}>
          {task.name}
        </div>
        <div className={`text-purple-500 font-mono mt-0.5 ${compact ? "text-[10px]" : "text-xs"}`} dir="ltr">
          {range}
        </div>
      </button>
    );
  }

  if (!currentUser) return null;
  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-purple-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AppHeader currentUser={currentUser} onLogout={logout} backHref="/" title="📌 המשימות שלי" />

      <main className="max-w-6xl mx-auto px-4 py-6 w-full">
        {/* Controls bar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 flex items-center gap-4 flex-wrap">
          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden border border-gray-200 shrink-0">
            <button
              onClick={() => setView("day")}
              className={`px-4 py-1.5 text-sm font-medium cursor-pointer transition-colors ${view === "day" ? "bg-purple-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              יומי
            </button>
            <button
              onClick={() => setView("week")}
              className={`px-4 py-1.5 text-sm font-medium cursor-pointer transition-colors ${view === "week" ? "bg-purple-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              שבועי
            </button>
          </div>

          {/* Navigation */}
          {view === "day" ? (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setSelectedDate(addDays(selectedDate, -1))}
                className="bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg text-sm cursor-pointer"
              >← יום קודם</button>
              <button
                onClick={() => setSelectedDate(today)}
                className="bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer"
              >היום</button>
              <button
                onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                className="bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg text-sm cursor-pointer"
              >יום הבא →</button>
              <span className="text-sm text-gray-600">{formatFullDate(selectedDate)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setSelectedDate(addDays(weekStart, -7))}
                className="bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg text-sm cursor-pointer"
              >← שבוע קודם</button>
              <button
                onClick={() => setSelectedDate(today)}
                className="bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer"
              >השבוע</button>
              <button
                onClick={() => setSelectedDate(addDays(weekStart, 7))}
                className="bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg text-sm cursor-pointer"
              >שבוע הבא →</button>
              <span className="text-sm text-gray-500">
                {formatFullDate(weekStart).replace(/[א-ת]+, /, "")} – {formatFullDate(addDays(weekStart, 6)).replace(/[א-ת]+, /, "")}
              </span>
            </div>
          )}
        </div>

        {/* ── Daily view ── */}
        {view === "day" && (() => {
          const dayTasks = getTasksForDate(selectedDate);
          return dayTasks.length === 0 ? (
            <div className="text-center text-gray-400 py-20 text-sm">אין משימות ביום זה</div>
          ) : (
            <div className="space-y-3 max-w-md">
              {dayTasks.map(({ assignment, task }) => (
                <TaskChip key={task.id} assignment={assignment} task={task} />
              ))}
            </div>
          );
        })()}

        {/* ── Weekly view ── */}
        {view === "week" && (
          <div className="overflow-x-auto">
            <div className="grid grid-cols-7 gap-2 min-w-[560px]" dir="rtl">
              {weekDates.map((dateStr) => {
                const dayTasks = getTasksForDate(dateStr);
                const isToday = dateStr === today;
                const { weekday, dayMonth } = formatDayHeader(dateStr);
                return (
                  <div key={dateStr} className="min-w-0">
                    {/* Day header — clickable to switch to daily view */}
                    <button
                      onClick={() => { setSelectedDate(dateStr); setView("day"); }}
                      className={`w-full text-center rounded-lg py-1.5 mb-2 cursor-pointer transition-colors ${
                        isToday
                          ? "bg-purple-600 text-white"
                          : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                      }`}
                    >
                      <div className="text-xs font-semibold">{weekday}</div>
                      <div className="text-sm font-bold">{dayMonth}</div>
                    </button>

                    {/* Tasks for this day */}
                    <div className="space-y-1">
                      {dayTasks.length === 0 ? (
                        <div className="text-center text-gray-200 text-xs py-3">—</div>
                      ) : (
                        dayTasks.map(({ assignment, task }) => (
                          <TaskChip key={task.id} assignment={assignment} task={task} compact />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* ── Detail modal ── */}
      {viewing && viewingTask && viewingAssignment && (() => {
        const task = viewingTask;
        const assignment = viewingAssignment;
        const filled = assignment.soldierIds.length;
        const taskHours = generateHours(task.startTime, task.endTime);
        const hasSlots = !!assignment.slots?.length;
        const uniform = hasSlots && isUniform(assignment.slots!, taskHours);
        const showBreakdown = task.hourly || (hasSlots && !uniform);

        return (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setViewing(null)}
          >
            <div
              className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{task.name}</h2>
                  <div className="text-sm text-gray-500 mt-0.5" dir="ltr">
                    {task.startTime} – {task.endTime}
                    {task.location && <span className="mr-2 text-gray-400">| {task.location}</span>}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{formatFullDate(viewing.date)}</div>
                </div>
                <span className={`text-sm px-2.5 py-1 rounded-full font-bold ${
                  filled >= task.requiredCount && filled > 0 ? "bg-green-100 text-green-700"
                  : filled > 0 ? "bg-yellow-100 text-yellow-700"
                  : "bg-gray-100 text-gray-500"
                }`}>{filled}/{task.requiredCount}</span>
              </div>

              {task.notes && (
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 mb-4">{task.notes}</p>
              )}

              {/* Soldiers */}
              <div className="overflow-y-auto flex-1">
                {showBreakdown && hasSlots ? (
                  <div className="space-y-3">
                    {buildDisplayRows(assignment.slots!, taskHours, task.endTime).map((row, i) => (
                      <div key={i} className="border border-gray-100 rounded-lg overflow-hidden">
                        <div
                          className="bg-gray-50 px-3 py-1.5 text-xs font-mono text-gray-500 border-b border-gray-100"
                          dir="ltr"
                        >
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
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {assignment.soldierIds.map((sid) => renderSoldierRow(sid))}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <button
                  onClick={() => setViewing(null)}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg font-medium cursor-pointer"
                >
                  סגור
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
