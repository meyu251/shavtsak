import { AppData, Soldier, TaskTemplate, Assignment, Team, CurrentUser } from './types';

const STORAGE_KEY = 'shavtsak_data';
const CURRENT_USER_KEY = 'shavtsak_current_user';

const defaultData: AppData = {
  teams: [
    { id: 'team1', name: 'צוות א' },
    { id: 'team2', name: 'צוות ב' },
  ],
  soldiers: [
    {
      id: '1', firstName: 'מאיר', lastName: 'יוסט',
      rank: 'סרן', phone: '050-1234567', role: 'מפקד פלוגה',
      isActive: true, teamId: null,
      permissionLevel: 'company_commander', extraPermissions: [],
    },
    {
      id: '2', firstName: 'ניר', lastName: 'לוסטיג',
      rank: 'סמל', phone: '050-2234567', role: 'מפקד צוות',
      isActive: true, teamId: 'team1',
      permissionLevel: 'team_commander', extraPermissions: [],
    },
    {
      id: '3', firstName: 'מיכאל', lastName: 'ירט',
      rank: 'סמל', phone: '050-5234567', role: 'מפקד צוות',
      isActive: true, teamId: 'team2',
      permissionLevel: 'team_commander', extraPermissions: [],
    },
    {
      id: '4', firstName: 'אביתר', lastName: 'בן-שושן',
      rank: 'רב"ט', phone: '050-3234567', role: 'נהג',
      isActive: true, teamId: 'team1',
      permissionLevel: 'soldier', extraPermissions: [],
    },
    {
      id: '5', firstName: 'יגאל', lastName: 'שטיינמיץ',
      rank: 'טוראי', phone: '050-4234567', role: 'לוחם',
      isActive: true, teamId: 'team1',
      permissionLevel: 'soldier', extraPermissions: [],
    },
    {
      id: '6', firstName: 'אסף', lastName: 'פרוינד',
      rank: 'טוראי', phone: '050-6234567', role: 'לוחם',
      isActive: true, teamId: 'team2',
      permissionLevel: 'soldier', extraPermissions: [],
    },
    {
      id: '7', firstName: 'אלון', lastName: 'האוקיפ',
      rank: 'רב"ט', phone: '050-7234567', role: 'לוחם',
      isActive: true, teamId: 'team2',
      permissionLevel: 'soldier', extraPermissions: [],
    },
    {
      id: '8', firstName: 'טאי', lastName: 'ארזואן',
      rank: 'טוראי', phone: '050-8234567', role: 'לוחם',
      isActive: true, teamId: 'team1',
      permissionLevel: 'soldier', extraPermissions: [],
    },
  ],
  taskTemplates: [
    { id: '1', name: 'סיור בוקר', startTime: '07:00', endTime: '15:00', requiredCount: 3, location: 'כרמל א', notes: '' },
    { id: '2', name: 'סיור ערב', startTime: '15:00', endTime: '23:00', requiredCount: 3, location: 'כרמל א', notes: '' },
    { id: '3', name: 'סיור לילה', startTime: '23:00', endTime: '07:00', requiredCount: 3, location: 'כרמל א', notes: '' },
    { id: '4', name: 'שמירה בשער', startTime: '07:00', endTime: '19:00', requiredCount: 2, location: 'שער הבסיס', notes: '' },
    { id: '5', name: 'תורן', startTime: '00:00', endTime: '23:59', requiredCount: 1, location: 'חפ"ק', notes: '' },
  ],
  assignments: [],
};

/** Migration: old Soldier had a single 'name' field */
function migrateSoldier(s: Record<string, unknown>): Soldier {
  if (!s.firstName && s.name) {
    const parts = (s.name as string).split(' ');
    s.firstName = parts[0] ?? '';
    s.lastName = parts.slice(1).join(' ') ?? '';
    delete s.name;
  }
  if (!s.permissionLevel) s.permissionLevel = 'soldier';
  if (!s.extraPermissions) s.extraPermissions = [];
  if (s.teamId === undefined) s.teamId = null;
  return s as unknown as Soldier;
}

export function loadData(): AppData {
  if (typeof window === 'undefined') return defaultData;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // Migrate soldiers
    if (Array.isArray(parsed.soldiers)) {
      parsed.soldiers = (parsed.soldiers as Record<string, unknown>[]).map(migrateSoldier);
    }
    if (!parsed.teams) parsed.teams = defaultData.teams;
    return parsed as unknown as AppData;
  } catch {
    return defaultData;
  }
}

export function saveData(data: AppData): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ── Current User ─────────────────────────────────────────────────────────────

export function loadCurrentUser(): CurrentUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CurrentUser;
  } catch {
    return null;
  }
}

export function saveCurrentUser(user: CurrentUser): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
}

// ── Soldiers ─────────────────────────────────────────────────────────────────

export function addSoldier(data: AppData, soldier: Omit<Soldier, 'id'>): AppData {
  const newSoldier: Soldier = { ...soldier, id: crypto.randomUUID() };
  return { ...data, soldiers: [...data.soldiers, newSoldier] };
}

export function updateSoldier(data: AppData, updated: Soldier): AppData {
  return { ...data, soldiers: data.soldiers.map(s => s.id === updated.id ? updated : s) };
}

export function deleteSoldier(data: AppData, id: string): AppData {
  return { ...data, soldiers: data.soldiers.filter(s => s.id !== id) };
}

// ── Teams ─────────────────────────────────────────────────────────────────────

export function addTeam(data: AppData, team: Omit<Team, 'id'>): AppData {
  const newTeam: Team = { ...team, id: crypto.randomUUID() };
  return { ...data, teams: [...data.teams, newTeam] };
}

export function deleteTeam(data: AppData, id: string): AppData {
  return {
    ...data,
    teams: data.teams.filter(t => t.id !== id),
    soldiers: data.soldiers.map(s => s.teamId === id ? { ...s, teamId: null } : s),
  };
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export function addTask(data: AppData, task: Omit<TaskTemplate, 'id'>): AppData {
  const newTask: TaskTemplate = { ...task, id: crypto.randomUUID() };
  return { ...data, taskTemplates: [...data.taskTemplates, newTask] };
}

export function updateTask(data: AppData, updated: TaskTemplate): AppData {
  return { ...data, taskTemplates: data.taskTemplates.map(t => t.id === updated.id ? updated : t) };
}

export function deleteTask(data: AppData, id: string): AppData {
  return { ...data, taskTemplates: data.taskTemplates.filter(t => t.id !== id) };
}

// ── Assignments ───────────────────────────────────────────────────────────────

export function addAssignment(data: AppData, assignment: Omit<Assignment, 'id'>): AppData {
  const newAssignment: Assignment = { ...assignment, id: crypto.randomUUID() };
  return { ...data, assignments: [...data.assignments, newAssignment] };
}

export function updateAssignment(data: AppData, updated: Assignment): AppData {
  return { ...data, assignments: data.assignments.map(a => a.id === updated.id ? updated : a) };
}

export function deleteAssignment(data: AppData, id: string): AppData {
  return { ...data, assignments: data.assignments.filter(a => a.id !== id) };
}
