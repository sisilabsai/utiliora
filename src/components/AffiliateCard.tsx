import type { AffiliateOffer } from "@/lib/types";

interface AffiliateCardProps {
  offer: AffiliateOffer;
}

export function AffiliateCard({ offer }: AffiliateCardProps) {
  const headline = offer.headline ?? "Recommended upgrade";
  const ctaLabel = offer.ctaLabel ?? `Try ${offer.label}`;

  return (
    <aside className="affiliate-card" aria-label="Sponsored recommendation">
      <p className="affiliate-kicker">Sponsored recommendation</p>
      <h2>{headline}</h2>
      <p>{offer.description}</p>
      <a href={offer.url} target="_blank" rel="noopener noreferrer nofollow sponsored">
        {ctaLabel}
      </a>
    </aside>
  );
}
