import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastContainer } from "@/components/Toast";

export const metadata: Metadata = {
  title: "שבצק - מערכת שיבוץ כוחות",
  description: "מערכת ניהול שיבוץ משימות לפלוגה",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "שבצק",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#6d28d9",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className="h-full">
      <body className="min-h-full bg-gray-50 antialiased">
        {children}
        <ToastContainer />
      </body>
    </html>
  );
}
