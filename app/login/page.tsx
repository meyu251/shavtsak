"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Soldier } from "@/lib/types";
import { loadData, saveData, addSoldier, saveCurrentUser } from "@/lib/store";
import { fullName, PERMISSION_LEVEL_LABELS } from "@/lib/permissions";

// ── First-time setup form ─────────────────────────────────────────────────────

function SetupForm({ onDone }: { onDone: (soldierId: string) => void }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    const data = loadData();
    const next = addSoldier(data, {
      firstName, lastName, phone,
      rank: 'סרן', role: 'מפקד פלוגה',
      isActive: true, teamId: null,
      permissionLevel: 'company_commander',
      extraPermissions: [],
    });
    saveData(next);
    const newId = next.soldiers[next.soldiers.length - 1].id;
    onDone(newId);
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
      <div className="text-center mb-6">
        <div className="text-5xl mb-3">🪖</div>
        <h1 className="text-2xl font-bold text-gray-800">ברוך הבא לשבצק</h1>
        <p className="text-gray-500 mt-1 text-sm">הגדרה ראשונית — צור חשבון מפקד פלוגה</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">שם פרטי *</label>
            <input
              type="text" required value={firstName}
              onChange={e => setFirstName(e.target.value)}
              className={inputCls} placeholder="שם פרטי"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">שם משפחה *</label>
            <input
              type="text" required value={lastName}
              onChange={e => setLastName(e.target.value)}
              className={inputCls} placeholder="שם משפחה"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">פלאפון</label>
          <input
            type="tel" value={phone}
            onChange={e => setPhone(e.target.value)}
            className={inputCls} placeholder="050-0000000" dir="ltr"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold text-base transition-colors mt-2"
        >
          התחל
        </button>
      </form>
    </div>
  );
}

// ── User selector login ───────────────────────────────────────────────────────

function LoginSelector({ soldiers, onLogin }: { soldiers: Soldier[]; onLogin: (id: string) => void }) {
  const [search, setSearch] = useState('');

  const filtered = soldiers.filter(s =>
    fullName(s).includes(search) ||
    s.rank.includes(search) ||
    s.role.includes(search)
  );

  const byLevel = {
    company_commander: filtered.filter(s => s.permissionLevel === 'company_commander'),
    team_commander: filtered.filter(s => s.permissionLevel === 'team_commander'),
    soldier: filtered.filter(s => s.permissionLevel === 'soldier'),
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
      {/* Header */}
      <div className="bg-gray-900 text-white px-6 py-5 text-center">
        <div className="text-4xl mb-2">🪖</div>
        <h1 className="text-xl font-bold">שבצק</h1>
        <p className="text-gray-400 text-sm mt-0.5">מערכת שיבוץ כוחות ומשימות</p>
      </div>

      <div className="p-5">
        <p className="text-sm font-medium text-gray-600 mb-3 text-center">התחבר בתור:</p>

        {/* Search */}
        <input
          type="text"
          placeholder="חיפוש..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={`${inputCls} mb-4`}
        />

        {/* User groups */}
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {(['company_commander', 'team_commander', 'soldier'] as const).map(level => {
            const group = byLevel[level];
            if (group.length === 0) return null;
            return (
              <div key={level}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-1">
                  {PERMISSION_LEVEL_LABELS[level]}
                </p>
                <div className="space-y-1">
                  {group.map(s => (
                    <button
                      key={s.id}
                      onClick={() => onLogin(s.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-blue-50 transition-colors text-right group"
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        level === 'company_commander' ? 'bg-purple-100 text-purple-700' :
                        level === 'team_commander' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {s.firstName[0]}{s.lastName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 text-sm">{fullName(s)}</p>
                        <p className="text-xs text-gray-400 truncate">{s.rank} · {s.role}</p>
                      </div>
                      <span className="text-gray-300 group-hover:text-blue-400 transition-colors">←</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-4">לא נמצאו תוצאות</p>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          בהמשך תהיה כניסה עם חשבון Google
        </p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const [soldiers, setSoldiers] = useState<Soldier[] | null>(null);

  useEffect(() => {
    const data = loadData();
    setSoldiers(data.soldiers.filter(s => s.isActive));
  }, []);

  function handleLogin(soldierId: string) {
    saveCurrentUser({ soldierId });
    router.push('/');
  }

  function handleSetupDone(soldierId: string) {
    const data = loadData();
    setSoldiers(data.soldiers.filter(s => s.isActive));
    saveCurrentUser({ soldierId });
    router.push('/');
  }

  if (soldiers === null) return null; // loading

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-800 to-gray-950 flex items-center justify-center p-4">
      {soldiers.length === 0 ? (
        <SetupForm onDone={handleSetupDone} />
      ) : (
        <LoginSelector soldiers={soldiers} onLogin={handleLogin} />
      )}
    </div>
  );
}

const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400";
