import type { NextConfig } from "next";

// כתובת השרת (Render בפרודקשן). משמשת גם ל-rewrite של חזרת Google למטה.
const apiOrigin = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.93.115.198"],
  async rewrites() {
    return [
      // Google מחזיר את המשתמש לכתובת של האתר (ולכן בחלון של Google מופיע שם האתר
      // ולא כתובת השרת ב-Render). Vercel מעביר את הבקשה כמו שהיא לשרת.
      {
        source: "/auth/google/callback",
        destination: `${apiOrigin}/auth/google/callback`,
      },
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/:path*",
      },
    ];
  },
};

export default nextConfig;
