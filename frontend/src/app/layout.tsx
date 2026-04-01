import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI小博士",
  description: "AI 智能对话",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-dvh overflow-hidden">
      <body
        className={`${geistSans.variable} ${geistMono.variable} h-dvh min-h-0 overflow-hidden font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

