"use client";

import { useEffect } from "react";
import { AdSlot } from "@/components/AdSlot";
import { AffiliateCard } from "@/components/AffiliateCard";
import { RelatedTools } from "@/components/RelatedTools";
import { SocialSharePrompt } from "@/components/SocialSharePrompt";
import { ToolRenderer } from "@/components/ToolRenderer";
import { useLocale } from "@/components/LocaleProvider";
import { trackEvent } from "@/lib/analytics";
import { getToolPrimaryNextStep, getWorkflowBundlesForTool, isHeroTool } from "@/lib/growth";
import type { AffiliateOffer, ToolDefinition } from "@/lib/types";

interface ToolPageContentProps {
  tool: ToolDefinition;
  categoryTitle: string;
  relatedTools: ToolDefinition[];
  affiliateOffer: AffiliateOffer | null;
}

export function ToolPageContent({ tool, categoryTitle, relatedTools, affiliateOffer }: ToolPageContentProps) {
  const { t } = useLocale();
  const translatedCategoryTitle = t(`category.${tool.category}.title`, undefined, categoryTitle);
  const translatedCategoryShort = t(
    `category.${tool.category}.short`,
    undefined,
    t("tool_card.tool", undefined, "Tool"),
  );
  const heroTool = isHeroTool(tool);
  const nextStepTool = getToolPrimaryNextStep(tool);
  const workflowBundles = getWorkflowBundlesForTool(tool);

  useEffect(() => {
    trackEvent("tool_page_view", {
      category: tool.category,
      slug: tool.slug,
      isHeroTool: heroTool,
    });
  }, [heroTool, tool.category, tool.slug]);

  return (
    <div className="site-container page-stack">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <a href="/">{t("tool.breadcrumb_home", undefined, "Home")}</a>
        <span>/</span>
        <a href={`/${tool.category}`}>{translatedCategoryTitle}</a>
        <span>/</span>
        <span aria-current="page">{tool.title}</span>
      </nav>

      <section className="tool-hero">
        <p className="eyebrow">{translatedCategoryShort}</p>
        <h1>{tool.title}</h1>
        <p>{tool.summary}</p>
        <div className="chip-row">
          {heroTool ? <span className="chip-link">Hero growth tool</span> : null}
          <span className="chip-link">No signup for core utility</span>
          <span className="chip-link">Browser-based where possible</span>
        </div>
      </section>

      <ToolRenderer tool={tool} />
      {affiliateOffer ? <AffiliateCard offer={affiliateOffer} /> : null}
      <SocialSharePrompt toolTitle={tool.title} toolSlug={tool.slug} toolPath={`/${tool.category}/${tool.slug}`} />

      <AdSlot />

      <section className="content-block">
        <h2>{t("tool.how_help_title", undefined, "How this tool helps")}</h2>
        <p>{tool.description}</p>
        <p>
          {t(
            "tool.how_help_desc",
            undefined,
            "Utiliora tools are designed to work directly in modern browsers with clear input labels, mobile-friendly controls, and accessible result panels. Use related utilities below to continue your workflow without switching apps.",
          )}
        </p>
        {tool.slug === "ai-humanizer" ? (
          <>
            <p>
              {t(
                "tool.how_help_ai_1",
                undefined,
                "This humanizer workspace is built for responsible editing: compare multiple rewrite variants, verify meaning-retention signals, and correct sentence-level drift before publishing.",
              )}
            </p>
            <p>
              {t(
                "tool.how_help_ai_2",
                undefined,
                "For SEO and professional writing, use keyword locks, readability deltas, and critical-token retention to keep factual details stable while improving natural flow.",
              )}
            </p>
          </>
        ) : null}
        <p className="supporting-text">
          Utiliora keeps core tool access friction-light and favors browser-side processing where possible so users can
          reach value quickly.
        </p>
      </section>

      {nextStepTool ? (
        <section className="content-block info-card">
          <h2>Use next</h2>
          <p>
            The strongest next step after <strong>{tool.title}</strong> is <strong>{nextStepTool.title}</strong>. This
            keeps the visitor inside one practical workflow instead of sending them back to the directory.
          </p>
          <div className="button-row">
            <a
              className="action-button"
              href={`/${nextStepTool.category}/${nextStepTool.slug}`}
              onClick={() =>
                trackEvent("tool_next_step_click", {
                  fromCategory: tool.category,
                  fromSlug: tool.slug,
                  toCategory: nextStepTool.category,
                  toSlug: nextStepTool.slug,
                })
              }
            >
              Open {nextStepTool.title}
            </a>
            <a className="action-button secondary" href="/start-here">
              View curated shortlist
            </a>
          </div>
        </section>
      ) : null}

      {workflowBundles.length ? (
        <section className="content-block info-card">
          <h2>Included in workflow bundles</h2>
          <p>This tool is part of one or more curated paths that turn isolated utility into a complete outcome.</p>
          <div className="chip-row">
            {workflowBundles.map((bundle) => (
              <a
                key={bundle.slug}
                className="chip-link"
                href={`/workflows/${bundle.slug}`}
                onClick={() =>
                  trackEvent("workflow_bundle_click", {
                    sourceCategory: tool.category,
                    sourceSlug: tool.slug,
                    bundleSlug: bundle.slug,
                  })
                }
              >
                {bundle.title}
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <section className="faq" aria-label="Frequently asked questions">
        <h2>{t("tool.faq_title", undefined, "FAQ")}</h2>
        {tool.faq.map((item) => (
          <details key={item.question}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </section>

      <RelatedTools tools={relatedTools} />
    </div>
  );
}
