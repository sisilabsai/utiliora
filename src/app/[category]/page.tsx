import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolCard } from "@/components/ToolCard";
import { AdSlot } from "@/components/AdSlot";
import { AffiliateCard } from "@/components/AffiliateCard";
import { getAffiliateOfferForCategory } from "@/lib/affiliates";
import { getCategory, orderedCategorySlugs } from "@/lib/categories";
import { getToolsByCategory } from "@/lib/tools";

interface CategoryPageProps {
  params: {
    category: string;
  };
}

export function generateStaticParams() {
  return orderedCategorySlugs().map((category) => ({ category }));
}

export function generateMetadata({ params }: CategoryPageProps): Metadata {
  const category = getCategory(params.category);
  if (!category) return {};
  const tools = getToolsByCategory(category.slug);
  const keywords = Array.from(
    new Set([
      category.title.toLowerCase(),
      `${category.shortTitle.toLowerCase()} tools`,
      ...tools.flatMap((tool) => tool.keywords),
    ]),
  ).slice(0, 20);

  return {
    title: category.title,
    description: category.description,
    keywords,
    alternates: {
      canonical: `/${category.slug}`,
    },
    openGraph: {
      title: `${category.title} | Utiliora`,
      description: category.description,
      url: `https://utiliora.cloud/${category.slug}`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${category.title} | Utiliora`,
      description: category.description,
    },
  };
}

export default function CategoryPage({ params }: CategoryPageProps) {
  const category = getCategory(params.category);
  if (!category) notFound();

  const tools = getToolsByCategory(category.slug);
  const categoryAffiliateOffer = getAffiliateOfferForCategory(category.slug);
  const categorySchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${category.title} | Utiliora`,
    description: category.description,
    url: `https://utiliora.cloud/${category.slug}`,
    isPartOf: {
      "@type": "WebSite",
      name: "Utiliora",
      url: "https://utiliora.cloud",
    },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: tools.map((tool, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: tool.title,
        url: `https://utiliora.cloud/${tool.category}/${tool.slug}`,
      })),
    },
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://utiliora.cloud/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: category.title,
        item: `https://utiliora.cloud/${category.slug}`,
      },
    ],
  };

  return (
    <div className="site-container page-stack">
      <section>
        <p className="eyebrow">{category.shortTitle} collection</p>
        <h1>{category.title}</h1>
        <p>{category.description}</p>
      </section>

      {categoryAffiliateOffer ? <AffiliateCard offer={categoryAffiliateOffer} /> : null}

      <AdSlot label="Sponsored placement" />

      <section className="tool-grid">
        {tools.map((tool) => (
          <ToolCard key={`${tool.category}-${tool.slug}`} tool={tool} />
        ))}
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([categorySchema, breadcrumbSchema]) }}
      />
    </div>
  );
}
