import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "שבצק - מערכת שיבוץ כוחות",
  description: "מערכת ניהול שיבוץ משימות לפלוגה",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className="h-full">
      <body className="min-h-full bg-gray-50 antialiased">{children}</body>
    </html>
  );
}
