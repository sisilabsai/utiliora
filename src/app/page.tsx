import type { Metadata } from "next";
import { HomePageContent } from "@/components/pages/HomePageContent";
import { getCategories } from "@/lib/categories";
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
    title: "Utiliora | Online Utility Tools",
    description:
      "Use fast free online tools for calculators, converters, SEO, images, developer workflows, and productivity.",
    url: "https://utiliora.cloud/",
    type: "website",
    siteName: "Utiliora",
  },
  twitter: {
    card: "summary_large_image",
    title: "Utiliora | Online Utility Tools",
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
    name: "Utiliora",
    url: "https://utiliora.cloud",
    description:
      "Global utility platform with calculators, converters, SEO tools, image tools, developer tools, and productivity tools.",
  };
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Utiliora",
    url: "https://utiliora.cloud",
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
