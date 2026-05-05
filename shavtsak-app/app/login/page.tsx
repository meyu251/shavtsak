"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  getMe, getGoogleLoginUrl, claimSoldier,
  passwordLogin, register as apiRegister, setPassword as apiSetPassword, useResetCode,
} from "@/lib/api";
import { saveSession } from "@/lib/useAuth";
import { Soldier } from "@/lib/types";

// ── Google button ─────────────────────────────────────────────────────────────

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

// ── Password login form ───────────────────────────────────────────────────────

function PasswordLoginForm({ onSuccess, onForgot, onError }: {
  onSuccess: (token: string, soldier: Soldier) => void;
  onForgot: () => void;
  onError: (msg: string) => void;
}) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim() || !password) return;
    setSubmitting(true);
    setLocalError(null);
    try {
      const { access_token, soldier } = await passwordLogin(identifier.trim(), password);
      onSuccess(access_token, { ...soldier, hasPassword: true });
    } catch (e: unknown) {
      setLocalError(e instanceof Error ? e.message : "שגיאה בכניסה");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">מספר אישי או תעודת זהות</label>
        <input
          type="text"
          dir="ltr"
          value={identifier}
          onChange={e => setIdentifier(e.target.value)}
          placeholder="1234567"
          className={inputCls}
          autoComplete="username"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">סיסמא</label>
        <div className="relative">
          <input
            type={showPw ? "text" : "password"}
            value={password}
            onChange={e => setPassword(e.target.value)}
            className={inputCls}
            autoComplete="current-password"
          />
          <button type="button" onClick={() => setShowPw(v => !v)}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 cursor-pointer">
            {showPw ? "הסתר" : "הצג"}
          </button>
        </div>
      </div>
      {localError && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2 text-center">{localError}</p>}
      <button
        type="submit"
        disabled={submitting || !identifier.trim() || !password}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-xl py-2.5 transition-colors cursor-pointer"
      >
        {submitting ? "מתחבר..." : "כניסה"}
      </button>
      <button
        type="button"
        onClick={onForgot}
        className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
      >
        שכחתי סיסמא
      </button>
    </form>
  );
}

// ── Register form ─────────────────────────────────────────────────────────────

