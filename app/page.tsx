"use client";

import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { loadData } from "@/lib/store";
import { fullName, canAccessCommanderFeatures } from "@/lib/permissions";
import { useEffect, useState } from "react";
import { Section } from "@/lib/types";

// ── Nav items ─────────────────────────────────────────────────────────────────

const ALL_ITEMS = [
  { href: "/my-tasks",  label: "המשימות שלי",    icon: "📌", color: "bg-orange-500",  commanderOnly: false },
  { href: "/phonebook", label: "ספר טלפונים",    icon: "📞", color: "bg-teal-500",    commanderOnly: false },
  { href: "/schedule",  label: 'שבצ"ק יומי',     icon: "📅", color: "bg-purple-600",  commanderOnly: true  },
  { href: "/soldiers",  label: "ניהול כוח אדם",  icon: "👥", color: "bg-blue-600",    commanderOnly: true  },
  { href: "/tasks",     label: "ניהול משימות",   icon: "📋", color: "bg-green-600",   commanderOnly: true  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { currentUser, logout } = useAuth();
  const [sectionName, setSectionName] = useState<string>('');

  useEffect(() => {
    if (!currentUser) return;
    const data = loadData();
    const sec = data.sections.find((s: Section) => s.id === currentUser.sectionId);
    setSectionName(sec?.name ?? '');
  }, [currentUser]);

  if (!currentUser) return null;

  const isCommander = canAccessCommanderFeatures(currentUser);
  const visibleItems = ALL_ITEMS.filter(item => !item.commanderOnly || isCommander);

  const initials = `${currentUser.firstName[0]}${currentUser.lastName[0]}`;
  const avatarColor =
    currentUser.permissionLevel === 'company_commander' ? 'bg-purple-500' :
    currentUser.permissionLevel === 'section_commander' ? 'bg-blue-500' :
    'bg-gray-500';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 text-white shadow-lg flex-shrink-0">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* App name — right */}
          <span className="text-xl font-bold tracking-wide">🪖 שבצק</span>

          {/* Avatar — left → navigates to profile */}
          <Link href="/profile">
            <div className={`${avatarColor} w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold cursor-pointer hover:opacity-80 transition-opacity`}>
              {initials}
            </div>
          </Link>
        </div>
      </header>

      {/* Greeting */}
      <div className="max-w-2xl mx-auto w-full px-4 pt-6 pb-2">
        <h2 className="text-xl font-bold text-gray-800">
          שלום, {fullName(currentUser)} 👋
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {currentUser.role}
          {sectionName && ` · ${sectionName}`}
        </p>
      </div>

      {/* Nav grid */}
      <main className="max-w-2xl mx-auto w-full px-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          {visibleItems.map(item => (
            <Link key={item.href} href={item.href}>
              <div className={`${item.color} text-white rounded-xl p-5 shadow-md cursor-pointer transition-transform active:scale-95 hover:scale-105 flex flex-col items-center justify-center gap-2 aspect-square`}>
                <span className="text-4xl">{item.icon}</span>
                <span className="text-base font-semibold text-center leading-tight">{item.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </main>

      {/* Logout */}
      <div className="max-w-2xl mx-auto w-full px-4 pb-8 mt-auto">
        <button
          onClick={logout}
          className="w-full text-sm text-gray-400 hover:text-gray-600 py-2 transition-colors"
        >
          יציאה מהמערכת
        </button>
      </div>
    </div>
  );
}
