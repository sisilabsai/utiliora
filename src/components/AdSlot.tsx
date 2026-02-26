"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

interface AdSlotProps {
  label?: string;
  slot?: string;
}

const ADSENSE_CLIENT = "ca-pub-8247984832507820";
const DEFAULT_AD_SLOT = "1438543745";

export function AdSlot({ label = "Advertisement", slot = DEFAULT_AD_SLOT }: AdSlotProps) {
  const adRef = useRef<HTMLModElement | null>(null);

  useEffect(() => {
    const adElement = adRef.current;
    if (!adElement) return;
    if (adElement.getAttribute("data-adsbygoogle-status")) return;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("AdSense push failed for slot", slot, error);
      }
    }
  }, [slot]);

  return (
    <aside className="ad-slot" aria-label={label}>
      <p>{label}</p>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
