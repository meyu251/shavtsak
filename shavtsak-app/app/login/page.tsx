"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { fullName, PERMISSION_LEVEL_LABELS } from "@/lib/permissions";
import { getPublicSoldiers, login, getMe, getGoogleLoginUrl, PublicSoldier } from "@/lib/api";
import { saveSession } from "@/lib/useAuth";

// ── Google login button ───────────────────────────────────────────────────────

function GoogleButton() {
  return (
    <a
      href={getGoogleLoginUrl()}
      className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-xl px-4 py-3 hover:bg-gray-50 transition-colors font-medium text-gray-700 text-sm cursor-pointer"
    >
      <svg width="18" height="18" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.7 2.5 30.2 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.8 6c1.8-5.4 6.9-9.8 13.6-9.8z"/>
        <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17z"/>
        <path fill="#FBBC05" d="M10.4 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.9-4.7l-7.8-6A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.8-6z"/>
        <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2 1.4-4.6 2.2-7.7 2.2-6.6 0-12.2-4.5-14.2-10.5l-7.8 6C6.5 42.5 14.6 48 24 48z"/>
      </svg>
      כניסה עם Google
    </a>
  );
}

// ── Manual selector ───────────────────────────────────────────────────────────

function LoginSelector({ soldiers, onLogin }: { soldiers: PublicSoldier[]; onLogin: (id: string) => void }) {
  const [search, setSearch] = useState("");

  const filtered = soldiers.filter(s =>
    `${s.firstName} ${s.lastName}`.includes(search) ||
    s.rank.includes(search) ||
    s.role.includes(search)
  );

  const byLevel = {
    company_commander: filtered.filter(s => s.permissionLevel === "company_commander"),
    section_commander: filtered.filter(s => s.permissionLevel === "section_commander"),
    soldier: filtered.filter(s => s.permissionLevel === "soldier"),
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
      <div className="bg-gray-900 text-white px-6 py-5 text-center">
        <div className="text-4xl mb-2">🪖</div>
        <h1 className="text-xl font-bold">שבצק</h1>
        <p className="text-gray-400 text-sm mt-0.5">מערכת שיבוץ כוחות ומשימות</p>
      </div>

      <div className="p-5 space-y-4">
        {/* Google login */}
        <GoogleButton />

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">או בחר ידנית</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <input
          type="text"
          placeholder="חיפוש..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={inputCls}
        />

        <div className="space-y-4 max-h-80 overflow-y-auto">
          {(["company_commander", "section_commander", "soldier"] as const).map(level => {
            const group = byLevel[level];
            if (group.length === 0) return null;
            return (
              <div key={level}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-1">
                  {PERMISSION_LEVEL_LABELS[level]}
                </p>
                <div className="space-y-1">
                  {group.map(s => (
                    <button
                      key={s.id}
                      onClick={() => onLogin(s.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-blue-50 transition-colors text-right group cursor-pointer"
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        level === "company_commander" ? "bg-purple-100 text-purple-700" :
                        level === "section_commander" ? "bg-blue-100 text-blue-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>
                        {s.firstName[0]}{s.lastName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 text-sm">{s.firstName} {s.lastName}</p>
                        <p className="text-xs text-gray-400 truncate">{s.rank} · {s.role}</p>
                      </div>
                      <span className="text-gray-300 group-hover:text-blue-400 transition-colors">←</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-4">לא נמצאו תוצאות</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page (wrapped in Suspense for useSearchParams) ───────────────────────

function LoginPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [soldiers, setSoldiers] = useState<PublicSoldier[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // טיפול ב-redirect מ-Google OAuth
  useEffect(() => {
    const token = params.get("token");
    const err   = params.get("error");
    const email = params.get("email");

    if (token) {
      // שמירת הטוקן זמנית ב-localStorage כדי ש-getMe() יוכל להשתמש בו
      localStorage.setItem("shavtsak_token", token);
      setLoading(true);
      getMe()
        .then(soldier => {
          saveSession(token, soldier);
          router.push("/");
        })
        .catch(() => {
          localStorage.removeItem("shavtsak_token");
          setError("שגיאה בקבלת פרטי המשתמש. נסה שוב.");
          setLoading(false);
        });
      return;
    }

    if (err) {
      if (err === "not_registered") {
        setError(`המייל ${email ?? ""} לא מקושר לאף חייל במערכת. בקש מהמפקד לקשר את המייל שלך.`);
      } else if (err === "google_cancelled") {
        setError("הכניסה עם Google בוטלה.");
      } else {
        setError("שגיאה בכניסה עם Google. נסה שוב.");
      }
    }
  }, [params, router]);

  useEffect(() => {
    getPublicSoldiers()
      .then(setSoldiers)
      .catch((e: unknown) => setError(`שגיאה: ${e instanceof Error ? e.message : String(e)}`));
  }, []);

  async function handleLogin(soldierId: string) {
    try {
      const { access_token, soldier } = await login(soldierId);
      saveSession(access_token, soldier);
      router.push("/");
    } catch {
      setError("שגיאה בכניסה, נסה שוב.");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-800 to-gray-950 flex items-center justify-center">
        <div className="text-white text-lg">מתחבר עם Google...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-800 to-gray-950 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-gray-700 font-medium">{error}</p>
          <button
            onClick={() => { setError(null); setSoldiers(null); getPublicSoldiers().then(setSoldiers).catch(() => setError("לא ניתן להתחבר לשרת.")); }}
            className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg text-sm cursor-pointer"
          >
            חזור לכניסה
          </button>
        </div>
      </div>
    );
  }

  if (soldiers === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-800 to-gray-950 flex items-center justify-center">
        <div className="text-white text-lg">טוען...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-800 to-gray-950 flex items-center justify-center p-4">
      <LoginSelector soldiers={soldiers} onLogin={handleLogin} />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-800 to-gray-950 flex items-center justify-center">
        <div className="text-white text-lg">טוען...</div>
      </div>
    }>
      <LoginPageInner />
    </Suspense>
  );
}

const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400";
