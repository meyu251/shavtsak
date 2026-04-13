"use client";

import { useState, useEffect } from "react";
import { Soldier } from "@/lib/types";
import { loadData, saveData } from "@/lib/store";
import { fullName, PERMISSION_LEVEL_LABELS } from "@/lib/permissions";
import { useAuth } from "@/lib/useAuth";
import AppHeader from "@/components/AppHeader";

export default function ProfilePage() {
  const { currentUser, logout } = useAuth();
  const [soldier, setSoldier] = useState<Soldier | null>(null);
  const [sectionName, setSectionName] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '',
    address: '', birthDate: '', idNumber: '', personalNumber: '',
  });

  useEffect(() => {
    if (!currentUser) return;
    const data = loadData();
    const s = data.soldiers.find(x => x.id === currentUser.id);
    if (!s) return;
    setSoldier(s);
    const sec = data.sections.find(x => x.id === s.sectionId);
    setSectionName(sec?.name ?? '');
    setForm({
      firstName: s.firstName,
      lastName: s.lastName,
      phone: s.phone,
      address: s.address ?? '',
      birthDate: s.birthDate ?? '',
      idNumber: s.idNumber ?? '',
      personalNumber: s.personalNumber ?? '',
    });
  }, [currentUser]);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!soldier) return;
    const data = loadData();
    const updated: Soldier = {
      ...soldier,
      firstName: form.firstName,
      lastName: form.lastName,
      phone: form.phone,
      address: form.address,
      birthDate: form.birthDate,
      idNumber: form.idNumber,
      personalNumber: form.personalNumber,
    };
    const next = { ...data, soldiers: data.soldiers.map(s => s.id === updated.id ? updated : s) };
    saveData(next);
    setSoldier(updated);
    setEditing(false);
  }

  if (!currentUser || !soldier) return null;

  const initials = `${soldier.firstName[0]}${soldier.lastName[0]}`;
  const avatarColor =
    soldier.permissionLevel === 'company_commander' ? 'bg-purple-500' :
    soldier.permissionLevel === 'section_commander' ? 'bg-blue-500' :
    'bg-gray-500';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AppHeader
        currentUser={soldier}
        onLogout={logout}
        backHref="/"
        title="פרופיל אישי"
      />

      <main className="max-w-lg mx-auto w-full px-4 py-6 space-y-4">
        {/* Avatar + name */}
        <div className="flex items-center gap-4">
          <div className={`${avatarColor} w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white flex-shrink-0`}>
            {initials}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">{fullName(soldier)}</h2>
            <p className="text-sm text-gray-500">
              {PERMISSION_LEVEL_LABELS[soldier.permissionLevel]}
              {soldier.extraPermissions.length > 0 && ' ✦'}
            </p>
          </div>
        </div>

        {/* Read-only fields: role + section */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
          <ReadRow label="תפקיד" value={soldier.role} />
          <ReadRow label="מחלקה" value={sectionName || '—'} />
          <ReadRow label="דרגה" value={soldier.rank} />
        </div>

        {/* Editable details */}
        {editing ? (
          <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
            <h3 className="font-semibold text-gray-700 mb-1">עריכת פרטים</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="שם פרטי">
                <input
                  type="text" required value={form.firstName}
                  onChange={e => setForm({ ...form, firstName: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="שם משפחה">
                <input
                  type="text" required value={form.lastName}
                  onChange={e => setForm({ ...form, lastName: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>
            <Field label="פלאפון">
              <input
                type="tel" value={form.phone} dir="ltr"
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className={inputCls} placeholder="050-0000000"
              />
            </Field>
            <Field label="מספר אישי">
              <input
                type="text" value={form.personalNumber} dir="ltr"
                onChange={e => setForm({ ...form, personalNumber: e.target.value })}
                className={inputCls} placeholder="0000000"
              />
            </Field>
            <Field label="תעודת זהות">
              <input
                type="text" value={form.idNumber} dir="ltr"
                onChange={e => setForm({ ...form, idNumber: e.target.value })}
                className={inputCls} placeholder="000000000"
              />
            </Field>
            <Field label="תאריך לידה">
              <input
                type="date" value={form.birthDate} dir="ltr"
                onChange={e => setForm({ ...form, birthDate: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="כתובת">
              <input
                type="text" value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                className={inputCls} placeholder="רחוב, עיר"
              />
            </Field>
            <div className="flex gap-3 pt-1">
              <button type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors">
                שמור
              </button>
              <button type="button" onClick={() => setEditing(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg font-medium">
                ביטול
              </button>
            </div>
          </form>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
            <ReadRow label="שם פרטי" value={soldier.firstName} />
            <ReadRow label="שם משפחה" value={soldier.lastName} />
            <ReadRow label="פלאפון" value={soldier.phone || '—'} ltr />
            <ReadRow label="מספר אישי" value={soldier.personalNumber || '—'} ltr />
            <ReadRow label="תעודת זהות" value={soldier.idNumber || '—'} ltr />
            <ReadRow
              label="תאריך לידה"
              value={soldier.birthDate ? new Date(soldier.birthDate).toLocaleDateString('he-IL') : '—'}
            />
            <ReadRow label="כתובת" value={soldier.address || '—'} />
            <div className="px-4 py-3">
              <button
                onClick={() => setEditing(true)}
                className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                ✏️ ערוך פרטים
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ReadRow({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 text-sm">
      <span className="text-gray-500 w-28 flex-shrink-0">{label}</span>
      <span className="text-gray-800 font-medium" dir={ltr ? 'ltr' : undefined}>{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400";
