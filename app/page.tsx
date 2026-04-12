"use client";

import Link from "next/link";

const navItems = [
  {
    href: "/soldiers",
    title: "ניהול כוח אדם",
    description: "הוסף, ערוך והסר חיילים מהרשימה",
    icon: "👥",
    color: "bg-blue-600 hover:bg-blue-700",
  },
  {
    href: "/tasks",
    title: "ניהול משימות",
    description: "הגדר משימות, שעות ומספר נדרש",
    icon: "📋",
    color: "bg-green-600 hover:bg-green-700",
  },
  {
    href: "/schedule",
    title: "שיבוץ יומי",
    description: "שבץ חיילים למשימות לפי תאריך",
    icon: "📅",
    color: "bg-purple-600 hover:bg-purple-700",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gray-900 text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center gap-3">
          <span className="text-3xl">🪖</span>
          <div>
            <h1 className="text-2xl font-bold tracking-wide">שבצק</h1>
            <p className="text-gray-400 text-sm">מערכת שיבוץ כוחות ומשימות</p>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-xl font-semibold text-gray-700 mb-8">בחר פעולה</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div
                className={`${item.color} text-white rounded-xl p-6 shadow-md cursor-pointer transition-transform hover:scale-105`}
              >
                <div className="text-4xl mb-3">{item.icon}</div>
                <h3 className="text-lg font-bold mb-1">{item.title}</h3>
                <p className="text-sm opacity-80">{item.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
