"use client";

import Link from "next/link";
import { Soldier } from "@/lib/types";
import { fullName, PERMISSION_LEVEL_LABELS } from "@/lib/permissions";

interface AppHeaderProps {
  currentUser: Soldier;
  onLogout: () => void;
  backHref?: string;
  backLabel?: string;
  title: string;
  actions?: React.ReactNode;
}

export default function AppHeader({
  currentUser, onLogout, backHref, backLabel, title, actions,
}: AppHeaderProps) {
  return (
    <header className="bg-gray-900 text-white shadow-lg flex-shrink-0">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
        {/* Back + title */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {backHref && (
            <>
              <Link href={backHref} className="text-gray-400 hover:text-white transition-colors text-sm whitespace-nowrap">
                {backLabel ?? '← ראשי'}
              </Link>
              <span className="text-gray-600">|</span>
            </>
          )}
          <span className="font-bold truncate">{title}</span>
        </div>

        {/* Extra actions */}
        {actions && <div className="flex items-center gap-2">{actions}</div>}

        {/* User info + logout */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium leading-tight">{fullName(currentUser)}</p>
            <p className="text-xs text-gray-400 leading-tight">
              {PERMISSION_LEVEL_LABELS[currentUser.permissionLevel]}
              {currentUser.extraPermissions.length > 0 && ' ✦'}
            </p>
          </div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
            currentUser.permissionLevel === 'company_commander' ? 'bg-purple-500' :
            currentUser.permissionLevel === 'team_commander' ? 'bg-blue-500' :
            'bg-gray-600'
          }`}>
            {currentUser.firstName[0]}{currentUser.lastName[0]}
          </div>
          <button
            onClick={onLogout}
            className="text-gray-400 hover:text-white text-xs border border-gray-600 hover:border-gray-400 px-2 py-1 rounded transition-colors whitespace-nowrap"
          >
            יציאה
          </button>
        </div>
      </div>
    </header>
  );
}
