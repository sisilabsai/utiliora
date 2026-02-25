import type { Metadata } from "next";
import { ToolCard } from "@/components/ToolCard";
import { ToolSearch } from "@/components/ToolSearch";
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
    title: "All Tools | Utiliora",
    description:
      "Browse the full Utiliora tool library across calculators, converters, SEO, image, and developer tools.",
    url: "https://utiliora.cloud/tools",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "All Tools | Utiliora",
    description:
      "Browse the full Utiliora tool library across calculators, converters, SEO, image, and developer tools.",
  },
};

export default function AllToolsPage() {
  const tools = getAllTools();
  const directorySchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "All Utiliora Tools",
    description:
      "Directory of calculators, converters, SEO tools, image tools, developer tools, and productivity tools.",
    url: "https://utiliora.cloud/tools",
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

  return (
    <div className="site-container page-stack">
      <section>
        <p className="eyebrow">Tool directory</p>
        <h1>All Utiliora tools</h1>
        <p>Use search to jump directly to the utility you need.</p>
      </section>
      <ToolSearch tools={tools} />
      <section className="tool-grid">
        {tools.map((tool) => (
          <ToolCard key={`${tool.category}-${tool.slug}`} tool={tool} />
        ))}
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(directorySchema) }}
      />
    </div>
  );
}
