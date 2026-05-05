"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Soldier } from "@/lib/types";
import { fullName, PERMISSION_LEVEL_LABELS } from "@/lib/permissions";
import { startImpersonation, stopImpersonation, getImpersonationOriginal } from "@/lib/useAuth";
import { impersonate, getPublicSoldiers, PublicSoldier } from "@/lib/api";

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
  const router = useRouter();
  const [originalUser, setOriginalUser] = useState<Soldier | null>(null);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [soldiers, setSoldiers] = useState<PublicSoldier[]>([]);
  const [loadingSoldiers, setLoadingSoldiers] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOriginalUser(getImpersonationOriginal());
  }, []);

  // סגירת הפאנל בלחיצה מחוץ
  useEffect(() => {
    if (!showDevPanel) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowDevPanel(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showDevPanel]);

  async function openDevPanel() {
    setShowDevPanel(true);
    if (soldiers.length === 0) {
      setLoadingSoldiers(true);
      try {
        setSoldiers(await getPublicSoldiers());
      } finally {
        setLoadingSoldiers(false);
      }
    }
  }

  async function handleImpersonate(soldierId: string) {
    setShowDevPanel(false);
    const { access_token, soldier } = await impersonate(soldierId);
    startImpersonation(access_token, soldier);
    window.location.href = "/";
  }

  function handleStopImpersonation() {
    stopImpersonation();
    window.location.href = "/";
  }

  return (
    <header className="bg-gray-900 text-white shadow-lg flex-shrink-0">
      {/* סרגל התחזות */}
      {originalUser && (
        <div className="bg-amber-500 text-amber-950 px-4 py-1.5 flex items-center justify-between text-sm font-medium">
          <span>מתחזה כ: {currentUser.firstName} {currentUser.lastName}</span>
          <button
            onClick={handleStopImpersonation}
            className="underline hover:no-underline cursor-pointer"
          >
            חזרה ל-{originalUser.firstName} {originalUser.lastName}
          </button>
        </div>
      )}

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

        {/* User info + dev panel + logout */}
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
            currentUser.permissionLevel === 'section_commander' ? 'bg-blue-500' :
            'bg-gray-600'
          }`}>
            {currentUser.firstName[0]}{currentUser.lastName[0]}
          </div>

          {/* כפתור DEV — רק למפתח */}
          {currentUser.isDeveloper && !originalUser && (
            <div className="relative" ref={panelRef}>
              <button
                onClick={openDevPanel}
                className="text-amber-400 hover:text-amber-300 text-xs border border-amber-600 hover:border-amber-400 px-2 py-1 rounded transition-colors whitespace-nowrap cursor-pointer"
              >
                DEV
              </button>

              {showDevPanel && (
                <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50" dir="rtl">
                  <div className="bg-gray-800 px-3 py-2 text-white text-xs font-semibold">כניסה בתור...</div>
                  {loadingSoldiers ? (
                    <p className="text-gray-500 text-sm text-center py-4">טוען...</p>
                  ) : (
                    <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                      {soldiers.map(s => (
                        <button
                          key={s.id}
                          onClick={() => handleImpersonate(s.id)}
                          disabled={s.id === currentUser.id}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-50 transition-colors text-right disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            s.permissionLevel === "company_commander" ? "bg-purple-100 text-purple-700" :
                            s.permissionLevel === "section_commander" ? "bg-blue-100 text-blue-700" :
                            "bg-gray-100 text-gray-600"
                          }`}>
                            {s.firstName[0]}{s.lastName[0]}
                          </div>
                          <div className="flex-1 min-w-0 text-right">
                            <p className="text-sm font-medium text-gray-800">{s.firstName} {s.lastName}</p>
                            <p className="text-xs text-gray-400">{s.rank}</p>
                          </div>
                          {s.id === currentUser.id && (
                            <span className="text-xs text-gray-400">נוכחי</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <button
            onClick={onLogout}
            className="text-gray-400 hover:text-white text-xs border border-gray-600 hover:border-gray-400 px-2 py-1 rounded transition-colors whitespace-nowrap cursor-pointer"
          >
            יציאה
          </button>
        </div>
      </div>
    </header>
  );
}
