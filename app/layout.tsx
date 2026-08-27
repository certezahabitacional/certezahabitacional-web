import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import OfflineStatus from "@/components/offline/OfflineStatus";
import ServiceWorkerRegister from "@/components/offline/ServiceWorkerRegister";

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
  title: {
    default: "Certeza Habitacional",
    template: "%s | Certeza Habitacional",
  },
  description:
    "Plataforma de inspección, seguimiento y certeza habitacional.",
  applicationName: "Certeza Habitacional",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      {
        url: "/branding/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/branding/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/branding/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#020617",
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegister />
        <OfflineStatus />
        {children}
      </body>
    </html>
  );
}
