"use client";

import type { AffiliateOffer } from "@/lib/types";
import { useLocale } from "@/components/LocaleProvider";

interface AffiliateCardProps {
  offer: AffiliateOffer;
}

export function AffiliateCard({ offer }: AffiliateCardProps) {
  const { t } = useLocale();
  const headline = offer.headline ?? t("affiliate.headline_default", undefined, "Recommended upgrade");
  const ctaLabel = offer.ctaLabel ?? `${t("affiliate.cta_prefix", undefined, "Try")} ${offer.label}`;
  const ariaLabel = t("affiliate.kicker", undefined, "Sponsored recommendation");

  return (
    <aside className="affiliate-card" aria-label={ariaLabel}>
      <p className="affiliate-kicker">{ariaLabel}</p>
      <h2>{headline}</h2>
      <p>{offer.description}</p>
      <a href={offer.url} target="_blank" rel="noopener noreferrer nofollow sponsored">
        {ctaLabel}
      </a>
    </aside>
  );
}
