/**
 * store.ts — ניהול localStorage.
 *
 * מה נשאר כאן:
 *  - loadCurrentUser / saveCurrentUser — שמירת הטוקן ופרטי המשתמש הנוכחי
 *  - menuOrder — סדר המחלקות בתפריט השיבוץ (per-user preference)
 *  - loadData / saveData — ל-menuOrder בלבד (legacy migrations כלולות)
 *
 * כל שאר ה-CRUD (חיילים, מחלקות, משימות, שיבוצים, אנשי קשר)
 * מתבצע דרך lib/api.ts שמדבר עם הבקאנד.
 */

import { AppData, Section, CurrentUser } from './types';

const STORAGE_KEY = 'shavtsak_data';
const CURRENT_USER_KEY = 'shavtsak_current_user';

/** defaultData משמש כ-fallback אם localStorage ריק — לצורך menuOrder בלבד */
const defaultData: Pick<AppData, 'sections' | 'menuOrder'> = {
  sections: [
    { id: 'section1', name: 'מחלקה 1' },
    { id: 'section2', name: 'מחלקה 2' },
  ],
  menuOrder: ['all', 'none', 'section1', 'section2'],
};

/** Migration: old section names → current names */
const SECTION_NAME_MIGRATION: Record<string, string> = {
  'צוות א': 'מחלקה 1',
  'צוות ב': 'מחלקה 2',
  'צוות 1': 'מחלקה 1',
  'צוות 2': 'מחלקה 2',
};

/**
 * loadData — טוען את ה-menuOrder מ-localStorage.
 * מבצע migrations על שמות מחלקות ישנים.
 */
export function loadData(): Pick<AppData, 'sections' | 'menuOrder'> & Partial<AppData> {
  if (typeof window === 'undefined') return defaultData;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData;
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    // teams → sections (legacy)
    if (!parsed.sections && parsed.teams) {
      parsed.sections = parsed.teams;
      delete parsed.teams;
    }
    if (!parsed.sections) parsed.sections = defaultData.sections;

    // Migrate old section names (צוות א/ב → מחלקה 1/2)
    if (Array.isArray(parsed.sections)) {
      parsed.sections = (parsed.sections as Record<string, unknown>[]).map(sec => ({
        ...sec,
        name: SECTION_NAME_MIGRATION[sec.name as string] ?? sec.name,
      }));
    }

    // Build menuOrder from sections if missing
    if (!parsed.menuOrder) {
      parsed.menuOrder = ['all', 'none', ...(parsed.sections as Section[]).map((s: Section) => s.id)];
    }

    return parsed as Pick<AppData, 'sections' | 'menuOrder'> & Partial<AppData>;
  } catch {
    return defaultData;
  }
}

export function saveData(data: Partial<AppData>): void {
  if (typeof window === 'undefined') return;
  // מאחד עם מה שכבר שמור — כדי לא למחוק מפתחות אחרים
  const existing = loadData();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...existing, ...data }));
}

// ── Current User ─────────────────────────────────────────────────────────────

export function loadCurrentUser(): CurrentUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CurrentUser;
    if (!parsed.soldierId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCurrentUser(user: CurrentUser): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
}
