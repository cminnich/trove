import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BottomTabBar } from "@/app/components/Navigation/BottomTabBar";
import { DesktopNav } from "@/app/components/Navigation/DesktopNav";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#6366f1",
};

export const metadata: Metadata = {
  title: "Trove - Personal Knowledge Graph",
  description: "Your collections, AI-ready",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Trove",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <DesktopNav />
        <main className="pb-20 md:pb-0">{children}</main>
        <BottomTabBar />
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
