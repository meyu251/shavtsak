"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import * as api from "@/lib/api";
import AppHeader from "@/components/AppHeader";
import { Soldier, ExtraContact, Section } from "@/lib/types";
import { fullName, canAccessSoldierManagement, canSeeFullDetails } from "@/lib/permissions";
import { showToast } from "@/components/Toast";

export default function PhonebookPage() {
  const { currentUser, logout } = useAuth();
  const [query, setQuery] = useState("");
  const [soldiers, setSoldiers] = useState<Soldier[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [extraContacts, setExtraContacts] = useState<ExtraContact[]>([]);
  const [selected, setSelected] = useState<Soldier | null>(null);
  const [showAddExtra, setShowAddExtra] = useState(false);
  const [extraName, setExtraName] = useState('');
  const [extraPhone, setExtraPhone] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getSoldiers(), api.getSections(), api.getContacts()])
      .then(([s, sec, c]) => {
        setSoldiers(s.filter(x => x.isActive));
        setSections(sec);
        setExtraContacts(c);
      })
      .catch(() => showToast('שגיאה בטעינת ספר הטלפונים'))
      .finally(() => setLoading(false));
  }, []);

  if (!currentUser) return null;
  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const q = query.trim();
  const filtered = soldiers.filter(s =>
    fullName(s).includes(q) || s.phone.includes(q) || s.rank.includes(q) || s.role.includes(q)
  );

  async function handleAddExtra(e?: React.FormEvent<HTMLFormElement>) {
    if (e) e.preventDefault();
    if (!extraName.trim() || !extraPhone.trim() || !currentUser) return;
    if (!canAccessSoldierManagement(currentUser)) return;
    try {
      const newContact = await api.addContact({ name: extraName.trim(), phone: extraPhone.trim(), notes: '' });
      setExtraContacts(prev => [...prev, newContact]);
      setExtraName(''); setExtraPhone(''); setShowAddExtra(false);
    } catch {
      showToast('שגיאה בהוספת איש קשר');
    }
  }

  async function handleDeleteExtra(id: string) {
    if (!currentUser || !canAccessSoldierManagement(currentUser)) return;
    try {
      await api.deleteContact(id);
      setExtraContacts(prev => prev.filter(c => c.id !== id));
    } catch {
      showToast('שגיאה במחיקת איש קשר');
    }
  }

  

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AppHeader currentUser={currentUser} onLogout={logout} backHref="/" title="📞 ספר טלפונים" />

      <main className="max-w-5xl mx-auto px-6 py-8 w-full">
        <div className="mb-4">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="חיפוש שם / דרגה / טלפון"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        

        <div className="space-y-6">
          {/* Unassigned */}
          {(() => {
            const unassigned = filtered.filter(s => s.sectionId === null);
            if (unassigned.length === 0) return null;
            return (
              <div key="unassigned">
                <h3 className="text-sm font-semibold text-gray-600 mb-2">ללא שיוך</h3>
                <div className="grid gap-3 mb-4">
                  {unassigned.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setSelected(s)}
                      className="w-full text-right bg-white rounded-xl p-4 shadow-sm border flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium">{fullName(s)}</div>
                        <div className="text-xs text-gray-500">{s.rank} · {s.role}</div>
                      </div>
                      <div className="text-sm text-green-600">{s.phone}</div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {sections.map(section => {
            const members = filtered.filter(s => s.sectionId === section.id);
            return (
              <div key={section.id}>
                <h3 className="text-sm font-semibold text-gray-600 mb-2">{section.name}</h3>
                {members.length === 0 ? (
                  <div className="text-sm text-gray-400 mb-2">לא נמצאו חיילים במחלקה זו</div>
                ) : (
                  <div className="grid gap-3">
                    {members.map(s => (
                      <button
                        key={s.id}
                        onClick={() => setSelected(s)}
                        className="w-full text-right bg-white rounded-xl p-4 shadow-sm border flex items-center justify-between"
                      >
                        <div>
                          <div className="font-medium">{fullName(s)}</div>
                          <div className="text-xs text-gray-500">{s.rank} · {s.role}</div>
                        </div>
                        <div className="text-sm text-green-600">{s.phone}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Extra contacts */}
          <div>
            <h3 className="text-sm font-semibold text-gray-600 mb-2">טלפונים נוספים</h3>
            {extraContacts.length === 0 && (
              <div className="text-sm text-gray-400 mb-2">לא הוגדרו טלפונים נוספים</div>
            )}
            <div className="space-y-2">
              {extraContacts.map(c => (
                <div key={c.id} className="bg-white rounded-xl p-3 shadow-sm border flex items-center justify-between">
                  <div className="text-right">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-gray-500">{c.notes}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={`tel:${c.phone}`} className="text-green-600 text-sm">{c.phone}</a>
                    {currentUser && canAccessSoldierManagement(currentUser) && (
                      <button onClick={() => handleDeleteExtra(c.id)} className="text-red-500 text-sm">מחק</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {currentUser && canAccessSoldierManagement(currentUser) && (
              <div className="mt-3">
                {!showAddExtra ? (
                  <button onClick={() => setShowAddExtra(true)} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm">+ הוסף טלפון</button>
                ) : (
                  <form onSubmit={handleAddExtra} className="mt-2 space-y-2">
                    <input value={extraName} onChange={e => setExtraName(e.target.value)} placeholder="שם" className="w-full border px-3 py-2 rounded" />
                    <input value={extraPhone} onChange={e => setExtraPhone(e.target.value)} placeholder="טלפון" className="w-full border px-3 py-2 rounded" />
                    <div className="flex gap-2">
                      <button type="submit" className="flex-1 bg-green-600 text-white py-2 rounded">הוסף</button>
                      <button type="button" onClick={() => { setShowAddExtra(false); setExtraName(''); setExtraPhone(''); }} className="flex-1 bg-gray-100 py-2 rounded">ביטול</button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {selected && (() => {
        const viewer = soldiers.find(s => s.id === currentUser.id) ?? currentUser;
        const fullDetails = canSeeFullDetails(viewer, selected);
        const sectionName = sections.find(s => s.id === selected.sectionId)?.name;
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
              <h3 className="text-lg font-bold mb-0.5">{fullName(selected)}</h3>
              <p className="text-sm text-gray-500 mb-3">{sectionName ?? 'ללא שיוך'}</p>

              <div className="mb-4 space-y-1.5 text-sm border rounded-lg p-3 bg-gray-50">
                {/* טלפון — תמיד גלוי */}
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">טלפון</span>
                  <span className="font-medium" dir="ltr">{selected.phone}</span>
                </div>

                {/* פרטים מלאים — למי שיש הרשאה, כל שדה תמיד מוצג (עם — לריקים) */}
                {fullDetails && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-500">מ"א</span>
                      <span className="font-medium" dir="ltr">{selected.personalNumber || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">ת"ז</span>
                      <span className="font-medium" dir="ltr">{selected.idNumber || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">תאריך לידה</span>
                      <span className="font-medium" dir="ltr">{selected.birthDate || '—'}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-500 flex-shrink-0">כתובת</span>
                      <span className="font-medium text-left">{selected.address || '—'}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3 mb-3">
                <a
                  href={`tel:${selected.phone}`}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg text-center"
                >
                  התקשר
                </a>
                <button
                  onClick={async () => { try { await navigator.clipboard.writeText(selected.phone); } catch {} }}
                  className="flex-1 bg-gray-100 py-2 rounded-lg"
                >
                  העתק
                </button>
              </div>

              <button onClick={() => setSelected(null)} className="w-full bg-gray-100 py-2 rounded-lg">סגור</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
