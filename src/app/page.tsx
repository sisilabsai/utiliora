import Link from "next/link";
import { ToolCard } from "@/components/ToolCard";
import { ToolSearch } from "@/components/ToolSearch";
import { getCategories } from "@/lib/categories";
import { getAllTools, getToolsByCategory } from "@/lib/tools";

export default function Home() {
  const categories = getCategories();
  const allTools = getAllTools();
  const featuredTools = allTools.slice(0, 12);

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
          <Link className="action-link" href="/tools">
            Explore all tools
          </Link>
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
                <Link href={`/${category.slug}`}>{category.title}</Link>
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
          <Link href="/tools">View full directory</Link>
        </div>
        <div className="tool-grid">
          {featuredTools.map((tool) => (
            <ToolCard key={`${tool.category}-${tool.slug}`} tool={tool} />
          ))}
        </div>
      </section>
    </div>
  );
}
