/**
 * api.ts — כל הקריאות לבקאנד במקום אחד.
 * כל פונקציה מחזירה Promise — חייבים await בשימוש.
 */

import { Soldier, Section, Company, TaskTemplate, Assignment, ExtraContact, HourSlot } from "./types";

function getApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  return "/api";
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("shavtsak_token");
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${getApiBase()}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? `שגיאה ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export type PublicSoldier = Pick<Soldier, "id" | "firstName" | "lastName" | "rank" | "role" | "permissionLevel">;

export async function login(soldierId: string): Promise<{ access_token: string; soldier: Soldier }> {
  return req("POST", "/auth/login", { soldierId });
}

/** מחזיר את החייל המחובר לפי ה-JWT הנוכחי — לשימוש אחרי כניסה עם Google */
export async function getMe(): Promise<Soldier & { hasPassword: boolean; isDeveloper: boolean }> {
  return req("GET", "/auth/me");
}

/** כתובת הכניסה עם Google — מפנה לבקאנד שמפנה לגוגל */
export function getGoogleLoginUrl(): string {
  return `${getApiBase()}/auth/google`;
}

/** התחזות לחייל אחר — זמין רק למשתמש עם isDeveloper=true */
export async function impersonate(soldierId: string): Promise<{ access_token: string; soldier: Soldier }> {
  return req("POST", `/auth/impersonate/${soldierId}`);
}

/** כניסה עם מספר אישי / ת"ז + סיסמא */
export async function passwordLogin(identifier: string, password: string): Promise<{ access_token: string; soldier: Soldier }> {
  return req("POST", "/auth/password/login", { identifier, password });
}

/** רישום ראשוני — מציאת חייל לפי מספר אישי/ת"ז והגדרת סיסמא */
export async function register(identifier: string, password: string): Promise<{ access_token: string; soldier: Soldier }> {
  return req("POST", "/auth/register", { identifier, password });
}

/** הגדרת סיסמא למשתמש המחובר */
export async function setPassword(password: string): Promise<void> {
  return req("POST", "/auth/password/set", { password });
}

/** מפקד מייצר קוד איפוס לחייל */
export async function createResetCode(soldierId: string): Promise<{ code: string }> {
  return req("POST", "/auth/reset-code/create", { soldierId });
}

/** שימוש בקוד איפוס להגדרת סיסמא חדשה */
export async function useResetCode(
  identifier: string,
  code: string,
  newPassword: string,
): Promise<{ access_token: string; soldier: Soldier }> {
  return req("POST", "/auth/reset-code/use", { identifier, code, newPassword });
}

/** קישור משתמש Google לחייל קיים לפי מספר אישי/ת"ז */
export async function claimSoldier(
  userId: string,
  personalNumber?: string,
  idNumber?: string,
): Promise<{ access_token: string; soldier: Soldier }> {
  return req("POST", "/auth/claim", { userId, personalNumber, idNumber });
}

/** רשימה מינימלית ללא אימות — לדף הכניסה בלבד */
export async function getPublicSoldiers(): Promise<PublicSoldier[]> {
  return req("GET", "/soldiers/public");
}

// ── Soldiers ──────────────────────────────────────────────────────────────────

export async function getSoldiers(): Promise<Soldier[]> {
  return req("GET", "/soldiers");
}

export async function addSoldier(data: Omit<Soldier, "id">): Promise<Soldier> {
  return req("POST", "/soldiers", data);
}

export async function updateSoldier(id: string, data: Omit<Soldier, "id">): Promise<Soldier> {
  return req("PUT", `/soldiers/${id}`, data);
}

export async function deleteSoldier(id: string): Promise<void> {
  return req("DELETE", `/soldiers/${id}`);
}

// ── Sections ──────────────────────────────────────────────────────────────────

export async function getSections(): Promise<Section[]> {
  return req("GET", "/sections");
}

export async function addSection(data: { name: string; companyId?: string | null }): Promise<Section> {
  return req("POST", "/sections", { name: data.name, company_id: data.companyId ?? null });
}

export async function updateSection(id: string, data: { name: string; companyId?: string | null }): Promise<Section> {
  return req("PUT", `/sections/${id}`, { name: data.name, company_id: data.companyId ?? null });
}

export async function deleteSection(id: string): Promise<void> {
  return req("DELETE", `/sections/${id}`);
}

// ── Companies ─────────────────────────────────────────────────────────────────

export async function getCompanies(): Promise<Company[]> {
  return req("GET", "/companies");
}

export async function addCompany(data: { name: string; battalionId?: string | null }): Promise<Company> {
  return req("POST", "/companies", { name: data.name, battalion_id: data.battalionId ?? null });
}

export async function updateCompany(id: string, data: { name: string; battalionId?: string | null }): Promise<Company> {
  return req("PUT", `/companies/${id}`, { name: data.name, battalion_id: data.battalionId ?? null });
}

export async function deleteCompany(id: string): Promise<void> {
  return req("DELETE", `/companies/${id}`);
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export async function getTasks(): Promise<TaskTemplate[]> {
  return req("GET", "/tasks");
}

export async function addTask(data: Omit<TaskTemplate, "id">): Promise<TaskTemplate> {
  return req("POST", "/tasks", data);
}

export async function updateTask(id: string, data: Omit<TaskTemplate, "id">): Promise<TaskTemplate> {
  return req("PUT", `/tasks/${id}`, data);
}

export async function deleteTask(id: string): Promise<void> {
  return req("DELETE", `/tasks/${id}`);
}

// ── Assignments ───────────────────────────────────────────────────────────────

export async function getAssignments(): Promise<Assignment[]> {
  return req("GET", "/assignments");
}

export async function createAssignment(data: {
  date: string;
  taskId: string;
  soldierIds: string[];
  slots: HourSlot[];
}): Promise<Assignment> {
  return req("POST", "/assignments", data);
}

export async function updateAssignment(id: string, data: {
  soldierIds: string[];
  slots: HourSlot[];
}): Promise<Assignment> {
  return req("PUT", `/assignments/${id}`, data);
}

export async function deleteAssignment(id: string): Promise<void> {
  return req("DELETE", `/assignments/${id}`);
}

// ── Contacts ──────────────────────────────────────────────────────────────────

export async function getContacts(): Promise<ExtraContact[]> {
  return req("GET", "/contacts");
}

export async function addContact(data: Omit<ExtraContact, "id">): Promise<ExtraContact> {
  return req("POST", "/contacts", data);
}

export async function deleteContact(id: string): Promise<void> {
  return req("DELETE", `/contacts/${id}`);
}
