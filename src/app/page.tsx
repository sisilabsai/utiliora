import type { Metadata } from "next";
import { ToolCard } from "@/components/ToolCard";
import { ToolSearch } from "@/components/ToolSearch";
import { CategoryIcon } from "@/components/CategoryIcon";
import { getCategories } from "@/lib/categories";
import { getAllTools, getToolsByCategory } from "@/lib/tools";

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
    <div className="site-container page-stack">
      <section className="hero">
        <p className="eyebrow">Global utility platform</p>
        <h1>Simple tools. Instant results.</h1>
        <p>
          Utiliora delivers fast browser-based calculators, converters, SEO tools, image utilities, and developer
          workflows without login friction.
        </p>
        <div className="hero-cta">
          <a className="action-link" href="/tools">
            Explore all tools
          </a>
          <span>{allTools.length}+ tools live and growing weekly.</span>
        </div>
      </section>

      <ToolSearch tools={allTools} />

      <section className="category-overview" aria-label="Tool categories">
        {categories.map((category) => {
          const count = getToolsByCategory(category.slug).length;
          return (
            <article key={category.slug} className="category-card">
              <h2>
                <CategoryIcon category={category.slug} size={16} />
                <a href={`/${category.slug}`}>{category.title}</a>
              </h2>
              <p>{category.description}</p>
              <small>{count} tools available</small>
            </article>
          );
        })}
      </section>

      <section>
        <div className="section-head">
          <h2>Popular right now</h2>
          <a href="/tools">View full directory</a>
        </div>
        <div className="tool-grid">
          {featuredTools.map((tool) => (
            <ToolCard key={`${tool.category}-${tool.slug}`} tool={tool} />
          ))}
        </div>
      </section>

      <section className="content-block info-card">
        <h2>Company and support</h2>
        <p>Learn how Utiliora works, contact our team, and review platform policies.</p>
        <div className="button-row">
          <a className="action-button secondary" href="/about">
            About
          </a>
          <a className="action-button secondary" href="/contact">
            Contact
          </a>
          <a className="action-button secondary" href="/privacy">
            Privacy
          </a>
          <a className="action-button secondary" href="/terms">
            Terms
          </a>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([websiteSchema, organizationSchema]) }}
      />
    </div>
  );
}
