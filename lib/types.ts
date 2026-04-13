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
export type PermissionLevel = 'soldier' | 'team_commander' | 'company_commander';

/** הרשאות נוספות — ניתנות ידנית בתוקף עד ביטול */
export type ExtraPermission = 'extended_data' | 'management';

export interface Team {
  id: string;
  name: string;
}

export interface Soldier {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: string;
  rank: Rank;
  isActive: boolean;
  teamId: string | null;
  // פרטים אישיים — גישה לפי הרשאה
  personalNumber?: string; // מספר אישי
  idNumber?: string;       // תעודת זהות
  address?: string;        // כתובת
  birthDate?: string;      // תאריך לידה YYYY-MM-DD
  // הרשאות
  permissionLevel: PermissionLevel;
  extraPermissions: ExtraPermission[];
}

export interface TaskTemplate {
  id: string;
  name: string;
  startTime: string; // "07:00"
  endTime: string;   // "15:00"
  requiredCount: number;
  location: string;
  notes: string;
}

export interface Assignment {
  id: string;
  date: string;       // "2026-04-12"
  taskId: string;
  soldierIds: string[];
}

export interface AppData {
  soldiers: Soldier[];
  teams: Team[];
  taskTemplates: TaskTemplate[];
  assignments: Assignment[];
}

/** המשתמש המחובר כרגע (מאוחסן ב-localStorage) */
export interface CurrentUser {
  soldierId: string;
}
