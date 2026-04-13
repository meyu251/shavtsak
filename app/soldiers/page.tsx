"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Soldier, Rank, PermissionLevel, ExtraPermission, Team } from "@/lib/types";
import {
  loadData, saveData, addSoldier, updateSoldier, deleteSoldier,
  loadCurrentUser, saveCurrentUser,
} from "@/lib/store";
import {
  fullName, canSeeFullDetails, canEditSoldier, canAddSoldier,
  canDeleteSoldier, canManagePermissions, canGrantPermission,
  canChangePermissionLevel,
  PERMISSION_LEVEL_LABELS, EXTRA_PERMISSION_LABELS, EXTRA_PERMISSION_DESC,
} from "@/lib/permissions";

// ── Constants ─────────────────────────────────────────────────────────────────

const RANKS: Rank[] = ['טוראי', 'רב"ט', 'סמל', 'סמל ראשון', 'סגן', 'סרן', 'רב סרן', 'סגן אלוף'];
const ROLES = ['לוחם', 'נהג', 'קשר', 'חובש', 'מכונאי', 'מד"א', 'מפקד צוות', 'מפקד פלוגה'];
const EXTRA_PERMISSIONS: ExtraPermission[] = ['extended_data', 'management'];

function emptyForm(): Omit<Soldier, 'id'> {
  return {
    firstName: '', lastName: '', phone: '', role: 'לוחם', rank: 'טוראי',
    isActive: true, teamId: null,
    personalNumber: '', idNumber: '', address: '', birthDate: '',
    permissionLevel: 'soldier', extraPermissions: [],
  };
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SoldiersPage() {
  const [soldiers, setSoldiers] = useState<Soldier[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [viewerId, setViewerId] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingSoldier, setEditingSoldier] = useState<Soldier | null>(null);
  const [form, setForm] = useState<Omit<Soldier, 'id'>>(emptyForm());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    const data = loadData();
    setSoldiers(data.soldiers);
    setTeams(data.teams);
    const cu = loadCurrentUser();
    const defaultId = cu?.soldierId ?? data.soldiers[0]?.id ?? '';
    setViewerId(defaultId);
    saveCurrentUser({ soldierId: defaultId });
  }, []);

  const viewer = useMemo(() => soldiers.find(s => s.id === viewerId) ?? null, [soldiers, viewerId]);
  const selected = useMemo(() => soldiers.find(s => s.id === selectedId) ?? null, [soldiers, selectedId]);

  function persist(updated: Soldier[]) {
    const data = loadData();
    data.soldiers = updated;
    saveData(data);
    setSoldiers(updated);
  }

  function switchUser(id: string) {
    setViewerId(id);
    saveCurrentUser({ soldierId: id });
    setSelectedId(null);
  }

  // ── Filtered list ──────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return soldiers.filter(s => {
      const name = fullName(s).toLowerCase();
      const matchSearch = !search || name.includes(search.toLowerCase());
      const matchTeam =
        teamFilter === 'all' ||
        (teamFilter === 'none' && s.teamId === null) ||
        s.teamId === teamFilter;
      return matchSearch && matchTeam;
    });
  }, [soldiers, search, teamFilter]);

  const activeFiltered = filtered.filter(s => s.isActive);
  const inactiveFiltered = filtered.filter(s => !s.isActive);

  // ── Form handlers ──────────────────────────────────────────────────────────

  function openAddForm() {
    setEditingSoldier(null);
    setForm(emptyForm());
    setShowForm(true);
  }

  function openEditForm(s: Soldier) {
    setEditingSoldier(s);
    setForm({
      firstName: s.firstName, lastName: s.lastName, phone: s.phone,
      role: s.role, rank: s.rank, isActive: s.isActive, teamId: s.teamId,
      personalNumber: s.personalNumber ?? '', idNumber: s.idNumber ?? '',
      address: s.address ?? '', birthDate: s.birthDate ?? '',
      permissionLevel: s.permissionLevel, extraPermissions: [...s.extraPermissions],
    });
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim()) return;
    const data = loadData();
    if (editingSoldier) {
      const next = updateSoldier(data, { ...editingSoldier, ...form });
      persist(next.soldiers);
      if (selectedId === editingSoldier.id) setSelectedId(editingSoldier.id);
    } else {
      const next = addSoldier(data, form);
      persist(next.soldiers);
    }
    setShowForm(false);
    setEditingSoldier(null);
  }

  function handleDelete(id: string) {
    const data = loadData();
    const next = deleteSoldier(data, id);
    persist(next.soldiers);
    if (selectedId === id) setSelectedId(null);
    setConfirmDelete(null);
  }

  // ── Grant / revoke extra permission ───────────────────────────────────────

  function toggleExtraPermission(target: Soldier, perm: ExtraPermission) {
    if (!viewer) return;
    if (!canGrantPermission(viewer, target, perm)) return;
    const has = target.extraPermissions.includes(perm);
    const next = has
      ? target.extraPermissions.filter(p => p !== perm)
      : [...target.extraPermissions, perm];
    const data = loadData();
    const updated = updateSoldier(data, { ...target, extraPermissions: next });
    persist(updated.soldiers);
  }

  function changePermissionLevel(target: Soldier, level: PermissionLevel) {
    if (!viewer || !canChangePermissionLevel(viewer)) return;
    const data = loadData();
    const updated = updateSoldier(data, { ...target, permissionLevel: level });
    persist(updated.soldiers);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 text-white shadow-lg flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors text-sm">
              ← ראשי
            </Link>
            <span className="text-gray-600">|</span>
            <span className="font-bold">👥 ניהול כוח אדם</span>
          </div>

          {/* Current user selector */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-400">התחברת כ:</span>
            <select
              value={viewerId}
              onChange={e => switchUser(e.target.value)}
              className="bg-gray-800 border border-gray-600 text-white rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {soldiers.map(s => (
                <option key={s.id} value={s.id}>
                  {fullName(s)} ({PERMISSION_LEVEL_LABELS[s.permissionLevel]})
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 max-w-7xl mx-auto w-full px-4 py-4 gap-4">

        {/* ── Left Panel: Soldier List ─────────────────────────────────────── */}
        <aside className="w-72 flex-shrink-0 flex flex-col gap-3">

          {/* Search */}
          <input
            type="text"
            placeholder="חיפוש לפי שם..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          />

          {/* Team filter */}
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setTeamFilter('all')}
              className={`text-xs px-2 py-1 rounded-full border transition-colors ${teamFilter === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
            >
              כולם
            </button>
            {teams.map(t => (
              <button
                key={t.id}
                onClick={() => setTeamFilter(t.id)}
                className={`text-xs px-2 py-1 rounded-full border transition-colors ${teamFilter === t.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
              >
                {t.name}
              </button>
            ))}
          </div>

          {/* Stats */}
          <div className="text-xs text-gray-500 px-1">
            {activeFiltered.length} פעילים
            {inactiveFiltered.length > 0 && ` · ${inactiveFiltered.length} לא פעילים`}
          </div>

          {/* List */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-1">
            {activeFiltered.length === 0 && inactiveFiltered.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">אין חיילים</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {[...activeFiltered, ...inactiveFiltered].map(s => {
                  const isSelected = s.id === selectedId;
                  const teamName = teams.find(t => t.id === s.teamId)?.name;
                  return (
                    <li
                      key={s.id}
                      onClick={() => setSelectedId(isSelected ? null : s.id)}
                      className={`px-3 py-2.5 cursor-pointer transition-colors flex items-center justify-between gap-2
                        ${isSelected ? 'bg-blue-50 border-r-2 border-blue-500' : 'hover:bg-gray-50'}
                        ${!s.isActive ? 'opacity-50' : ''}`}
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-gray-800 truncate">{fullName(s)}</p>
                        {teamName && (
                          <p className="text-xs text-gray-400 truncate">{teamName}</p>
                        )}
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                        s.permissionLevel === 'company_commander' ? 'bg-purple-100 text-purple-700' :
                        s.permissionLevel === 'team_commander' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {s.permissionLevel === 'company_commander' ? 'מפ"פ' :
                         s.permissionLevel === 'team_commander' ? 'מפ"צ' : 'חייל'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Add soldier button */}
          {viewer && canAddSoldier(viewer) && (
            <button
              onClick={openAddForm}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition-colors"
            >
              + הוסף חייל
            </button>
          )}
        </aside>

        {/* ── Right Panel: Detail View ──────────────────────────────────────── */}
        <main className="flex-1 min-w-0">
          {!selected ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-gray-400">
                <div className="text-5xl mb-3">👈</div>
                <p>בחר חייל מהרשימה לצפייה בפרטים</p>
              </div>
            </div>
          ) : (
            <DetailPanel
              soldier={selected}
              viewer={viewer}
              teams={teams}
              onEdit={() => openEditForm(selected)}
              onDelete={() => setConfirmDelete(selected.id)}
              onToggleExtraPermission={toggleExtraPermission}
              onChangePermissionLevel={changePermissionLevel}
            />
          )}
        </main>
      </div>

      {/* ── Add / Edit Modal ─────────────────────────────────────────────────── */}
      {showForm && viewer && (
        <Modal onClose={() => { setShowForm(false); setEditingSoldier(null); }}>
          <h2 className="text-lg font-bold mb-4">
            {editingSoldier ? 'עריכת חייל' : 'הוספת חייל חדש'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="שם פרטי *">
                <input type="text" required value={form.firstName}
                  onChange={e => setForm({ ...form, firstName: e.target.value })}
                  className={inputCls} placeholder="שם פרטי" />
              </Field>
              <Field label="שם משפחה *">
                <input type="text" required value={form.lastName}
                  onChange={e => setForm({ ...form, lastName: e.target.value })}
                  className={inputCls} placeholder="שם משפחה" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="דרגה">
                <select value={form.rank} onChange={e => setForm({ ...form, rank: e.target.value as Rank })} className={inputCls}>
                  {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="תפקיד">
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className={inputCls}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="פלאפון">
                <input type="tel" value={form.phone} dir="ltr"
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  className={inputCls} placeholder="050-0000000" />
              </Field>
              <Field label="צוות">
                <select value={form.teamId ?? ''} onChange={e => setForm({ ...form, teamId: e.target.value || null })} className={inputCls}>
                  <option value="">ללא צוות</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="מספר אישי">
                <input type="text" value={form.personalNumber ?? ''}
                  onChange={e => setForm({ ...form, personalNumber: e.target.value })}
                  className={inputCls} placeholder="0000000" dir="ltr" />
              </Field>
              <Field label="תעודת זהות">
                <input type="text" value={form.idNumber ?? ''}
                  onChange={e => setForm({ ...form, idNumber: e.target.value })}
                  className={inputCls} placeholder="000000000" dir="ltr" />
              </Field>
            </div>
            <Field label="תאריך לידה">
              <input type="date" value={form.birthDate ?? ''}
                onChange={e => setForm({ ...form, birthDate: e.target.value })}
                className={inputCls} dir="ltr" />
            </Field>
            <Field label="כתובת">
              <input type="text" value={form.address ?? ''}
                onChange={e => setForm({ ...form, address: e.target.value })}
                className={inputCls} placeholder="רחוב, עיר" />
            </Field>
            {canChangePermissionLevel(viewer) && (
              <Field label="רמת הרשאה בסיסית">
                <select value={form.permissionLevel}
                  onChange={e => setForm({ ...form, permissionLevel: e.target.value as PermissionLevel })}
                  className={inputCls}>
                  {(Object.keys(PERMISSION_LEVEL_LABELS) as PermissionLevel[]).map(l => (
                    <option key={l} value={l}>{PERMISSION_LEVEL_LABELS[l]}</option>
                  ))}
                </select>
              </Field>
            )}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isActive" checked={form.isActive}
                onChange={e => setForm({ ...form, isActive: e.target.checked })} className="w-4 h-4" />
              <label htmlFor="isActive" className="text-sm text-gray-700">חייל פעיל</label>
            </div>
            <div className="flex gap-3 pt-1">
              <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors">
                {editingSoldier ? 'שמור שינויים' : 'הוסף חייל'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditingSoldier(null); }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg font-medium">
                ביטול
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Confirm Delete Modal ─────────────────────────────────────────────── */}
      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(null)}>
          <h3 className="text-lg font-bold mb-2">אישור מחיקה</h3>
          <p className="text-gray-600 mb-4">האם למחוק את החייל? פעולה זו לא ניתנת לביטול.</p>
          <div className="flex gap-3">
            <button onClick={() => handleDelete(confirmDelete)}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium">
              מחק
            </button>
            <button onClick={() => setConfirmDelete(null)}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg font-medium">
              ביטול
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function DetailPanel({
  soldier, viewer, teams, onEdit, onDelete,
  onToggleExtraPermission, onChangePermissionLevel,
}: {
  soldier: Soldier;
  viewer: Soldier | null;
  teams: Team[];
  onEdit: () => void;
  onDelete: () => void;
  onToggleExtraPermission: (s: Soldier, p: ExtraPermission) => void;
  onChangePermissionLevel: (s: Soldier, l: PermissionLevel) => void;
}) {
  const teamName = teams.find(t => t.id === soldier.teamId)?.name ?? '—';
  const canEdit = viewer ? canEditSoldier(viewer) : false;
  const canDelete = viewer ? canDeleteSoldier(viewer) : false;
  const canSeePrivate = viewer ? canSeeFullDetails(viewer, soldier) : false;
  const canManage = viewer ? canManagePermissions(viewer) : false;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm h-full overflow-y-auto">
      {/* Panel header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">{fullName(soldier)}</h2>
          <p className="text-sm text-gray-500">{soldier.rank} · {soldier.role} · {teamName}</p>
        </div>
        <div className="flex gap-2">
          {!soldier.isActive && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">לא פעיל</span>
          )}
          {canEdit && (
            <button onClick={onEdit}
              className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm px-3 py-1.5 rounded-lg font-medium transition-colors">
              ✏️ ערוך
            </button>
          )}
          {canDelete && (
            <button onClick={onDelete}
              className="bg-red-50 hover:bg-red-100 text-red-600 text-sm px-3 py-1.5 rounded-lg font-medium transition-colors">
              🗑 מחק
            </button>
          )}
        </div>
      </div>

      <div className="px-6 py-4 space-y-6">
        {/* Basic info — always visible */}
        <Section title="פרטי קשר">
          <InfoRow label="שם מלא" value={fullName(soldier)} />
          <InfoRow label="פלאפון" value={soldier.phone || '—'} ltr />
          <InfoRow label="דרגה" value={soldier.rank} />
          <InfoRow label="תפקיד" value={soldier.role} />
          <InfoRow label="צוות" value={teamName} />
        </Section>

        {/* Private info — permission-gated */}
        <Section
          title="פרטים אישיים"
          badge={!canSeePrivate ? '🔒 מוגבל' : undefined}
        >
          {canSeePrivate ? (
            <>
              <InfoRow label="מספר אישי" value={soldier.personalNumber || '—'} ltr />
              <InfoRow label="תעודת זהות" value={soldier.idNumber || '—'} ltr />
              <InfoRow label="תאריך לידה" value={soldier.birthDate ? formatDate(soldier.birthDate) : '—'} />
              <InfoRow label="כתובת" value={soldier.address || '—'} />
            </>
          ) : (
            <p className="text-sm text-gray-400 italic">
              אין לך הרשאה לצפות בפרטים אישיים של חייל זה.
            </p>
          )}
        </Section>

        {/* Permissions section — management-gated */}
        <Section title="הרשאות">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm text-gray-600">רמה בסיסית:</span>
            {canManage && canChangePermissionLevel(viewer!) ? (
              <select
                value={soldier.permissionLevel}
                onChange={e => onChangePermissionLevel(soldier, e.target.value as PermissionLevel)}
                className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {(Object.keys(PERMISSION_LEVEL_LABELS) as PermissionLevel[]).map(l => (
                  <option key={l} value={l}>{PERMISSION_LEVEL_LABELS[l]}</option>
                ))}
              </select>
            ) : (
              <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${
                soldier.permissionLevel === 'company_commander' ? 'bg-purple-100 text-purple-700' :
                soldier.permissionLevel === 'team_commander' ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {PERMISSION_LEVEL_LABELS[soldier.permissionLevel]}
              </span>
            )}
          </div>

          <div className="space-y-2">
            {EXTRA_PERMISSIONS.map(perm => {
              const hasPerm = soldier.extraPermissions.includes(perm);
              const canGrant = viewer ? canGrantPermission(viewer, soldier, perm) : false;
              return (
                <div key={perm} className={`flex items-start gap-3 p-3 rounded-lg border ${hasPerm ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{EXTRA_PERMISSION_LABELS[perm]}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{EXTRA_PERMISSION_DESC[perm]}</p>
                  </div>
                  {canGrant ? (
                    <button
                      onClick={() => onToggleExtraPermission(soldier, perm)}
                      className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                        hasPerm
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {hasPerm ? 'בטל' : 'הענק'}
                    </button>
                  ) : (
                    <span className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full ${hasPerm ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                      {hasPerm ? '✓ פעיל' : '—'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

function Section({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
        {badge && <span className="text-xs text-gray-400">{badge}</span>}
      </div>
      <div className="bg-gray-50 rounded-lg p-3 space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
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

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString('he-IL');
  } catch {
    return d;
  }
}

const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400";
