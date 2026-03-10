"use client";

import { CategoryIcon } from "@/components/CategoryIcon";
import { ToolCard } from "@/components/ToolCard";
import { ToolSearch } from "@/components/ToolSearch";
import { WorkflowBundleCard } from "@/components/WorkflowBundleCard";
import { useLocale } from "@/components/LocaleProvider";
import type { ResolvedWorkflowBundle } from "@/lib/growth";
import { getToolsByCategory } from "@/lib/tools";
import type { ToolCategory, ToolDefinition } from "@/lib/types";

interface HomePageContentProps {
  categories: ToolCategory[];
  allTools: ToolDefinition[];
  featuredTools: ToolDefinition[];
  heroTools: ToolDefinition[];
  workflowBundles: ResolvedWorkflowBundle[];
  latestTools: ToolDefinition[];
}

export function HomePageContent({
  categories,
  allTools,
  featuredTools,
  heroTools,
  workflowBundles,
  latestTools,
}: HomePageContentProps) {
  const { t } = useLocale();

  return (
    <div className="site-container page-stack">
      <section className="hero">
        <p className="eyebrow">{t("home.eyebrow", undefined, "Daily digital work, without friction")}</p>
        <h1>{t("home.title", undefined, "Do real digital work in seconds")}</h1>
        <p>
          {t(
            "home.description",
            undefined,
            "Fast browser-based tools for SEO, creators, developers, business ops, and everyday calculations. No forced signup. No clutter. Just fast outcomes.",
          )}
        </p>
        <div className="hero-cta">
          <a className="action-link" href="/start-here">
            {t("home.cta_start_here", undefined, "Start here")}
          </a>
          <a className="action-link" href="/workflows">
            {t("home.cta_workflows", undefined, "Browse workflow bundles")}
          </a>
          <a className="action-link" href="/tools">
            {t("home.cta_explore", undefined, "Explore all tools")}
          </a>
          <span>{`${allTools.length}+ ${t("home.tools_live_suffix", undefined, "tools live and growing weekly.")}`}</span>
        </div>
        <div className="chip-row">
          <span className="chip-link">{heroTools.length} curated hero tools</span>
          <span className="chip-link">{workflowBundles.length} workflow bundles</span>
          <span className="chip-link">Browser-first execution</span>
          <span className="chip-link">No-login core utility</span>
        </div>
      </section>

      <ToolSearch tools={allTools} />

      <section className="content-block info-card">
        <div className="section-head">
          <h2>{t("home.featured_workflows", undefined, "Start with ready-made workflows")}</h2>
          <a href="/workflows">{t("home.view_all_workflows", undefined, "View all workflows")}</a>
        </div>
        <p>
          {t(
            "home.featured_workflows_desc",
            undefined,
            "Choose a guided workflow when you want to finish a complete task faster. Each one groups the right tools for a clear outcome.",
          )}
        </p>
        <div className="workflow-grid">
          {workflowBundles.slice(0, 4).map((bundle) => (
            <WorkflowBundleCard key={bundle.slug} bundle={bundle} />
          ))}
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2>{t("home.hero_tools", undefined, "Featured hero tools")}</h2>
          <a href="/start-here">{t("home.view_best_tools", undefined, "See recommended tools")}</a>
        </div>
        <div className="tool-grid">
          {featuredTools.map((tool) => (
            <ToolCard key={`${tool.category}-${tool.slug}`} tool={tool} />
          ))}
        </div>
      </section>

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
          <h2>{t("home.popular", undefined, "Recently added tools")}</h2>
          <a href="/tools">{t("home.view_full_directory", undefined, "View full directory")}</a>
        </div>
        <div className="tool-grid">
          {latestTools.map((tool) => (
            <ToolCard key={`${tool.category}-${tool.slug}`} tool={tool} />
          ))}
        </div>
      </section>

      <section className="content-block info-card">
        <h2>{t("home.why_utiliora", undefined, "Find the fastest way to get the job done")}</h2>
        <p>
          {t(
            "home.why_utiliora_desc",
            undefined,
            "Start with a recommended tool or workflow if you already know the job you want to finish. You can still browse the full directory any time.",
          )}
        </p>
        <div className="chip-row">
          <a className="chip-link" href="/seo-tools/meta-tag-generator">SEO launch tasks</a>
          <a className="chip-link" href="/image-tools/background-remover">Creator asset tasks</a>
          <a className="chip-link" href="/productivity-tools/bank-statement-normalizer-expense-intelligence">Money clarity tasks</a>
          <a className="chip-link" href="/productivity-tools/job-application-kit-builder">Career prep tasks</a>
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
