import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ID Clash — معركة الهويات السرية",
  description:
    "لعبة استنتاج ثنائية 1 ضد 1 في الوقت الفعلي: اختاروا هويات سرية، تبادلا الأسئلة، واستخدما بطاقات القوة لتخمين هوية الخصم قبل انتهاء الوقت.",
  keywords: ["ID Clash", "لعبة تخمين", "1 ضد 1", "realtime game", "deduction game"],
  authors: [{ name: "ID Clash" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {/* Cairo (Arabic-first typography) loaded at runtime, no build-time fetch. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- single-page App Router game; runtime font is app-wide */}
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
