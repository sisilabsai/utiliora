"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";

const ADSENSE_SRC = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8247984832507820";

export function AdSenseScript() {
  const pathname = usePathname();

  if (pathname?.startsWith("/admin")) {
    return null;
  }

  return <Script id="adsense-loader" src={ADSENSE_SRC} strategy="afterInteractive" crossOrigin="anonymous" />;
}
