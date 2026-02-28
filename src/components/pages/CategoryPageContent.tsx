"use client";

import { AdSlot } from "@/components/AdSlot";
import { AffiliateCard } from "@/components/AffiliateCard";
import { ToolCard } from "@/components/ToolCard";
import { useLocale } from "@/components/LocaleProvider";
import type { AffiliateOffer, ToolCategory, ToolDefinition } from "@/lib/types";

interface CategoryPageContentProps {
  category: ToolCategory;
  tools: ToolDefinition[];
  categoryAffiliateOffer: AffiliateOffer | null;
}

export function CategoryPageContent({ category, tools, categoryAffiliateOffer }: CategoryPageContentProps) {
  const { t } = useLocale();
  const title = t(`category.${category.slug}.title`, undefined, category.title);
  const shortTitle = t(`category.${category.slug}.short`, undefined, category.shortTitle);
  const description = t(`category.${category.slug}.description`, undefined, category.description);

  return (
    <div className="site-container page-stack">
      <section>
        <p className="eyebrow">{t("category.collection_suffix", { shortTitle }, `${shortTitle} collection`)}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </section>

      {categoryAffiliateOffer ? <AffiliateCard offer={categoryAffiliateOffer} /> : null}

      <AdSlot label={t("ad.sponsored_placement", undefined, "Sponsored placement")} />

      <section className="tool-grid">
        {tools.map((tool) => (
          <ToolCard key={`${tool.category}-${tool.slug}`} tool={tool} />
        ))}
      </section>
    </div>
  );
}
