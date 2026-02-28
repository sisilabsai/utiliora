"use client";

import { CategoryIcon } from "@/components/CategoryIcon";
import { ToolCard } from "@/components/ToolCard";
import { ToolSearch } from "@/components/ToolSearch";
import { useLocale } from "@/components/LocaleProvider";
import { getToolsByCategory } from "@/lib/tools";
import type { ToolCategory, ToolDefinition } from "@/lib/types";

interface HomePageContentProps {
  categories: ToolCategory[];
  allTools: ToolDefinition[];
  featuredTools: ToolDefinition[];
}

export function HomePageContent({ categories, allTools, featuredTools }: HomePageContentProps) {
  const { t } = useLocale();

  return (
    <div className="site-container page-stack">
      <section className="hero">
        <p className="eyebrow">{t("home.eyebrow", undefined, "Global utility platform")}</p>
        <h1>{t("home.title", undefined, "Simple tools. Instant results.")}</h1>
        <p>
          {t(
            "home.description",
            undefined,
            "Utiliora delivers fast browser-based calculators, converters, SEO tools, image utilities, and developer workflows without login friction.",
          )}
        </p>
        <div className="hero-cta">
          <a className="action-link" href="/tools">
            {t("home.cta_explore", undefined, "Explore all tools")}
          </a>
          <span>{`${allTools.length}+ ${t("home.tools_live_suffix", undefined, "tools live and growing weekly.")}`}</span>
        </div>
      </section>

      <ToolSearch tools={allTools} />

      <section className="category-overview" aria-label={t("home.categories_aria", undefined, "Tool categories")}>
        {categories.map((category) => {
          const count = getToolsByCategory(category.slug).length;
          const title = t(`category.${category.slug}.title`, undefined, category.title);
          const description = t(`category.${category.slug}.description`, undefined, category.description);

          return (
            <article key={category.slug} className="category-card">
              <h2>
                <CategoryIcon category={category.slug} size={16} />
                <a href={`/${category.slug}`}>{title}</a>
              </h2>
              <p>{description}</p>
              <small>{t("home.tools_available", { count }, `${count} tools available`)}</small>
            </article>
          );
        })}
      </section>

      <section>
        <div className="section-head">
          <h2>{t("home.popular", undefined, "Popular right now")}</h2>
          <a href="/tools">{t("home.view_full_directory", undefined, "View full directory")}</a>
        </div>
        <div className="tool-grid">
          {featuredTools.map((tool) => (
            <ToolCard key={`${tool.category}-${tool.slug}`} tool={tool} />
          ))}
        </div>
      </section>

      <section className="content-block info-card">
        <h2>{t("home.company_support_title", undefined, "Company and support")}</h2>
        <p>
          {t(
            "home.company_support_desc",
            undefined,
            "Learn how Utiliora works, contact our team, and review platform policies.",
          )}
        </p>
        <div className="button-row">
          <a className="action-button secondary" href="/about">
            {t("nav.about", undefined, "About")}
          </a>
          <a className="action-button secondary" href="/contact">
            {t("nav.contact", undefined, "Contact")}
          </a>
          <a className="action-button secondary" href="/privacy">
            {t("footer.privacy", undefined, "Privacy")}
          </a>
          <a className="action-button secondary" href="/terms">
            {t("footer.terms", undefined, "Terms")}
          </a>
        </div>
      </section>
    </div>
  );
}
