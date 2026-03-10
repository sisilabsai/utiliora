import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolCard } from "@/components/ToolCard";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { getWorkflowBundleBySlug, getWorkflowBundles } from "@/lib/growth";

interface WorkflowBundlePageProps {
  params: {
    slug: string;
  };
}

export function generateStaticParams() {
  return getWorkflowBundles().map((bundle) => ({ slug: bundle.slug }));
}

export function generateMetadata({ params }: WorkflowBundlePageProps): Metadata {
  const bundle = getWorkflowBundleBySlug(params.slug);
  if (!bundle) return {};

  return {
    title: bundle.title,
    description: bundle.summary,
    alternates: {
      canonical: `/workflows/${bundle.slug}`,
    },
    openGraph: {
      title: `${bundle.title} | ${SITE_NAME}`,
      description: bundle.summary,
      url: absoluteUrl(`/workflows/${bundle.slug}`),
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `${bundle.title} | ${SITE_NAME}`,
      description: bundle.summary,
    },
  };
}

export default function WorkflowBundlePage({ params }: WorkflowBundlePageProps) {
  const bundle = getWorkflowBundleBySlug(params.slug);
  if (!bundle) notFound();

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: bundle.title,
    description: bundle.summary,
    url: absoluteUrl(`/workflows/${bundle.slug}`),
    mainEntity: {
      "@type": "ItemList",
      itemListElement: bundle.tools.map((tool, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: tool.title,
        url: absoluteUrl(`/${tool.category}/${tool.slug}`),
      })),
    },
  };

  return (
    <>
      <div className="site-container page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <a href="/">Home</a>
          <span>/</span>
          <a href="/workflows">Workflows</a>
          <span>/</span>
          <span aria-current="page">{bundle.title}</span>
        </nav>

        <section className="hero">
          <p className="eyebrow">Workflow bundle</p>
          <h1>{bundle.title}</h1>
          <p>{bundle.summary}</p>
          <div className="chip-row">
            <span className="chip-link">Audience: {bundle.audience}</span>
            <span className="chip-link">Outcome: {bundle.outcome}</span>
          </div>
        </section>

        <section className="content-block info-card">
          <h2>When to use this bundle</h2>
          <p>
            Use this route when you want to move through one connected job instead of hunting for tools one at a time.
            Every link below is chosen to hand users into the next meaningful step.
          </p>
        </section>

        <section>
          <div className="section-head">
            <h2>Recommended tool sequence</h2>
          </div>
          <div className="tool-grid">
            {bundle.tools.map((tool) => (
              <ToolCard key={`${tool.category}-${tool.slug}`} tool={tool} />
            ))}
          </div>
        </section>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />
    </>
  );
}
