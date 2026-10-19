import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces, Geist_Mono } from "next/font/google";
import AppChrome from "@/components/AppChrome";
import Footer from "@/components/Footer";
import AuthSync from "@/components/AuthSync";
import RegisterServiceWorker from "@/components/RegisterServiceWorker";
import "./globals.css";

// clean, friendly sans for body text, forms and dense tables (Phase 24)
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// serif display face for the WhereNext wordmark and headings (Phase 24) --
// the "travel journal" half of the look; body text stays on DM Sans.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "WhereNext",
  description: "Plan your study-abroad semester of travel — budgets, calendar, and bookings in one place.",
  // noindex placeholder: to hide the app from Google, add
  // `robots: { index: false, follow: false }` here (and a matching
  // app/robots.ts). Not set -- the app is intentionally public/indexable
  // right now.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "WhereNext",
  },
};

export const viewport: Viewport = {
  themeColor: "#f6f3ec",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-bg text-ink">
        <RegisterServiceWorker />
        <AuthSync />
        <AppChrome />
        <main className="flex flex-1 flex-col">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
