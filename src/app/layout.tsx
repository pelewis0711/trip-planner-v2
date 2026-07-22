import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/Header";
import AuthSync from "@/components/AuthSync";
import CustomTripsSync from "@/components/CustomTripsSync";
import RegisterServiceWorker from "@/components/RegisterServiceWorker";
import InstallPrompt from "@/components/InstallPrompt";
import FoodFixNotice from "@/components/FoodFixNotice";
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
  title: "Trip Planner v2",
  description: "Study-abroad semester travel planner — Spring 2027, Prague.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Trip Planner",
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
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-zinc-950 text-zinc-100">
        <RegisterServiceWorker />
        <AuthSync />
        <CustomTripsSync />
        <Header />
        <InstallPrompt />
        <FoodFixNotice />
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
