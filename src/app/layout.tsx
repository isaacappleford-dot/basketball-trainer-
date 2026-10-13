import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: { default: "CENTER PERFORMANCE", template: "%s · CENTER PERFORMANCE" },
  description: "Basketball center training tracker — strength, speed, conditioning, post skills and recovery.",
  applicationName: "CENTER PERFORMANCE",
  appleWebApp: { capable: true, title: "CENTER PERFORMANCE", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f1012",
};

// Applies the saved theme before first paint to avoid a flash.
const themeScript = `(function(){try{var s=JSON.parse(localStorage.getItem("center-performance:v1")||"null");var t=s&&s.profile&&s.profile.theme||"dark";if(t==="system"){t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}document.documentElement.dataset.theme=t}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
