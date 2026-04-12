import { AppData, Soldier, TaskTemplate, Assignment } from './types';

const STORAGE_KEY = 'shavtsak_data';

const defaultData: AppData = {
  soldiers: [
    { id: '1', name: 'מאיר יוסט', rank: 'סמל', phone: '050-1234567', role: 'לוחם', isActive: true },
    { id: '2', name: 'ניר לוסטיג', rank: 'טוראי', phone: '050-2234567', role: 'לוחם', isActive: true },
    { id: '3', name: 'אביתר בן-שושן', rank: 'רב"ט', phone: '050-3234567', role: 'נהג', isActive: true },
    { id: '4', name: 'יגאל שטיינמיץ', rank: 'טוראי', phone: '050-4234567', role: 'לוחם', isActive: true },
    { id: '5', name: 'מיכאל ירט', rank: 'סמל', phone: '050-5234567', role: 'קשר', isActive: true },
    { id: '6', name: 'אסף פרוינד', rank: 'טוראי', phone: '050-6234567', role: 'לוחם', isActive: true },
    { id: '7', name: 'אלון האוקיפ', rank: 'רב"ט', phone: '050-7234567', role: 'לוחם', isActive: true },
    { id: '8', name: 'טאי ארזואן', rank: 'טוראי', phone: '050-8234567', role: 'לוחם', isActive: true },
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

export function loadData(): AppData {
  if (typeof window === 'undefined') return defaultData;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData;
    return JSON.parse(raw) as AppData;
  } catch {
    return defaultData;
  }
}

export function saveData(data: AppData): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function addSoldier(data: AppData, soldier: Omit<Soldier, 'id'>): AppData {
  const newSoldier: Soldier = { ...soldier, id: crypto.randomUUID() };
  return { ...data, soldiers: [...data.soldiers, newSoldier] };
}

export function updateSoldier(data: AppData, updated: Soldier): AppData {
  return { ...data, soldiers: data.soldiers.map(s => s.id === updated.id ? updated : s) };
}

export function removeSoldier(data: AppData, id: string): AppData {
  return { ...data, soldiers: data.soldiers.map(s => s.id === id ? { ...s, isActive: false } : s) };
}

export function deleteSoldier(data: AppData, id: string): AppData {
  return { ...data, soldiers: data.soldiers.filter(s => s.id !== id) };
}

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
