"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Soldier, Rank } from "@/lib/types";
import { loadData, saveData, addSoldier, updateSoldier, deleteSoldier } from "@/lib/store";

const RANKS: Rank[] = ['טוראי', 'רב"ט', 'סמל', 'סמל ראשון', 'סגן', 'סרן', 'רב סרן', 'סגן אלוף'];
const ROLES = ['לוחם', 'נהג', 'קשר', 'חובש', 'מכונאי', 'מד"א'];

const emptyForm = (): Omit<Soldier, 'id'> => ({
  name: '',
  rank: 'טוראי',
  phone: '',
  role: 'לוחם',
  isActive: true,
});

export default function SoldiersPage() {
  const [soldiers, setSoldiers] = useState<Soldier[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingSoldier, setEditingSoldier] = useState<Soldier | null>(null);
  const [form, setForm] = useState<Omit<Soldier, 'id'>>(emptyForm());
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    const data = loadData();
    setSoldiers(data.soldiers);
  }, []);

  function persist(updated: Soldier[]) {
    const data = loadData();
    data.soldiers = updated;
    saveData(data);
    setSoldiers(updated);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const data = loadData();
    if (editingSoldier) {
      const next = updateSoldier(data, { ...editingSoldier, ...form });
      persist(next.soldiers);
    } else {
      const next = addSoldier(data, form);
      persist(next.soldiers);
    }
    setShowForm(false);
    setEditingSoldier(null);
    setForm(emptyForm());
  }

  function handleEdit(soldier: Soldier) {
    setEditingSoldier(soldier);
    setForm({ name: soldier.name, rank: soldier.rank, phone: soldier.phone, role: soldier.role, isActive: soldier.isActive });
    setShowForm(true);
  }

  function handleDelete(id: string) {
    const data = loadData();
    const next = deleteSoldier(data, id);
    persist(next.soldiers);
    setConfirmDelete(null);
  }

  const filtered = soldiers.filter(s =>
    s.name.includes(search) || s.rank.includes(search) || s.role.includes(search)
  );

  const active = filtered.filter(s => s.isActive);
  const inactive = filtered.filter(s => !s.isActive);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gray-900 text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors">← ראשי</Link>
            <span className="text-gray-600">|</span>
            <span className="text-lg font-bold">👥 ניהול כוח אדם</span>
          </div>
          <button
            onClick={() => { setShowForm(true); setEditingSoldier(null); setForm(emptyForm()); }}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            + הוסף חייל
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Search */}
        <input
          type="text"
          placeholder="חפש לפי שם, דרגה או תפקיד..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-6 text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
        />

        {/* Stats */}
        <div className="flex gap-4 mb-6">
          <div className="bg-white rounded-lg px-4 py-3 shadow-sm border border-gray-200">
            <span className="text-2xl font-bold text-blue-600">{active.length}</span>
            <span className="text-gray-600 text-sm mr-2">חיילים פעילים</span>
          </div>
          {inactive.length > 0 && (
            <div className="bg-white rounded-lg px-4 py-3 shadow-sm border border-gray-200">
              <span className="text-2xl font-bold text-gray-400">{inactive.length}</span>
              <span className="text-gray-600 text-sm mr-2">לא פעילים</span>
            </div>
          )}
        </div>

        {/* Add/Edit Form */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
              <h2 className="text-lg font-bold mb-4">{editingSoldier ? 'עריכת חייל' : 'הוספת חייל חדש'}</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">שם מלא *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="שם פרטי ושם משפחה"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">דרגה</label>
                    <select
                      value={form.rank}
                      onChange={e => setForm({ ...form, rank: e.target.value as Rank })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">תפקיד</label>
                    <select
                      value={form.role}
                      onChange={e => setForm({ ...form, role: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">פלאפון</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="050-0000000"
                    dir="ltr"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={form.isActive}
                    onChange={e => setForm({ ...form, isActive: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="isActive" className="text-sm text-gray-700">חייל פעיל</label>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors"
                  >
                    {editingSoldier ? 'שמור שינויים' : 'הוסף חייל'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); setEditingSoldier(null); }}
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
              <p className="text-gray-600 mb-4">האם למחוק את החייל? פעולה זו לא ניתנת לביטול.</p>
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

        {/* Soldiers Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {active.length === 0 && inactive.length === 0 ? (
            <div className="text-center text-gray-400 py-16">אין חיילים ברשימה</div>
          ) : (
            <table className="w-full text-right">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-600">שם</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-600">דרגה</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-600">תפקיד</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-600">פלאפון</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-600">סטטוס</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-600">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[...active, ...inactive].map(soldier => (
                  <tr key={soldier.id} className={`hover:bg-gray-50 transition-colors ${!soldier.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-medium">{soldier.name}</td>
                    <td className="px-4 py-3 text-gray-600">{soldier.rank}</td>
                    <td className="px-4 py-3 text-gray-600">{soldier.role}</td>
                    <td className="px-4 py-3 text-gray-600 text-sm" dir="ltr">{soldier.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${soldier.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {soldier.isActive ? 'פעיל' : 'לא פעיל'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(soldier)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          ערוך
                        </button>
                        <button
                          onClick={() => setConfirmDelete(soldier.id)}
                          className="text-red-500 hover:text-red-700 text-sm font-medium"
                        >
                          מחק
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
