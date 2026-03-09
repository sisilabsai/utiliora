import type { Metadata } from "next";
import { ToolsDirectoryContent } from "@/components/pages/ToolsDirectoryContent";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { getAllTools } from "@/lib/tools";

export const metadata: Metadata = {
  title: "All Tools",
  description: "Browse the full Utiliora tool library across calculators, converters, SEO, image, and developer tools.",
  keywords: [
    "all online tools",
    "free calculator directory",
    "converter tools",
    "seo tools online",
    "developer tools",
    "productivity tools",
  ],
  alternates: {
    canonical: "/tools",
  },
  openGraph: {
    title: `All Tools | ${SITE_NAME}`,
    description:
      "Browse the full Utiliora tool library across calculators, converters, SEO, image, and developer tools.",
    url: absoluteUrl("/tools"),
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `All Tools | ${SITE_NAME}`,
    description:
      "Browse the full Utiliora tool library across calculators, converters, SEO, image, and developer tools.",
  },
};

export default function AllToolsPage() {
  const tools = getAllTools();
  const directorySchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `All ${SITE_NAME} Tools`,
    description:
      "Directory of calculators, converters, SEO tools, image tools, developer tools, and productivity tools.",
    url: absoluteUrl("/tools"),
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

  return (
    <>
      <ToolsDirectoryContent tools={tools} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(directorySchema) }}
      />
    </>
  );
}
