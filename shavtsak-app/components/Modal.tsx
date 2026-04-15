"use client";

import { useEffect } from "react";

/** מודאל גנרי — סגירה ב-Escape ולחיצה מחוץ לתוכן */
export function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto relative"
      >
        <button
          aria-label="סגור"
          onClick={onClose}
          className="absolute top-3 left-3 text-gray-500 hover:text-gray-700 cursor-pointer"
        >
          ✖
        </button>
        {children}
      </div>
    </div>
  );
}
