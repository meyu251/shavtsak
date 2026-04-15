/**
 * timeUtils.ts — פונקציות עזר לזמנים ושעות.
 * משמש ב-schedule/page.tsx וב-my-tasks/page.tsx.
 */

import { HourSlot } from "./types";

/**
 * מחזיר רשימת שעות (HH:00) מ-startTime עד endTime (לא כולל).
 * מטפל בחציית חצות (למשל 23:00–07:00).
 */
export function generateHours(startTime: string, endTime: string): string[] {
  const [sh] = startTime.split(":").map(Number);
  const [eh] = endTime.split(":").map(Number);
  let startH = sh;
  let endH = eh;
  if (endH <= startH) endH += 24;
  const hours: string[] = [];
  for (let h = startH; h < endH; h++) {
    hours.push(`${String(h % 24).padStart(2, "0")}:00`);
  }
  return hours;
}

/** בדיקה האם כל השעות משובצות עם אותם חיילים בדיוק */
export function isUniform(slots: HourSlot[], taskHours: string[]): boolean {
  if (!taskHours.length) return true;
  const hourMap: Record<string, string> = {};
  taskHours.forEach((h) => { hourMap[h] = ""; });
  slots.forEach((slot) => {
    if (hourMap[slot.hour] !== undefined)
      hourMap[slot.hour] = [...slot.soldierIds].sort().join(",");
  });
  const first = hourMap[taskHours[0]];
  return taskHours.every((h) => hourMap[h] === first);
}

export interface DisplayRow {
  from: string;
  to: string;
  soldierIds: string[];
}

/**
 * בונה שורות תצוגה — ממזג שעות רצופות עם אותם חיילים לטווח אחד.
 * לדוגמה: 08:00–10:00 חיילים [א, ב], 10:00–12:00 חיילים [ג]
 */
export function buildDisplayRows(
  slots: HourSlot[],
  taskHours: string[],
  taskEndTime: string
): DisplayRow[] {
  if (!taskHours.length) return [];
  const hourMap: Record<string, string[]> = {};
  taskHours.forEach((h) => { hourMap[h] = []; });
  slots.forEach((slot) => {
    if (hourMap[slot.hour] !== undefined) hourMap[slot.hour] = slot.soldierIds;
  });
  const rows: DisplayRow[] = [];
  let i = 0;
  while (i < taskHours.length) {
    const key = [...hourMap[taskHours[i]]].sort().join(",");
    let j = i + 1;
    while (j < taskHours.length && [...hourMap[taskHours[j]]].sort().join(",") === key) j++;
    const to = j < taskHours.length ? taskHours[j] : taskEndTime;
    rows.push({ from: taskHours[i], to, soldierIds: hourMap[taskHours[i]] });
    i = j;
  }
  return rows;
}
