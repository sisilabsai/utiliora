import type { Metadata } from "next";
import { HomePageContent } from "@/components/pages/HomePageContent";
import { getCategories } from "@/lib/categories";
import { absoluteUrl, SITE_NAME, SITE_ORIGIN } from "@/lib/site";
import { getAllTools } from "@/lib/tools";

export const metadata: Metadata = {
  title: "Online Utility Tools",
  description:
    "Use fast free online tools for calculators, converters, SEO, images, developer workflows, and productivity.",
  keywords: [
    "online utility tools",
    "free calculators",
    "unit converter",
    "seo tools",
    "image converter",
    "developer utilities",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: `${SITE_NAME} | Online Utility Tools`,
    description:
      "Use fast free online tools for calculators, converters, SEO, images, developer workflows, and productivity.",
    url: absoluteUrl("/"),
    type: "website",
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | Online Utility Tools`,
    description:
      "Use fast free online tools for calculators, converters, SEO, images, developer workflows, and productivity.",
  },
};

export default function Home() {
  const categories = getCategories();
  const allTools = getAllTools();
  const featuredTools = allTools.slice(0, 12);
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_ORIGIN,
    description:
      "Global utility platform with calculators, converters, SEO tools, image tools, developer tools, and productivity tools.",
  };
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_ORIGIN,
  };

  return (
    <>
      <HomePageContent categories={categories} allTools={allTools} featuredTools={featuredTools} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([websiteSchema, organizationSchema]) }}
      />
    </>
  );
}