function RegisterForm({ onSuccess, onBack }: {
  onSuccess: (token: string, soldier: Soldier) => void;
  onBack: () => void;
}) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { setLocalError("סיסמא חייבת להכיל לפחות 6 תווים"); return; }
    if (password !== confirm) { setLocalError("הסיסמאות אינן תואמות"); return; }
    setSubmitting(true);
    setLocalError(null);
    try {
      const { access_token, soldier } = await apiRegister(identifier.trim(), password);
      onSuccess(access_token, { ...soldier, hasPassword: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "שגיאה";
      if (msg.includes("כבר קיים")) {
        setLocalError("חשבון כבר קיים — עבור לכניסה או השתמש ב\"שכחתי סיסמא\"");
      } else if (msg.includes("לא נמצא")) {
        setLocalError("לא נמצא חייל עם המספר שהוזן. בדוק שוב או פנה למפקד.");
      } else {
        setLocalError(msg);
      }
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">מספר אישי או תעודת זהות</label>
        <input type="text" dir="ltr" value={identifier}
          onChange={e => setIdentifier(e.target.value)}
          placeholder="1234567" className={inputCls} autoComplete="username" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">סיסמא חדשה</label>
        <div className="relative">
          <input type={showPw ? "text" : "password"} value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="לפחות 6 תווים" className={inputCls} autoComplete="new-password" />
          <button type="button" onClick={() => setShowPw(v => !v)}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 cursor-pointer">
            {showPw ? "הסתר" : "הצג"}
          </button>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">אימות סיסמא</label>
        <div className="relative">
          <input type={showPw ? "text" : "password"} value={confirm}
            onChange={e => setConfirm(e.target.value)}
            className={inputCls} autoComplete="new-password" />
        </div>
      </div>
      {localError && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2 text-center">{localError}</p>}
      <button type="submit" disabled={submitting || !identifier.trim() || !password || !confirm}
        className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium rounded-xl py-2.5 transition-colors cursor-pointer">
        {submitting ? "יוצר חשבון..." : "צור חשבון"}
      </button>
      <button type="button" onClick={onBack}
        className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">
        ← חזרה לכניסה
      </button>
    </form>
  );
}

// ── Claim form ────────────────────────────────────────────────────────────────

function ClaimForm({ userId, onSuccess, onError }: {
  userId: string;
  onSuccess: (token: string, soldier: Soldier) => void;
  onError: (msg: string) => void;
}) {
  const [personalNumber, setPersonalNumber] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!personalNumber.trim() && !idNumber.trim()) {
      setLocalError("יש למלא לפחות מספר אישי או תעודת זהות.");
      return;
    }
    setSubmitting(true);
    setLocalError(null);
    try {
      const { access_token, soldier } = await claimSoldier(
        userId,
        personalNumber.trim() || undefined,
        idNumber.trim() || undefined,
      );
      onSuccess(access_token, soldier);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "שגיאה";
      if (msg.includes("כבר מקושר")) {
        setLocalError("המספר כבר מקושר למשתמש אחר — פנה למפקד.");
      } else if (msg.includes("לא נמצא")) {
        setLocalError("לא נמצא חייל עם הפרטים שהזנת. בדוק שוב או פנה למפקד.");
      } else {
        onError(msg);
      }
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-600 text-center">
        הזן את הפרטים שלך לקישור החשבון:
      </p>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">מספר אישי</label>
        <input type="text" dir="ltr" value={personalNumber}
          onChange={e => setPersonalNumber(e.target.value)}
          placeholder="לדוגמה: 1234567" className={inputCls} />
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400">או</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">תעודת זהות</label>
        <input type="text" dir="ltr" value={idNumber}
          onChange={e => setIdNumber(e.target.value)}
          placeholder="לדוגמה: 123456789" className={inputCls} />
      </div>
      {localError && <p className="text-red-600 text-sm text-center bg-red-50 rounded-lg px-3 py-2">{localError}</p>}
      <button type="submit" disabled={submitting}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-xl py-2.5 transition-colors cursor-pointer">
        {submitting ? "מאמת..." : "המשך"}
      </button>
    </form>
  );
}

// ── Set password form ─────────────────────────────────────────────────────────

function SetPasswordForm({ token, soldier, onSuccess }: {
  token: string;
  soldier: Soldier;
  onSuccess: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { setLocalError("סיסמא חייבת להכיל לפחות 6 תווים"); return; }
    if (password !== confirm) { setLocalError("הסיסמאות אינן תואמות"); return; }
    setSubmitting(true);
    setLocalError(null);
    try {
      // set token in localStorage so the API call is authenticated
      localStorage.setItem("shavtsak_token", token);
      await apiSetPassword(password);
      // only save full session after password is confirmed saved in DB
      saveSession(token, soldier);
      onSuccess();
    } catch (e: unknown) {
      localStorage.removeItem("shavtsak_token");
      setLocalError(e instanceof Error ? e.message : "שגיאה בשמירת הסיסמא. בדוק שהשרת פועל ונסה שוב.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-600 text-center">
        בחר סיסמא לכניסות הבאות:
      </p>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">סיסמא חדשה</label>
        <div className="relative">
          <input type={showPw ? "text" : "password"} value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="לפחות 6 תווים" className={inputCls} autoComplete="new-password" />
          <button type="button" onClick={() => setShowPw(v => !v)}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 cursor-pointer">
            {showPw ? "הסתר" : "הצג"}
          </button>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">אימות סיסמא</label>
        <div className="relative">
          <input type={showPw ? "text" : "password"} value={confirm}
            onChange={e => setConfirm(e.target.value)}
            className={inputCls} autoComplete="new-password" />
        </div>
      </div>
      {localError && <p className="text-red-600 text-sm text-center bg-red-50 rounded-lg px-3 py-2">{localError}</p>}
      <button type="submit" disabled={submitting || !password || !confirm}
        className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium rounded-xl py-2.5 transition-colors cursor-pointer">
        {submitting ? "שומר..." : "שמור סיסמא וכנס"}
      </button>
    </form>
  );
}

// ── Forgot password form ──────────────────────────────────────────────────────

function ForgotPasswordForm({ onBack, onSuccess, onError }: {
  onBack: () => void;
  onSuccess: (token: string, soldier: Soldier) => void;
  onError: (msg: string) => void;
}) {
  const [step, setStep] = useState<"enter" | "code">("enter");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleUseCode(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) { setLocalError("סיסמא חייבת להכיל לפחות 6 תווים"); return; }
    if (newPassword !== confirm) { setLocalError("הסיסמאות אינן תואמות"); return; }
    setSubmitting(true);
    setLocalError(null);
    try {
      const { access_token, soldier } = await useResetCode(identifier.trim(), code.trim(), newPassword);
      onSuccess(access_token, soldier);
    } catch (e: unknown) {
      setLocalError(e instanceof Error ? e.message : "שגיאה");
      setSubmitting(false);
    }
  }

  if (step === "enter") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600 text-center">
          פנה למפקד הישיר שלך ובקש קוד איפוס סיסמא.
          לאחר קבלת הקוד, הזן אותו כאן:
        </p>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">מספר אישי או תעודת זהות</label>
          <input type="text" dir="ltr" value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            placeholder="1234567" className={inputCls} />
        </div>
        <button
          onClick={() => { if (identifier.trim()) setStep("code"); }}
          disabled={!identifier.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-xl py-2.5 transition-colors cursor-pointer"
        >
          יש לי קוד
        </button>
        <button onClick={onBack}
          className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">
          ← חזרה
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleUseCode} className="space-y-4">
      <p className="text-sm text-gray-600 text-center">הזן את הקוד שקיבלת מהמפקד:</p>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">קוד 6 ספרות</label>
        <input type="text" dir="ltr" value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="123456" maxLength={6} className={inputCls} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">סיסמא חדשה</label>
        <div className="relative">
          <input type={showPw ? "text" : "password"} value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="לפחות 6 תווים" className={inputCls} autoComplete="new-password" />
          <button type="button" onClick={() => setShowPw(v => !v)}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 cursor-pointer">
            {showPw ? "הסתר" : "הצג"}
          </button>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">אימות סיסמא</label>
        <div className="relative">
          <input type={showPw ? "text" : "password"} value={confirm}
            onChange={e => setConfirm(e.target.value)}
            className={inputCls} autoComplete="new-password" />
        </div>
      </div>
      {localError && <p className="text-red-600 text-sm text-center bg-red-50 rounded-lg px-3 py-2">{localError}</p>}
      <button type="submit" disabled={submitting || !code || !newPassword || !confirm}
        className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium rounded-xl py-2.5 transition-colors cursor-pointer">
        {submitting ? "מאמת..." : "שמור סיסמא חדשה"}
      </button>
      <button type="button" onClick={() => setStep("enter")}
        className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">
        ← חזרה
      </button>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type PageMode =
  | "loading"
  | "login"
  | "register"
  | "claim"
  | "set-password"
  | "forgot"
  | "error";

interface PageState {
  mode: PageMode;
  pendingToken?: string;
  pendingSoldier?: Soldier;
  claimUserId?: string;
  errorMessage?: string;
}

function LoginPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [state, setState] = useState<PageState>({ mode: "loading" });

  useEffect(() => {
    const token  = params.get("token");
    const err    = params.get("error");
    const step   = params.get("step");
    const userId = params.get("userId");

    if (token) {
      localStorage.setItem("shavtsak_token", token);
      getMe()
        .then(soldier => {
          if (!soldier.hasPassword) {
            setState({ mode: "set-password", pendingToken: token, pendingSoldier: soldier });
          } else {
            saveSession(token, soldier);
            router.push("/");
          }
        })
        .catch(() => {
          localStorage.removeItem("shavtsak_token");
          setState({ mode: "error", errorMessage: "שגיאה בקבלת פרטי המשתמש. נסה שוב." });
        });
      return;
    }

    if (step === "claim" && userId) {
      setState({ mode: "claim", claimUserId: userId });
      return;
    }

    if (err && err !== "google_cancelled") {
      setState({ mode: "error", errorMessage: "שגיאה בכניסה עם Google. נסה שוב." });
      return;
    }

    setState({ mode: "login" });
  }, [params, router]);

  function handleLoginSuccess(token: string, soldier: Soldier) {
    if (!soldier.hasPassword) {
      setState({ mode: "set-password", pendingToken: token, pendingSoldier: soldier });
    } else {
      saveSession(token, soldier);
      router.push("/");
    }
  }

  function handleSetPasswordDone() {
    if (state.pendingSoldier) {
      // session already saved in SetPasswordForm before calling setPassword
      router.push("/");
    }
  }

  const wrapper = (title: string, children: React.ReactNode) => (
    <div className="min-h-screen bg-gradient-to-br from-gray-800 to-gray-950 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="bg-gray-900 text-white px-6 py-5 text-center">
          <div className="text-4xl mb-2">🪖</div>
          <h1 className="text-xl font-bold">שבצק</h1>
          <p className="text-gray-400 text-sm mt-0.5">{title}</p>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );

  if (state.mode === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-800 to-gray-950 flex items-center justify-center">
        <div className="text-white text-lg">טוען...</div>
      </div>
    );
  }

  if (state.mode === "error") {
    return wrapper("שגיאה",
      <div className="text-center space-y-4">
        <div className="text-4xl">⚠️</div>
        <p className="text-gray-700 font-medium">{state.errorMessage}</p>
        <button onClick={() => setState({ mode: "login" })}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm cursor-pointer">
          חזור לכניסה
        </button>
      </div>
    );
  }

  if (state.mode === "claim" && state.claimUserId) {
    return wrapper("קישור חשבון Google לחייל",
      <ClaimForm
        userId={state.claimUserId}
        onSuccess={(token, soldier) => handleLoginSuccess(token, soldier)}
        onError={msg => setState({ mode: "error", errorMessage: msg })}
      />
    );
  }

  if (state.mode === "set-password" && state.pendingToken && state.pendingSoldier) {
    return wrapper("בחירת סיסמא",
      <SetPasswordForm
        token={state.pendingToken}
        soldier={state.pendingSoldier}
        onSuccess={handleSetPasswordDone}
      />
    );
  }

  if (state.mode === "register") {
    return wrapper("הרשמה",
      <RegisterForm
        onSuccess={handleLoginSuccess}
        onBack={() => setState({ mode: "login" })}
      />
    );
  }

  if (state.mode === "forgot") {
    return wrapper("איפוס סיסמא",
      <ForgotPasswordForm
        onBack={() => setState({ mode: "login" })}
        onSuccess={(token, soldier) => handleLoginSuccess(token, soldier)}
        onError={msg => setState({ mode: "error", errorMessage: msg })}
      />
    );
  }

  // Default: login
  return wrapper("מערכת שיבוץ כוחות ומשימות",
    <div className="space-y-4">
      <GoogleButton />
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400">או</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>
      <PasswordLoginForm
        onSuccess={handleLoginSuccess}
        onForgot={() => setState({ mode: "forgot" })}
        onError={msg => setState({ mode: "error", errorMessage: msg })}
      />
      <div className="border-t border-gray-100 pt-3 text-center">
        <span className="text-xs text-gray-400">פעם ראשונה? </span>
        <button
          onClick={() => setState({ mode: "register" })}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
        >
          צור חשבון
        </button>
      </div>
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
