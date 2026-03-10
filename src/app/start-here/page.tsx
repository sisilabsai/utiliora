import type { Metadata } from "next";
import { ToolCard } from "@/components/ToolCard";
import { WorkflowBundleCard } from "@/components/WorkflowBundleCard";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { getHeroTools, getWorkflowBundles } from "@/lib/growth";

export const metadata: Metadata = {
  title: "Start Here",
  description:
    "Start with Utiliora's curated hero tools and workflow bundles instead of browsing the full directory.",
  alternates: {
    canonical: "/start-here",
  },
  openGraph: {
    title: `Start Here | ${SITE_NAME}`,
    description:
      "Start with Utiliora's curated hero tools and workflow bundles instead of browsing the full directory.",
    url: absoluteUrl("/start-here"),
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `Start Here | ${SITE_NAME}`,
    description:
      "Start with Utiliora's curated hero tools and workflow bundles instead of browsing the full directory.",
  },
};

export default function StartHerePage() {
  const heroTools = getHeroTools();
  const workflowBundles = getWorkflowBundles();

  return (
    <div className="site-container page-stack">
      <section className="hero">
        <p className="eyebrow">Curated shortlist</p>
        <h1>Start with the tools most likely to grow the platform</h1>
        <p>
          This page is the focused entry point for new visitors. Instead of scanning the entire directory, start with the
          strongest hero tools and the clearest multi-step workflows.
        </p>
        <div className="hero-cta">
          <a className="action-link" href="/workflows">
            Browse workflow bundles
          </a>
          <a className="action-link" href="/tools">
            Open full directory
          </a>
        </div>
      </section>

      <section className="content-block info-card">
        <div className="section-head">
          <h2>Workflow bundles first</h2>
        </div>
        <p>
          These bundles represent the strongest cross-tool journeys. They are the clearest growth surfaces for SEO,
          onboarding, internal linking, and social distribution.
        </p>
        <div className="workflow-grid">
          {workflowBundles.map((bundle) => (
            <WorkflowBundleCard key={bundle.slug} bundle={bundle} />
          ))}
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2>Hero tools</h2>
        </div>
        <div className="tool-grid">
          {heroTools.map((tool) => (
            <ToolCard key={`${tool.category}-${tool.slug}`} tool={tool} />
          ))}
        </div>
      </section>
    </div>
  );
}
