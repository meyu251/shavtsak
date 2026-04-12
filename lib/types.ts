export type Rank = 'טוראי' | 'רב"ט' | 'סמל' | 'סמל ראשון' | 'סגן' | 'סרן' | 'רב סרן' | 'סגן אלוף';

export interface Soldier {
  id: string;
  name: string;
  rank: Rank;
  phone: string;
  role: string; // e.g. "לוחם", "נהג", "קשר"
  isActive: boolean;
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
  taskTemplates: TaskTemplate[];
  assignments: Assignment[];
}
