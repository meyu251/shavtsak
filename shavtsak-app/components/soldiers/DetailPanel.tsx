"use client";

import { Soldier, PermissionLevel, ExtraPermission } from "@/lib/types";
import type { Section } from "@/lib/types";
import {
  fullName, canSeeFullDetails, canEditSoldier, canDeleteSoldier,
  canManagePermissions, canGrantPermission, canChangePermissionLevel,
  PERMISSION_LEVEL_LABELS, EXTRA_PERMISSION_LABELS, EXTRA_PERMISSION_DESC,
} from "@/lib/permissions";

const EXTRA_PERMISSIONS: ExtraPermission[] = ["extended_data", "management", "schedule", "tasks"];

// ── Sub-helpers ───────────────────────────────────────────────────────────────

function SectionBlock({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
        {badge && <span className="text-xs text-gray-400">{badge}</span>}
      </div>
      <div className="bg-gray-50 rounded-lg p-3 space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-500 w-28 flex-shrink-0">{label}</span>
      <span className="text-gray-800 font-medium" dir={ltr ? "ltr" : undefined}>{value}</span>
    </div>
  );
}

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("he-IL");
  } catch {
    return d;
  }
}

// ── DetailPanel ───────────────────────────────────────────────────────────────

export function DetailPanel({
  soldier, viewer, sections, onEdit, onDelete,
  onToggleExtraPermission, onChangePermissionLevel,
}: {
  soldier: Soldier;
  viewer: Soldier | null;
  sections: Section[];
  onEdit: () => void;
  onDelete: () => void;
  onToggleExtraPermission: (s: Soldier, p: ExtraPermission) => void;
  onChangePermissionLevel: (s: Soldier, l: PermissionLevel) => void;
}) {
  const sectionName = sections.find((sec) => sec.id === soldier.sectionId)?.name ?? "—";
  const canEdit = viewer ? canEditSoldier(viewer, soldier) : false;
  const canDelete = viewer ? canDeleteSoldier(viewer, soldier) : false;
  const canSeePrivate = viewer ? canSeeFullDetails(viewer, soldier) : false;
  const canManage = viewer ? canManagePermissions(viewer) : false;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm h-full overflow-y-auto">
      {/* Panel header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">{fullName(soldier)}</h2>
          <p className="text-sm text-gray-500">{soldier.rank} · {soldier.role} · {sectionName}</p>
        </div>
        <div className="flex gap-2">
          {!soldier.isActive && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">לא פעיל</span>
          )}
          {canEdit && (
            <button
              onClick={onEdit}
              className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm px-3 py-1.5 rounded-lg font-medium transition-colors min-h-[36px] cursor-pointer"
            >
              ✏️ ערוך
            </button>
          )}
          {canDelete && (
            <button
              onClick={onDelete}
              className="bg-red-50 hover:bg-red-100 text-red-600 text-sm px-3 py-1.5 rounded-lg font-medium transition-colors min-h-[36px] cursor-pointer"
            >
              🗑 מחק
            </button>
          )}
        </div>
      </div>

      <div className="px-6 py-4 space-y-6">
        {/* Basic info — always visible */}
        <SectionBlock title="פרטי קשר">
          <InfoRow label="שם מלא" value={fullName(soldier)} />
          <InfoRow label="פלאפון" value={soldier.phone || "—"} ltr />
          <InfoRow label="דרגה" value={soldier.rank} />
          <InfoRow label="תפקיד" value={soldier.role} />
          <InfoRow label="מחלקה" value={sectionName} />
          <InfoRow label="מייל" value={soldier.email || "—"} ltr />
        </SectionBlock>

        {/* Private info — permission-gated */}
        <SectionBlock
          title="פרטים אישיים"
          badge={!canSeePrivate ? "🔒 מוגבל" : undefined}
        >
          {canSeePrivate ? (
            <>
              <InfoRow label="מספר אישי" value={soldier.personalNumber || "—"} ltr />
              <InfoRow label="תעודת זהות" value={soldier.idNumber || "—"} ltr />
              <InfoRow label="תאריך לידה" value={soldier.birthDate ? formatDate(soldier.birthDate) : "—"} />
              <InfoRow label="כתובת" value={soldier.address || "—"} />
            </>
          ) : (
            <p className="text-sm text-gray-400 italic">
              אין לך הרשאה לצפות בפרטים אישיים של חייל זה.
            </p>
          )}
        </SectionBlock>

        {/* Permissions section — management-gated */}
        <SectionBlock title="הרשאות">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm text-gray-600">רמה בסיסית:</span>
            {canManage && viewer && canChangePermissionLevel(viewer) ? (
              <select
                value={soldier.permissionLevel}
                onChange={(e) => onChangePermissionLevel(soldier, e.target.value as PermissionLevel)}
                className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {(Object.keys(PERMISSION_LEVEL_LABELS) as PermissionLevel[]).map((l) => (
                  <option key={l} value={l}>{PERMISSION_LEVEL_LABELS[l]}</option>
                ))}
              </select>
            ) : (
              <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${
                soldier.permissionLevel === "company_commander" ? "bg-purple-100 text-purple-700" :
                soldier.permissionLevel === "section_commander" ? "bg-blue-100 text-blue-700" :
                "bg-gray-100 text-gray-600"
              }`}>
                {PERMISSION_LEVEL_LABELS[soldier.permissionLevel]}
              </span>
            )}
          </div>

          <div className="space-y-2">
            {EXTRA_PERMISSIONS.map((perm) => {
              const hasPerm = soldier.extraPermissions.includes(perm);
              const canGrant = viewer ? canGrantPermission(viewer, soldier, perm) : false;
              return (
                <div
                  key={perm}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    hasPerm ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{EXTRA_PERMISSION_LABELS[perm]}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{EXTRA_PERMISSION_DESC[perm]}</p>
                  </div>
                  {canGrant ? (
                    <button
                      onClick={() => onToggleExtraPermission(soldier, perm)}
                      className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-medium transition-colors min-h-[28px] cursor-pointer ${
                        hasPerm
                          ? "bg-red-100 text-red-700 hover:bg-red-200"
                          : "bg-green-100 text-green-700 hover:bg-green-200"
                      }`}
                    >
                      {hasPerm ? "בטל" : "הענק"}
                    </button>
                  ) : (
                    <span className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full ${
                      hasPerm ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
                    }`}>
                      {hasPerm ? "✓ פעיל" : "—"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </SectionBlock>
      </div>
    </div>
  );
}
