"use client";

import { useState, useEffect, useMemo } from "react";
import { Soldier, Rank, PermissionLevel, ExtraPermission } from "@/lib/types";
import type { Section as SectionType } from "@/lib/types";
import * as api from "@/lib/api";
import {
  fullName, canAddSoldier, canGrantPermission, canChangePermissionLevel,
  PERMISSION_LEVEL_LABELS,
} from "@/lib/permissions";
import { useAuth } from "@/lib/useAuth";
import AppHeader from "@/components/AppHeader";
import { showToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { DetailPanel } from "@/components/soldiers/DetailPanel";
import { Field, inputCls } from "@/components/soldiers/FormHelpers";
import {
  DndContext, closestCenter, DragEndEvent,
  PointerSensor, TouchSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ── Constants ─────────────────────────────────────────────────────────────────

const RANKS: Rank[] = [
  'טוראי',
  'רב טוראי (רב"ט)',
  'סמל',
  'סמל ראשון (סמ"ר)',
  'רב סמל (רס"ל)',
  'רב סמל ראשון (רס"ר)',
  'רב סמל מתקדם (רס"מ)',
  'רב סמל בכיר (רס"ב)',
  'רב נגד (רנ"ג)',
  'סגן משנה (סג"מ)',
  'סגן',
  'סרן',
  'רב סרן (רס"ן)',
  'סגן אלוף (סא"ל)',
];
const ROLES = [
  'לוחם', 'נהג', 'קשר', 'חובש', 'קלע', 'מטול', 'מאג',
  'מפקד כיתה', 'סמל', 'מפקד מחלקה', 'סגן מפקד פלוגה', 'מפקד פלוגה',
];

const ROLE_ABBR: Record<string, string> = {
  'מפקד פלוגה': 'מ"פ',
  'סגן מפקד פלוגה': 'סמ"פ',
  'מפקד מחלקה': 'מ"מ',
  'סגן מפקד מחלקה': 'סמ"מ',
  'מפקד כיתה': 'מ"כ',
};


function emptyForm(): Omit<Soldier, 'id'> {
  return {
    firstName: '', lastName: '', phone: '', role: 'לוחם', rank: 'טוראי',
    isActive: true, sectionId: null,
    personalNumber: '', idNumber: '', address: '', birthDate: '',
    permissionLevel: 'soldier', extraPermissions: [],
    email: '',
  };
}

// ── Sortable section item ────────────────────────────────────────────────────

function SortableSectionItem({ itemId, label, count, canDrag, onSelect, onSettings }: {
  itemId: string; label: string; count: number;
  canDrag: boolean; onSelect: () => void; onSettings?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: itemId, disabled: !canDrag });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <li ref={setNodeRef} style={style} onClick={onSelect}
      className="px-3 py-2 cursor-pointer hover:bg-gray-50 flex items-center justify-between min-h-[44px]"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          {...attributes}
          {...(canDrag ? listeners : {})}
          onClick={e => { e.stopPropagation(); onSettings?.(); }}
          className={`text-lg leading-none text-gray-500 hover:text-gray-700 px-1 touch-none select-none ${canDrag ? 'cursor-grab' : 'cursor-default'}`}
          aria-hidden
        >≡</span>
        <p className="font-medium text-sm text-gray-800">{label}</p>
      </div>
      <div className="text-xs text-gray-500">{count}</div>
    </li>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SoldiersPage() {
  const { currentUser, logout } = useAuth();
  const [soldiers, setSoldiers] = useState<Soldier[]>([]);
  const [sections, setSections] = useState<SectionType[]>([]);
  const [newSectionName, setNewSectionName] = useState('');
  const [sectionModal, setSectionModal] = useState<SectionType | null>(null);
  const [sectionConfirmDelete, setSectionConfirmDelete] = useState<string | null>(null);
  const [showAddSectionModal, setShowAddSectionModal] = useState(false);
  const [memberToAdd, setMemberToAdd] = useState<string>('');
  const [sectionEditMode, setSectionEditMode] = useState(false);
  const [sectionEditName, setSectionEditName] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingSoldier, setEditingSoldier] = useState<Soldier | null>(null);
  const [form, setForm] = useState<Omit<Soldier, 'id'>>(emptyForm());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [menuOrder, setMenuOrder] = useState<string[]>(['all', 'none']);

  const sectionSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.getSoldiers(), api.getSections()])
      .then(([s, sec]) => {
        setSoldiers(s);
        setSections(sec);
        const saved = localStorage.getItem('shavtsak_menu_order');
        const parsed: string[] = saved ? JSON.parse(saved) : [];
        const allIds = ['all', 'none', ...sec.map(x => x.id)];
        const merged = [
          ...parsed.filter(id => allIds.includes(id)),
          ...allIds.filter(id => !parsed.includes(id)),
        ];
        setMenuOrder(merged);
      })
      .catch(() => showToast('שגיאה בטעינת הנתונים'))
      .finally(() => setLoading(false));
  }, []);


  // Keep viewer in sync with currentUser (which may update after edits)
  const viewer = useMemo(
    () => currentUser ? (soldiers.find(s => s.id === currentUser.id) ?? currentUser) : null,
    [soldiers, currentUser]
  );
  const selected = useMemo(() => soldiers.find(s => s.id === selectedId) ?? null, [soldiers, selectedId]);
  const currentSection = useMemo(() => sections.find(s => s.id === teamFilter) ?? null, [sections, teamFilter]);

  // ── Filtered list ──────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return soldiers.filter(s => {
      const name = fullName(s).toLowerCase();
      const matchSearch = !search || name.includes(search.toLowerCase());
      const matchTeam =
        teamFilter === 'all' ||
        (teamFilter === 'none' && s.sectionId === null) ||
        s.sectionId === teamFilter;
      return matchSearch && matchTeam;
    });
  }, [soldiers, search, teamFilter]);

  const activeFiltered = filtered.filter(s => s.isActive);
  const inactiveFiltered = filtered.filter(s => !s.isActive);

  // ── Form handlers ──────────────────────────────────────────────────────────

  function openAddForm() {
    setEditingSoldier(null);
    const base = emptyForm();
    // מ"מ יכול להוסיף רק למחלקתו
    if (viewer?.permissionLevel === 'section_commander') {
      base.sectionId = viewer.sectionId;
    }
    setForm(base);
    setShowForm(true);
  }

  function openEditForm(s: Soldier) {
    setEditingSoldier(s);
    setForm({
      firstName: s.firstName, lastName: s.lastName, phone: s.phone,
      role: s.role, rank: s.rank, isActive: s.isActive, sectionId: s.sectionId,
      personalNumber: s.personalNumber ?? '', idNumber: s.idNumber ?? '',
      address: s.address ?? '', birthDate: s.birthDate ?? '',
      permissionLevel: s.permissionLevel, extraPermissions: [...s.extraPermissions],
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim()) return;
    setSaving(true);
    try {
      if (editingSoldier) {
        const updated = await api.updateSoldier(editingSoldier.id, form);
        setSoldiers(prev => prev.map(s => s.id === updated.id ? updated : s));
      } else {
        const created = await api.addSoldier(form);
        setSoldiers(prev => [...prev, created]);
      }
      setShowForm(false);
      setEditingSoldier(null);
    } catch {
      showToast('שגיאה בשמירת החייל');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteSoldier(id);
      setSoldiers(prev => prev.filter(s => s.id !== id));
      if (selectedId === id) setSelectedId(null);
      setConfirmDelete(null);
    } catch {
      showToast('שגיאה במחיקת החייל');
    }
  }

  // ── Sections management (company commander) ─────────────────────────────────
  async function handleAddSection(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!newSectionName.trim() || !viewer) return;
    if (viewer.permissionLevel !== 'company_commander') return;
    try {
      const created = await api.addSection({ name: newSectionName.trim() });
      setSections(prev => [...prev, created]);
      setMenuOrder(prev => [...prev, created.id]);
      setNewSectionName('');
      setShowAddSectionModal(false);
    } catch {
      showToast('שגיאה ביצירת מחלקה');
    }
  }

  async function handleDeleteSection(id: string) {
    if (!viewer) return;
    if (viewer.permissionLevel !== 'company_commander') return;
    try {
      await api.deleteSection(id);
      setSections(prev => prev.filter(s => s.id !== id));
      setMenuOrder(prev => prev.filter(x => x !== id));
      if (teamFilter === id) setTeamFilter('all');
    } catch {
      showToast('שגיאה במחיקת המחלקה');
    }
  }

  function openSectionModal(sec: SectionType, edit: boolean = false) {
    setSectionModal(sec);
    setMemberToAdd('');
    setSectionEditMode(Boolean(edit));
    setSectionEditName(sec.name);
  }

  async function handleUpdateSection(name?: string) {
    if (!sectionModal) return;
    const newName = name ?? sectionModal.name;
    try {
      const updated = await api.updateSection(sectionModal.id, { name: newName });
      setSections(prev => prev.map(s => s.id === updated.id ? updated : s));
      setSectionModal(prev => prev ? { ...prev, name: newName } : prev);
    } catch {
      showToast('שגיאה בעדכון המחלקה');
    }
  }

  // Drag & drop handlers for sections (company commander)
  function handleSectionDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = menuOrder.indexOf(active.id as string);
    const newIndex = menuOrder.indexOf(over.id as string);
    const next = arrayMove(menuOrder, oldIndex, newIndex);
    localStorage.setItem('shavtsak_menu_order', JSON.stringify(next));
    setSections(prev => {
      const reordered = next
        .filter(id => id !== 'all' && id !== 'none')
        .map(id => prev.find(s => s.id === id)!)
        .filter(Boolean);
      return reordered;
    });
    setMenuOrder(next);
  }

  async function handleAddMemberToSection() {
    if (!sectionModal || !memberToAdd) return;
    const soldier = soldiers.find(s => s.id === memberToAdd);
    if (!soldier) return;
    if (soldier.sectionId && soldier.sectionId !== sectionModal.id) {
      const ok = confirm(`החייל משוייך כבר למחלקה אחרת. להעביר אותו למחלקה ${sectionModal.name}?`);
      if (!ok) return;
    }
    const updated = await api.updateSoldier(soldier.id, { ...soldier, sectionId: sectionModal.id });
    setSoldiers(prev => prev.map(s => s.id === updated.id ? updated : s));
  }

  // ── Grant / revoke extra permission ───────────────────────────────────────

  async function toggleExtraPermission(target: Soldier, perm: ExtraPermission) {
    if (!viewer) return;
    if (!canGrantPermission(viewer, target, perm)) return;
    const has = target.extraPermissions.includes(perm);
    const next = has
      ? target.extraPermissions.filter(p => p !== perm)
      : [...target.extraPermissions, perm];
    const updated = await api.updateSoldier(target.id, { ...target, extraPermissions: next });
    setSoldiers(prev => prev.map(s => s.id === updated.id ? updated : s));
  }

  async function changePermissionLevel(target: Soldier, level: PermissionLevel) {
    if (!viewer || !canChangePermissionLevel(viewer)) return;
    const updated = await api.updateSoldier(target.id, { ...target, permissionLevel: level });
    setSoldiers(prev => prev.map(s => s.id === updated.id ? updated : s));
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!currentUser) return null;
  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-purple-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const headerActions = viewer ? (
    <div className="flex items-center gap-2">
      {canAddSoldier(viewer) && (
        <button
          onClick={openAddForm}
          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
        >
          + הוסף חייל
        </button>
      )}
      {viewer.permissionLevel === 'company_commander' && (
        <button
          onClick={() => { setShowAddSectionModal(true); setNewSectionName(''); }}
          className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
        >
          + הוסף מחלקה
        </button>
      )}
    </div>
  ) : undefined;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AppHeader
        currentUser={viewer ?? currentUser}
        onLogout={logout}
        backHref="/"
        title="👥 ניהול כוח אדם"
        actions={headerActions}
      />

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

          {/* Sections list (visual, above soldiers) */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-2">
            <div className="flex items-center justify-between px-2 mb-2">
              <div className="text-sm font-medium text-gray-700">מחלקות</div>
              <div className="text-xs text-gray-400">לחץ לפתיחה</div>
            </div>
            <DndContext sensors={sectionSensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
              <SortableContext items={menuOrder} strategy={verticalListSortingStrategy}>
                <ul className="divide-y divide-gray-100">
                  {menuOrder.map((itemId) => {
                    const canDrag = viewer?.permissionLevel === 'company_commander';
                    if (itemId === 'all') return (
                      <SortableSectionItem key="all" itemId="all" label="כולם"
                        count={soldiers.length} canDrag={canDrag} onSelect={() => setTeamFilter('all')} />
                    );
                    if (itemId === 'none') return (
                      <SortableSectionItem key="none" itemId="none" label="ללא שיוך"
                        count={soldiers.filter(s => s.sectionId === null).length} canDrag={canDrag} onSelect={() => setTeamFilter('none')} />
                    );
                    const sec = sections.find(s => s.id === itemId);
                    if (!sec) return null;
                    return (
                      <SortableSectionItem key={sec.id} itemId={sec.id} label={sec.name}
                        count={soldiers.filter(s => s.sectionId === sec.id).length}
                        canDrag={canDrag} onSelect={() => setTeamFilter(sec.id)} onSettings={() => openSectionModal(sec)} />
                    );
                  })}
                </ul>
              </SortableContext>
            </DndContext>
          </div>


          {/* Stats */}
          <div className="text-xs text-gray-500 px-1">
            {activeFiltered.length} פעילים
            {inactiveFiltered.length > 0 && ` · ${inactiveFiltered.length} לא פעילים`}
          </div>


        </aside>

        {/* ── Middle Panel: Soldiers List ───────────────────────────────────── */}
        <main className="w-72 flex-shrink-0 min-w-0">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {currentSection && (
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <h3 className="text-lg font-semibold">{currentSection.name}</h3>
                {viewer?.permissionLevel === 'company_commander' && (
                  <button onClick={() => openSectionModal(currentSection, true)} className="text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded min-h-[36px] cursor-pointer">✏️ עריכה</button>
                )}
              </div>
            )}
            {activeFiltered.length === 0 && inactiveFiltered.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">אין חיילים</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {[...activeFiltered, ...inactiveFiltered].map(s => {
                  const isSelected = s.id === selectedId;
                  const sectionName = sections.find(sec => sec.id === s.sectionId)?.name;
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
                        {sectionName && (
                          <p className="text-xs text-gray-400 truncate">{sectionName}</p>
                        )}
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                        s.permissionLevel === 'company_commander' ? 'bg-purple-100 text-purple-700' :
                        s.permissionLevel === 'section_commander' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {ROLE_ABBR[s.role] ?? s.role.slice(0, 4)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </main>

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
              sections={sections}
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
                <select
                  value={ROLES.includes(form.role) ? form.role : '__other__'}
                  onChange={e => setForm({ ...form, role: e.target.value === '__other__' ? '' : e.target.value })}
                  className={inputCls}
                >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  <option value="__other__">אחר...</option>
                </select>
                {!ROLES.includes(form.role) && (
                  <input
                    type="text" value={form.role} autoFocus
                    placeholder="הכנס תפקיד..."
                    onChange={e => setForm({ ...form, role: e.target.value })}
                    className={`${inputCls} mt-1`}
                  />
                )}
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="פלאפון">
                <input type="tel" value={form.phone} dir="ltr"
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  className={inputCls} placeholder="050-0000000" />
              </Field>
              <Field label="מחלקה">
                {viewer?.permissionLevel === 'section_commander' ? (
                  <input
                    readOnly
                    value={sections.find(s => s.id === viewer.sectionId)?.name ?? '—'}
                    className={`${inputCls} bg-gray-50 text-gray-500 cursor-not-allowed`}
                  />
                ) : (
                  <select value={form.sectionId ?? ''} onChange={e => setForm({ ...form, sectionId: e.target.value || null })} className={inputCls}>
                    <option value="">ללא מחלקה</option>
                    {sections.map(sec => <option key={sec.id} value={sec.id}>{sec.name}</option>)}
                  </select>
                )}
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
            <Field label="מייל Google">
              <input type="email" value={form.email ?? ''} dir="ltr"
                onChange={e => setForm({ ...form, email: e.target.value })}
                className={inputCls} placeholder="example@gmail.com" />
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
              <button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2 rounded-lg font-medium transition-colors">
                {saving ? 'שומר...' : editingSoldier ? 'שמור שינויים' : 'הוסף חייל'}
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

      {/* ── Section Detail / Edit Modal ─────────────────────────────────────── */}
      {sectionModal && (
        <Modal onClose={() => setSectionModal(null)}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-lg font-bold">{sectionModal.name}</h3>
              <p className="text-sm text-gray-500">{soldiers.filter(s => s.sectionId === sectionModal.id).length} חיילים</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSectionEditMode(prev => !prev)} className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm px-3 py-1.5 rounded-lg">✏️ ערוך</button>
              <button onClick={() => setSectionConfirmDelete(sectionModal.id)} className="bg-red-50 hover:bg-red-100 text-red-600 text-sm px-3 py-1.5 rounded-lg">🗑 מחק</button>
            </div>
          </div>

          {!sectionEditMode ? (
            <div className="space-y-3">
              {soldiers.filter(s => s.sectionId === sectionModal.id).map(s => (
                <div key={s.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                  <div>
                    <div className="font-medium">{fullName(s)}</div>
                    <div className="text-xs text-gray-500">{s.rank} · {s.role}</div>
                  </div>
                  <div className="text-xs text-gray-500">{s.phone}</div>
                </div>
              ))}
              {soldiers.filter(s => s.sectionId === sectionModal.id).length === 0 && (
                <div className="text-sm text-gray-400">אין חיילים במחלקה זו</div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">שם המחלקה</label>
                <input value={sectionEditName} onChange={e => setSectionEditName(e.target.value)} className="w-full border px-3 py-2 rounded" />
                <div className="flex gap-2 mt-2">
                  <button onClick={() => { handleUpdateSection(sectionEditName); setSectionEditMode(false); }} className="bg-green-600 text-white px-3 py-1.5 rounded">שמור</button>
                  <button onClick={() => { setSectionEditMode(false); setSectionEditName(sectionModal.name); }} className="bg-gray-100 px-3 py-1.5 rounded">ביטול</button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">הוסף חייל למחלקה</label>
                <div className="flex gap-2">
                  <select value={memberToAdd} onChange={e => setMemberToAdd(e.target.value)} className="flex-1 border px-2 py-1 rounded">
                    <option value="">בחר חייל...</option>
                    {soldiers.map(s => (
                      <option key={s.id} value={s.id}>{fullName(s)}{s.sectionId ? ` — ${sections.find(sec => sec.id === s.sectionId)?.name ?? ''}` : ''}</option>
                    ))}
                  </select>
                  <button onClick={() => handleAddMemberToSection()} className="bg-green-600 text-white px-3 py-1.5 rounded">העבר/הוסף</button>
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Add section modal */}
      {showAddSectionModal && (
        <Modal onClose={() => { setShowAddSectionModal(false); setNewSectionName(''); }}>
          <h2 className="text-lg font-bold mb-4">הוספת מחלקה</h2>
          <form onSubmit={handleAddSection} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">שם המחלקה</label>
              <input
                autoFocus
                type="text"
                value={newSectionName}
                onChange={e => setNewSectionName(e.target.value)}
                placeholder="לדוגמה: מחלקה א'"
                className={inputCls}
                required
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button type="submit" className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg font-medium transition-colors">
                הוסף מחלקה
              </button>
              <button type="button" onClick={() => { setShowAddSectionModal(false); setNewSectionName(''); }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg font-medium">
                ביטול
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Confirm delete section */}
      {sectionConfirmDelete && (
        <Modal onClose={() => setSectionConfirmDelete(null)}>
          <h3 className="text-lg font-bold mb-2">אישור מחיקה</h3>
          <p className="text-gray-600 mb-4">האם למחוק את המחלקה? חיילים המשוייכים אליה יאבדו את השיוך.</p>
          <div className="flex gap-3">
            <button onClick={() => { handleDeleteSection(sectionConfirmDelete); setSectionModal(null); setSectionConfirmDelete(null); }} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium">מחק</button>
            <button onClick={() => setSectionConfirmDelete(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg font-medium">ביטול</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

