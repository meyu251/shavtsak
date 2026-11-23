import { Soldier } from "@/lib/types";

// פרטים שחייל משלים בעצמו בכניסה הראשונה (המפקד בדרך כלל מזין רק שם ומספר אישי)
export const PROFILE_FIELDS: { key: "phone" | "idNumber" | "email" | "address" | "birthDate"; label: string }[] = [
  { key: "phone", label: "פלאפון" },
  { key: "idNumber", label: "תעודת זהות" },
  { key: "email", label: "מייל" },
  { key: "address", label: "כתובת" },
  { key: "birthDate", label: "תאריך לידה" },
];

export function missingProfileFields(s: Partial<Soldier>): string[] {
  return PROFILE_FIELDS.filter(f => !String(s[f.key] ?? "").trim()).map(f => f.label);
}
