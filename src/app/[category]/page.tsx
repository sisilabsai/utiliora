import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryPageContent } from "@/components/pages/CategoryPageContent";
import { getAffiliateOfferForCategory } from "@/lib/affiliates";
import { getCategory, orderedCategorySlugs } from "@/lib/categories";
import { absoluteUrl, SITE_NAME, SITE_ORIGIN } from "@/lib/site";
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
      title: `${category.title} | ${SITE_NAME}`,
      description: category.description,
      url: absoluteUrl(`/${category.slug}`),
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${category.title} | ${SITE_NAME}`,
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
    name: `${category.title} | ${SITE_NAME}`,
    description: category.description,
    url: absoluteUrl(`/${category.slug}`),
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_ORIGIN,
    },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: tools.map((tool, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: tool.title,
        url: absoluteUrl(`/${tool.category}/${tool.slug}`),
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
        item: absoluteUrl("/"),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: category.title,
        item: absoluteUrl(`/${category.slug}`),
      },
    ],
  };

  return (
    <>
      <CategoryPageContent category={category} tools={tools} categoryAffiliateOffer={categoryAffiliateOffer} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([categorySchema, breadcrumbSchema]) }}
      />
    </>
  );
}
