import type { Metadata } from "next";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { THEME_FAVICON_PATHS } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ed.ie",
  description: "A classroom helper for questions, responses, and live check-ins.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <link
          id="edie-favicon"
          rel="icon"
          type="image/svg+xml"
          href={THEME_FAVICON_PATHS.default}
        />
        <Script
          id="edie-theme-script"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
try {
  var theme = window.localStorage.getItem("edie_theme");
  var faviconPaths = ${JSON.stringify(THEME_FAVICON_PATHS)};
  if (theme && faviconPaths[theme]) {
    document.getElementById("edie-favicon").href = faviconPaths[theme];
  }
  if (theme && theme !== "default" && faviconPaths[theme]) {
    document.documentElement.dataset.edieTheme = theme;
    document.documentElement.style.colorScheme =
      theme === "darkly" || theme === "midnight" ? "dark" : "light";
  }
} catch {}
            `.trim(),
          }}
        />
      </head>
      <body className="min-h-full">
        {children}
        <Analytics />
        <SpeedInsights/>
      </body>
    </html>
  );
}
