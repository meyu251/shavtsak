"use client";

import { useEffect, useState } from "react";

export type ToastType = "error" | "success";

export interface ToastMessage {
  id: number;
  text: string;
  type: ToastType;
}

let _nextId = 1;
let _setToasts: React.Dispatch<React.SetStateAction<ToastMessage[]>> | null = null;

/** קריאה גלובלית להצגת toast — משתמשים מכל מקום */
export function showToast(text: string, type: ToastType = "error") {
  _setToasts?.((prev) => [...prev, { id: _nextId++, text, type }]);
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    _setToasts = setToasts;
    return () => { _setToasts = null; };
  }, []);

  function dismiss(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  useEffect(() => {
    if (!toasts.length) return;
    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 4000);
    return () => clearTimeout(timer);
  }, [toasts]);

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-sm px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium cursor-pointer select-none ${
            t.type === "error"
              ? "bg-red-600 text-white"
              : "bg-green-600 text-white"
          }`}
        >
          <span className="flex-1">{t.text}</span>
          <span className="opacity-70 text-xs">✕</span>
        </div>
      ))}
    </div>
  );
}
