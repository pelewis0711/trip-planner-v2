import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Poppins } from "next/font/google";
import Header from "@/components/Header";
import AuthSync from "@/components/AuthSync";
import CustomTripsSync from "@/components/CustomTripsSync";
import RegisterServiceWorker from "@/components/RegisterServiceWorker";
import InstallPrompt from "@/components/InstallPrompt";
import FoodFixNotice from "@/components/FoodFixNotice";
import LocalSetupBanner from "@/components/onboarding/LocalSetupBanner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// bold, friendly display font for headings/card titles -- the "playful
// college" half of the visual direction; body text stays on Geist Sans for
// legibility in dense screens (tables, forms).
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Semesterly",
  description: "Plan your study-abroad semester of travel — budgets, calendar, and bookings in one place.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Semesterly",
  },
};

export const viewport: Viewport = {
  themeColor: "#faf9fc",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${poppins.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-bg text-ink">
        <RegisterServiceWorker />
        <AuthSync />
        <CustomTripsSync />
        <Header />
        <InstallPrompt />
        <FoodFixNotice />
        <LocalSetupBanner />
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
