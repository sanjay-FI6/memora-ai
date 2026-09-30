import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Memora AI - AI-Driven Learning & Error Analysis Workspace",
  description: "Identify syntax and logic flaws, create semantic error clusters, explore dynamic knowledge maps, and build tailored learning paths with Memora AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body className="antialiased bg-[#0F172A] text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
