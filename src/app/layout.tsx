import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { siteUrl } from "@/lib/site";
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
  metadataBase: siteUrl,
  title: {
    default: "Gesture Player — Control music with hand gestures",
    template: "%s | Gesture Player",
  },
  description: "Control Spotify playback with simple hand gestures. Your camera stays on your device; hand tracking runs locally in your browser.",
  applicationName: "Gesture Player",
  category: "music",
  keywords: ["gesture music control", "Spotify controller", "hand gesture music player", "camera gesture control"],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Gesture Player",
    title: "Gesture Player — Control music with hand gestures",
    description: "A quieter way to control Spotify. Use hand gestures while camera processing stays local to your browser.",
    locale: "en_US",
    images: [{
      url: "/opengraph-image",
      width: 1200,
      height: 630,
      alt: "Gesture Player — Direct the room. Hands become the interface.",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Gesture Player — Control music with hand gestures",
    description: "Control Spotify with hand gestures. Camera processing stays local to your browser.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: process.env.VERCEL_ENV !== "preview",
    follow: process.env.VERCEL_ENV !== "preview",
    googleBot: {
      index: process.env.VERCEL_ENV !== "preview",
      follow: process.env.VERCEL_ENV !== "preview",
    },
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
