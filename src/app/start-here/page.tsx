import type { Metadata } from "next";
import { ToolCard } from "@/components/ToolCard";
import { WorkflowBundleCard } from "@/components/WorkflowBundleCard";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { getHeroTools, getWorkflowBundles } from "@/lib/growth";

export const metadata: Metadata = {
  title: "Start Here",
  description:
    "Start with Utiliora's recommended tools and guided workflows instead of guessing where to begin.",
  alternates: {
    canonical: "/start-here",
  },
  openGraph: {
    title: `Start Here | ${SITE_NAME}`,
    description:
      "Start with Utiliora's recommended tools and guided workflows instead of guessing where to begin.",
    url: absoluteUrl("/start-here"),
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `Start Here | ${SITE_NAME}`,
    description:
      "Start with Utiliora's recommended tools and guided workflows instead of guessing where to begin.",
  },
};

export default function StartHerePage() {
  const heroTools = getHeroTools();
  const workflowBundles = getWorkflowBundles();

  return (
    <div className="site-container page-stack">
      <section className="hero">
        <p className="eyebrow">Recommended starting points</p>
        <h1>Start with the tools and workflows most people need first</h1>
        <p>
          If you are not sure where to begin, start here. This page highlights the tools and guided workflows that solve
          the most common jobs fastest.
        </p>
        <div className="hero-cta">
          <a className="action-link" href="/workflows">
            Browse workflows
          </a>
          <a className="action-link" href="/tools">
            Open full directory
          </a>
        </div>
      </section>

      <section className="content-block info-card">
        <div className="section-head">
          <h2>Guided workflows</h2>
        </div>
        <p>
          Use a workflow when your task needs more than one tool. Each one gives you a simple sequence to follow so you
          can finish the job with less trial and error.
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
