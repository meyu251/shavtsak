"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Soldier } from "./types";
import { loadData, loadCurrentUser, saveCurrentUser } from "./store";

export function useAuth() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<Soldier | null | undefined>(undefined);

  useEffect(() => {
    const cu = loadCurrentUser();
    if (!cu) {
      router.replace("/login");
      return;
    }
    const data = loadData();
    const soldier = data.soldiers.find(s => s.id === cu.soldierId);
    if (!soldier) {
      router.replace("/login");
      return;
    }
    setCurrentUser(soldier);
  }, [router]);

  function logout() {
    saveCurrentUser({ soldierId: '' });
    localStorage.removeItem('shavtsak_current_user');
    router.push("/login");
  }

  return { currentUser, logout };
}
