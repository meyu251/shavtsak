import { Soldier, ExtraPermission, PermissionLevel } from './types';

export function fullName(s: Soldier) {
  return `${s.firstName} ${s.lastName}`;
}

/** האם הצופה יכול לראות פרטים מלאים של היעד? */
export function canSeeFullDetails(viewer: Soldier, target: Soldier): boolean {
  if (viewer.permissionLevel === 'company_commander') return true;
  if (viewer.extraPermissions.includes('extended_data')) return true;
  if (
    viewer.permissionLevel === 'section_commander' &&
    viewer.sectionId !== null &&
    viewer.sectionId === target.sectionId
  ) return true;
  return false;
}

/** האם הצופה יכול לערוך פרטי חייל? מ"מ יכול לערוך חיילים במחלקתו בלבד. */
export function canEditSoldier(viewer: Soldier, target?: Soldier): boolean {
  if (viewer.permissionLevel === 'company_commander') return true;
  if (viewer.extraPermissions.includes('management')) return true;
  if (viewer.permissionLevel === 'section_commander' && target) {
    return viewer.sectionId !== null && viewer.sectionId === target.sectionId;
  }
  return false;
}

/** האם הצופה יכול להוסיף חיילים? */
export function canAddSoldier(viewer: Soldier): boolean {
  return (
    viewer.permissionLevel === 'company_commander' ||
    viewer.permissionLevel === 'section_commander'
  );
}

/** האם הצופה יכול למחוק חייל? מ"מ יכול למחוק חיילים במחלקתו בלבד. */
export function canDeleteSoldier(viewer: Soldier, target?: Soldier): boolean {
  if (viewer.permissionLevel === 'company_commander') return true;
  if (viewer.permissionLevel === 'section_commander' && target) {
    return viewer.sectionId !== null && viewer.sectionId === target.sectionId;
  }
  return false;
}

/** האם הצופה יכול לנהל הרשאות בכלל? */
export function canManagePermissions(viewer: Soldier): boolean {
  return (
    viewer.permissionLevel === 'company_commander' ||
    viewer.permissionLevel === 'section_commander' ||
    viewer.extraPermissions.includes('management')
  );
}

/**
 * האם הצופה יכול להעניק הרשאה נוספת ספציפית ליעד?
 *
 * כללים:
 * - מפקד פלוגה: יכול לתת כל הרשאה לכל אחד
 * - מפקד מחלקה: יכול לתת הרשאות לחיילים במחלקה שלו בלבד
 * - כל אחד עם הרשאת ניהול: יכול לתת extended_data לחברי מחלקתו
 */
export function canGrantPermission(
  granter: Soldier,
  target: Soldier,
  _permission: ExtraPermission
): boolean {
  if (granter.id === target.id) return false;
  if (granter.permissionLevel === 'company_commander') return true;
  // מפקד מחלקה (ובעל הרשאת ניהול): רק במחלקה שלו
  if (
    granter.permissionLevel === 'section_commander' ||
    granter.extraPermissions.includes('management')
  ) {
    return granter.sectionId !== null && granter.sectionId === target.sectionId;
  }
  return false;
}

/**
 * האם הצופה יכול לשנות את רמת ההרשאה הבסיסית (permissionLevel) של יעד?
 * רק מפקד פלוגה יכול לעשות זאת.
 */
export function canChangePermissionLevel(granter: Soldier): boolean {
  return granter.permissionLevel === 'company_commander';
}

/** האם הצופה יכול לגשת לניהול כוח אדם? */
export function canAccessSoldierManagement(viewer: Soldier): boolean {
  return (
    viewer.permissionLevel === 'company_commander' ||
    viewer.permissionLevel === 'section_commander' ||
    viewer.extraPermissions.includes('management')
  );
}

/** האם הצופה יכול לגשת לשבצ"ק יומי? */
export function canAccessSchedule(viewer: Soldier): boolean {
  return (
    viewer.permissionLevel === 'company_commander' ||
    viewer.permissionLevel === 'section_commander' ||
    viewer.extraPermissions.includes('schedule')
  );
}

/** האם הצופה יכול לגשת לניהול משימות? */
export function canAccessTaskManagement(viewer: Soldier): boolean {
  return (
    viewer.permissionLevel === 'company_commander' ||
    viewer.extraPermissions.includes('tasks')
  );
}

/** @deprecated השתמש בפונקציות הספציפיות במקום */
export function canAccessCommanderFeatures(viewer: Soldier): boolean {
  return canAccessSoldierManagement(viewer);
}

export const PERMISSION_LEVEL_LABELS: Record<PermissionLevel, string> = {
  soldier: 'חייל',
  section_commander: 'מפקד מחלקה',
  company_commander: 'מפקד פלוגה',
};

export const EXTRA_PERMISSION_LABELS: Record<ExtraPermission, string> = {
  extended_data: 'גישה מורחבת לנתונים',
  management: 'הרשאת ניהול',
  schedule: 'שיבוץ יומי',
  tasks: 'ניהול משימות',
};

export const EXTRA_PERMISSION_DESC: Record<ExtraPermission, string> = {
  extended_data: 'רואה פרטים מלאים של כולם, לא יכול לתת הרשאות לאחרים',
  management: 'גישה מורחבת + יכולת לתת ולבטל הרשאות לחיילי המחלקה',
  schedule: 'גישה לדף שבצ"ק יומי ויכולת שיבוץ',
  tasks: 'גישה לדף ניהול משימות ויכולת עריכה',
};
