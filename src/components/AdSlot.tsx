"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "@/components/LocaleProvider";

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
  const { t } = useLocale();
  const adRef = useRef<HTMLModElement | null>(null);
  const requestedRef = useRef(false);
  const resolvedLabel = label === "Advertisement" ? t("ad.label", undefined, label) : label;

  useEffect(() => {
    const adElement = adRef.current;
    if (!adElement) return;
    if (requestedRef.current) return;
    if (adElement.getAttribute("data-adsbygoogle-status")) {
      requestedRef.current = true;
      return;
    }

    const requestAd = () => {
      const currentElement = adRef.current;
      if (!currentElement || !currentElement.isConnected) return;
      if (currentElement.getAttribute("data-adsbygoogle-status")) {
        requestedRef.current = true;
        return;
      }

      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        requestedRef.current = true;
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("AdSense push failed for slot", slot, error);
        }
      }
    };

    const rafId = window.requestAnimationFrame(requestAd);
    return () => window.cancelAnimationFrame(rafId);
  }, [slot]);

  return (
    <aside className="ad-slot" aria-label={resolvedLabel}>
      <p>{resolvedLabel}</p>
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
