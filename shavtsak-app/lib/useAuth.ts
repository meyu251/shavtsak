"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Soldier } from "./types";

const TOKEN_KEY = "shavtsak_token";
const USER_KEY = "shavtsak_current_user";
const ORIGINAL_TOKEN_KEY = "shavtsak_original_token";
const ORIGINAL_USER_KEY = "shavtsak_original_user";

/** שמירת token + soldier אחרי login */
export function saveSession(token: string, soldier: Soldier) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(soldier));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(ORIGINAL_TOKEN_KEY);
  localStorage.removeItem(ORIGINAL_USER_KEY);
}

export function startImpersonation(token: string, soldier: Soldier) {
  const currentToken = localStorage.getItem(TOKEN_KEY);
  const currentUser = localStorage.getItem(USER_KEY);
  if (currentToken) localStorage.setItem(ORIGINAL_TOKEN_KEY, currentToken);
  if (currentUser) localStorage.setItem(ORIGINAL_USER_KEY, currentUser);
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(soldier));
}

export function stopImpersonation() {
  const originalToken = localStorage.getItem(ORIGINAL_TOKEN_KEY);
  const originalUser = localStorage.getItem(ORIGINAL_USER_KEY);
  if (originalToken) localStorage.setItem(TOKEN_KEY, originalToken);
  if (originalUser) localStorage.setItem(USER_KEY, originalUser);
  localStorage.removeItem(ORIGINAL_TOKEN_KEY);
  localStorage.removeItem(ORIGINAL_USER_KEY);
}

export function getImpersonationOriginal(): Soldier | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(ORIGINAL_USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as Soldier; } catch { return null; }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function useAuth() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<Soldier | null | undefined>(undefined);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      router.replace("/login");
      return;
    }
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) {
      router.replace("/login");
      return;
    }
    try {
      setCurrentUser(JSON.parse(raw) as Soldier);
    } catch {
      router.replace("/login");
    }
  }, [router]);

  function logout() {
    clearSession();
    router.push("/login");
  }

  return { currentUser, logout };
}
