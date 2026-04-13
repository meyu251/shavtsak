"use client";

import { useState, useEffect } from "react";
import { TaskTemplate } from "@/lib/types";
import { loadData, saveData, addTask, updateTask, deleteTask } from "@/lib/store";
import { useAuth } from "@/lib/useAuth";
import AppHeader from "@/components/AppHeader";

const emptyForm = (): Omit<TaskTemplate, 'id'> => ({
  name: '',
  startTime: '07:00',
  endTime: '15:00',
  requiredCount: 2,
  location: '',
  notes: '',
});

const PRESET_TIMES = [
  { label: 'בוקר 07:00-15:00', start: '07:00', end: '15:00' },
  { label: 'ערב 15:00-23:00', start: '15:00', end: '23:00' },
  { label: 'לילה 23:00-07:00', start: '23:00', end: '07:00' },
  { label: 'יממה שלמה 07:00-07:00', start: '07:00', end: '07:00' },
];

export default function TasksPage() {
  const { currentUser, logout } = useAuth();
  const [tasks, setTasks] = useState<TaskTemplate[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskTemplate | null>(null);
  const [form, setForm] = useState<Omit<TaskTemplate, 'id'>>(emptyForm());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    const data = loadData();
    setTasks(data.taskTemplates);
  }, []);

  function persist(updated: TaskTemplate[]) {
    const data = loadData();
    data.taskTemplates = updated;
    saveData(data);
    setTasks(updated);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const data = loadData();
    if (editingTask) {
      const next = updateTask(data, { ...editingTask, ...form });
      persist(next.taskTemplates);
    } else {
      const next = addTask(data, form);
      persist(next.taskTemplates);
    }
    setShowForm(false);
    setEditingTask(null);
    setForm(emptyForm());
  }

  function handleEdit(task: TaskTemplate) {
    setEditingTask(task);
    setForm({ name: task.name, startTime: task.startTime, endTime: task.endTime, requiredCount: task.requiredCount, location: task.location, notes: task.notes });
    setShowForm(true);
  }

  function handleDelete(id: string) {
    const data = loadData();
    const next = deleteTask(data, id);
    persist(next.taskTemplates);
    setConfirmDelete(null);
  }

  function applyPreset(start: string, end: string) {
    setForm({ ...form, startTime: start, endTime: end });
  }

  function formatDuration(start: string, end: string) {
    const [sh, sm] = start.split(':').map(Number);
    let [eh, em] = end.split(':').map(Number);
    if (eh < sh || (eh === sh && em < sm)) eh += 24;
    const totalMin = (eh * 60 + em) - (sh * 60 + sm);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m > 0 ? `${h} שעות ו-${m} דק'` : `${h} שעות`;
  }

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AppHeader
        currentUser={currentUser}
        onLogout={logout}
        backHref="/"
        title="📋 ניהול משימות"
        actions={
          <button
            onClick={() => { setShowForm(true); setEditingTask(null); setForm(emptyForm()); }}
            className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            + הוסף משימה
          </button>
        }
      />

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="bg-white rounded-lg px-4 py-3 shadow-sm border border-gray-200">
            <span className="text-2xl font-bold text-green-600">{tasks.length}</span>
            <span className="text-gray-600 text-sm mr-2">סוגי משימות</span>
          </div>
        </div>

        {/* Add/Edit Form */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-bold mb-4">{editingTask ? 'עריכת משימה' : 'הגדרת משימה חדשה'}</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">שם המשימה *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
                    placeholder="לדוגמה: סיור בוקר, שמירה בשער..."
                    required
                  />
                </div>

                {/* Time presets */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">שעות מוכנות</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PRESET_TIMES.map(p => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => applyPreset(p.start, p.end)}
                        className={`text-sm px-3 py-2 rounded-lg border transition-colors text-right ${form.startTime === p.start && form.endTime === p.end ? 'bg-green-100 border-green-400 text-green-800' : 'bg-gray-50 border-gray-300 hover:bg-gray-100'}`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom times */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">שעת התחלה</label>
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={e => setForm({ ...form, startTime: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">שעת סיום</label>
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={e => setForm({ ...form, endTime: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">מספר אנשים נדרש</label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={form.requiredCount}
                      onChange={e => setForm({ ...form, requiredCount: Number(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">מיקום</label>
                    <input
                      type="text"
                      value={form.location}
                      onChange={e => setForm({ ...form, location: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
                      placeholder="לדוגמה: כרמל א, שער הבסיס..."
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">הערות</label>
                  <textarea
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
                    rows={2}
                    placeholder="הוראות מיוחדות, ציוד נדרש..."
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium transition-colors"
                  >
                    {editingTask ? 'שמור שינויים' : 'הוסף משימה'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); setEditingTask(null); }}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg font-medium transition-colors"
                  >
                    ביטול
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Confirm Delete */}
        {confirmDelete && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
              <h3 className="text-lg font-bold mb-2">אישור מחיקה</h3>
              <p className="text-gray-600 mb-4">האם למחוק את המשימה? שיבוצים קיימים לא יושפעו.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleDelete(confirmDelete)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium"
                >
                  מחק
                </button>
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg font-medium"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Task Cards */}
        {tasks.length === 0 ? (
          <div className="text-center text-gray-400 py-16">אין משימות מוגדרות</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tasks.map(task => (
              <div key={task.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-bold text-gray-800">{task.name}</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(task)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      ערוך
                    </button>
                    <button
                      onClick={() => setConfirmDelete(task.id)}
                      className="text-red-500 hover:text-red-700 text-sm font-medium"
                    >
                      מחק
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <span>🕐</span>
                    <span dir="ltr" className="font-medium">{task.startTime} – {task.endTime}</span>
                    <span className="text-gray-400">({formatDuration(task.startTime, task.endTime)})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>👤</span>
                    <span>{task.requiredCount} אנשים נדרשים</span>
                  </div>
                  {task.location && (
                    <div className="flex items-center gap-2">
                      <span>📍</span>
                      <span>{task.location}</span>
                    </div>
                  )}
                  {task.notes && (
                    <div className="flex items-start gap-2">
                      <span>📝</span>
                      <span className="text-gray-500">{task.notes}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
