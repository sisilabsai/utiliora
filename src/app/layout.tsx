import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://utiliora.com"),
  applicationName: "Utiliora",
  title: {
    default: "Utiliora | Simple Tools. Instant Results.",
    template: "%s | Utiliora",
  },
  description:
    "Global utility platform for calculators, converters, SEO tools, image tools, developer utilities, and productivity workflows.",
  keywords: [
    "utility tools",
    "online calculators",
    "unit converters",
    "seo tools",
    "developer tools",
    "image tools",
  ],
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    title: "Utiliora",
    description: "Simple tools. Instant results.",
    url: "https://utiliora.com",
    siteName: "Utiliora",
  },
  twitter: {
    card: "summary_large_image",
    title: "Utiliora",
    description: "Simple tools. Instant results.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <a className="skip-link" href="#content">
          Skip to content
        </a>
        <SiteHeader />
        <main id="content" className="site-main">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
