import type { Metadata } from "next";
import Script from "next/script";
import { ThemeSelector } from "@/components/ThemeSelector";
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
        <Script
          id="qwt-theme-script"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
try {
  var theme = window.localStorage.getItem("qwt_theme");
  if (theme && theme !== "default") {
    document.documentElement.dataset.qwtTheme = theme;
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
        <ThemeSelector />
      </body>
    </html>
  );
}
