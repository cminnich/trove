import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BottomTabBar } from "@/app/components/Navigation/BottomTabBar";
import { DesktopNav } from "@/app/components/Navigation/DesktopNav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Trove - Personal Knowledge Graph",
  description: "Your collections, AI-ready",
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
      </body>
    </html>
  );
}
