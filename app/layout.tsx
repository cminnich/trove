import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { NavigationWrapper } from "@/app/components/Navigation/NavigationWrapper";
import { MainContent } from "@/app/components/Navigation/MainContent";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#050505",
};

export const metadata: Metadata = {
  title: "Open Trove - Community Library for Enthusiasts",
  description: "The community-owned library of gear, collections, and enthusiast knowledge. Public by default. Open source. Exportable forever.",
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
    <html lang="en" className="dark">
      <body className={`${inter.className} ${jetbrainsMono.variable}`}>
        <NavigationWrapper />
        <MainContent>{children}</MainContent>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
