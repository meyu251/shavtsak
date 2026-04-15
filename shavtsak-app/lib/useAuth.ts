"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Soldier } from "./types";

const TOKEN_KEY = "shavtsak_token";
const USER_KEY = "shavtsak_current_user";

/** שמירת token + soldier אחרי login */
export function saveSession(token: string, soldier: Soldier) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(soldier));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
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
