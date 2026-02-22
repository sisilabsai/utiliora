import type { AffiliateOffer } from "@/lib/types";

interface AffiliateCardProps {
  offer: AffiliateOffer;
}

export function AffiliateCard({ offer }: AffiliateCardProps) {
  return (
    <aside className="affiliate-card" aria-label="Recommended partner">
      <h2>Recommended upgrade</h2>
      <p>{offer.description}</p>
      <a href={offer.url} target="_blank" rel="noopener noreferrer sponsored">
        Try {offer.label}
      </a>
    </aside>
  );
}
