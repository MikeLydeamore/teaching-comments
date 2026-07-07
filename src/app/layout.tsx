import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quick Write Tool",
  description: "A formative writing feedback prototype for large classes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
