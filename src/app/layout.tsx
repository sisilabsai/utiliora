import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import { AccessibilityFab } from "@/components/AccessibilityFab";
import { AdSenseScript } from "@/components/AdSenseScript";
import { LocaleProvider } from "@/components/LocaleProvider";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { DEFAULT_LOCALE, LOCALE_COOKIE_KEY, LOCALE_STORAGE_KEY, SUPPORTED_LOCALES } from "@/lib/i18n";

const GA_MEASUREMENT_ID = "G-1KYZN51H12";

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

const accessibilityBootScript = `
(() => {
  try {
    const key = "utiliora-accessibility-v1";
    const root = document.documentElement;
    const raw = localStorage.getItem(key);
    const fallbackTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

    if (!raw) {
      root.dataset.theme = fallbackTheme;
      return;
    }

    const parsed = JSON.parse(raw);
    root.dataset.theme = parsed?.theme === "dark" || parsed?.theme === "light" ? parsed.theme : fallbackTheme;

    const fontScale = Number(parsed?.fontScale);
    if (Number.isFinite(fontScale)) {
      const clamped = Math.max(0.9, Math.min(1.25, fontScale));
      root.style.setProperty("--font-scale", clamped.toFixed(2));
    }

    if (parsed?.lineSpacing) root.classList.add("a11y-line-spacing");
    if (parsed?.reduceMotion) root.classList.add("a11y-reduce-motion");
    if (parsed?.highContrast) root.classList.add("a11y-high-contrast");
    if (parsed?.highlightLinks) root.classList.add("a11y-highlight-links");
    if (parsed?.readableFont) root.classList.add("a11y-readable-font");
  } catch {
    const root = document.documentElement;
    root.dataset.theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
})();
`;

const googleAnalyticsBootScript = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}');
`;

const localeBootScript = `
(() => {
  try {
    const supported = ${JSON.stringify([...SUPPORTED_LOCALES])};
    const storageKey = '${LOCALE_STORAGE_KEY}';
    const cookieKey = '${LOCALE_COOKIE_KEY}';
    const fallback = '${DEFAULT_LOCALE}';

    const normalize = (value) => {
      if (!value || typeof value !== 'string') return null;
      const lowered = value.toLowerCase().replace(/_/g, '-');
      if (supported.includes(lowered)) return lowered;
      const base = lowered.split('-')[0];
      return supported.includes(base) ? base : null;
    };

    let fromStorage = null;
    try {
      fromStorage = window.localStorage.getItem(storageKey);
    } catch {}

    const cookieMatch = document.cookie.match(new RegExp('(?:^|; )' + cookieKey + '=([^;]+)'));
    const fromCookie = cookieMatch && cookieMatch[1] ? decodeURIComponent(cookieMatch[1]) : null;

    const locale =
      normalize(fromStorage) ||
      normalize(fromCookie) ||
      normalize(navigator.language) ||
      (Array.isArray(navigator.languages) ? navigator.languages.map(normalize).find(Boolean) : null) ||
      fallback;

    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    window.__UTILIORA_LOCALE__ = locale;
  } catch {
    document.documentElement.lang = '${DEFAULT_LOCALE}';
    document.documentElement.dir = 'ltr';
    window.__UTILIORA_LOCALE__ = '${DEFAULT_LOCALE}';
  }
})();
`;

export const metadata: Metadata = {
  metadataBase: new URL("https://utiliora.cloud"),
  applicationName: "Utiliora",
  manifest: "/manifest.webmanifest",
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
  icons: {
    icon: [
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-48x48.png", sizes: "48x48", type: "image/png" },
    ],
    shortcut: [{ url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Utiliora",
    statusBarStyle: "default",
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
    url: "https://utiliora.cloud",
    siteName: "Utiliora",
    images: [
      {
        url: "/icons/icon-512.png",
        width: 512,
        height: 512,
        alt: "Utiliora logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Utiliora",
    description: "Simple tools. Instant results.",
  },
};

export const viewport: Viewport = {
  themeColor: "#174f86",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <Script id="locale-boot" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: localeBootScript }} />
        <Script id="accessibility-boot" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: accessibilityBootScript }} />
        <AdSenseScript />
        <Script id="ga-loader" src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
        <Script id="ga-boot" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: googleAnalyticsBootScript }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <LocaleProvider>
          <a className="skip-link" href="#content">
            Skip to content
          </a>
          <SiteHeader />
          <main id="content" className="site-main">
            {children}
          </main>
          <PwaInstallPrompt />
          <AccessibilityFab />
          <SiteFooter />
        </LocaleProvider>
      </body>
    </html>
  );
}
