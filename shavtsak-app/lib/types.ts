export type Rank =
  | 'טוראי'
  | 'רב טוראי (רב"ט)'
  | 'סמל'
  | 'סמל ראשון (סמ"ר)'
  | 'רב סמל (רס"ל)'
  | 'רב סמל ראשון (רס"ר)'
  | 'רב סמל מתקדם (רס"מ)'
  | 'רב סמל בכיר (רס"ב)'
  | 'רב נגד (רנ"ג)'
  | 'סגן משנה (סג"מ)'
  | 'סגן'
  | 'סרן'
  | 'רב סרן (רס"ן)'
  | 'סגן אלוף (סא"ל)';

/** רמת הרשאה בסיסית — נקבעת לפי תפקיד */
export type PermissionLevel = 'soldier' | 'section_commander' | 'company_commander';

/** הרשאות נוספות — ניתנות ידנית בתוקף עד ביטול */
export type ExtraPermission = 'extended_data' | 'management' | 'schedule' | 'tasks';

export interface Section {
  id: string;
  name: string; // "מחלקה 1", "מחלקה 2", ...
}

export interface Soldier {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: string;
  rank: Rank;
  isActive: boolean;
  sectionId: string | null;
  // פרטים אישיים — גישה לפי הרשאה
  personalNumber?: string; // מספר אישי
  idNumber?: string;       // תעודת זהות
  address?: string;        // כתובת
  birthDate?: string;      // תאריך לידה YYYY-MM-DD
  // הרשאות
  permissionLevel: PermissionLevel;
  extraPermissions: ExtraPermission[];
  // Google OAuth
  email?: string;
}

export interface ExtraContact {
  id: string;
  name: string;
  phone: string;
  notes?: string;
}

export interface TaskTemplate {
  id: string;
  name: string;
  startTime: string; // "07:00"
  endTime: string;   // "15:00"
  requiredCount: number;
  location: string;
  notes: string;
  /** true = hourly mode: select hours manually; false/undefined = block mode: default all hours */
  hourly?: boolean;
}

export interface HourSlot {
  hour: string;        // "10:00" — start of the hour
  soldierIds: string[];
}

export interface Assignment {
  id: string;
  date: string;        // "2026-04-12"
  taskId: string;
  soldierIds: string[]; // all assigned soldiers (union across slots, for quick lookups)
  slots?: HourSlot[];   // per-hour breakdown; absent on legacy assignments
}

export interface AppData {
  soldiers: Soldier[];
  sections: Section[];
  taskTemplates: TaskTemplate[];
  assignments: Assignment[];
  extraContacts: ExtraContact[];
  menuOrder?: string[]; // ['all', 'none', ...section IDs] — display order of the sidebar list
}

/** המשתמש המחובר כרגע (מאוחסן ב-localStorage) */
export interface CurrentUser {
  soldierId: string;
}
