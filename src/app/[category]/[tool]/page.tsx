import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdSlot } from "@/components/AdSlot";
import { AffiliateCard } from "@/components/AffiliateCard";
import { RelatedTools } from "@/components/RelatedTools";
import { ToolRenderer } from "@/components/ToolRenderer";
import { getCategory } from "@/lib/categories";
import { getAllTools, getRelatedTools, getToolByCategoryAndSlug } from "@/lib/tools";

interface ToolPageProps {
  params: {
    category: string;
    tool: string;
  };
}

export function generateStaticParams() {
  return getAllTools().map((tool) => ({
    category: tool.category,
    tool: tool.slug,
  }));
}

export function generateMetadata({ params }: ToolPageProps): Metadata {
  const tool = getToolByCategoryAndSlug(params.category, params.tool);
  if (!tool) return {};
  return {
    title: tool.title,
    description: tool.summary,
    keywords: tool.keywords,
    alternates: {
      canonical: `/${tool.category}/${tool.slug}`,
    },
    openGraph: {
      title: tool.title,
      description: tool.summary,
      url: `https://utiliora.com/${tool.category}/${tool.slug}`,
      type: "article",
    },
  };
}

function buildJsonLd(toolTitle: string, description: string, categoryTitle: string) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: toolTitle,
    applicationCategory: categoryTitle,
    operatingSystem: "Web browser",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    description,
  };
}

export default function ToolPage({ params }: ToolPageProps) {
  const tool = getToolByCategoryAndSlug(params.category, params.tool);
  if (!tool) notFound();

  const category = getCategory(tool.category);
  const relatedTools = getRelatedTools(tool);
  const jsonLd = buildJsonLd(tool.title, tool.description, category?.title ?? "Utility Tool");

  return (
    <div className="site-container page-stack">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <Link href={`/${tool.category}`}>{category?.title ?? tool.category}</Link>
        <span>/</span>
        <span aria-current="page">{tool.title}</span>
      </nav>

      <section className="tool-hero">
        <p className="eyebrow">{category?.shortTitle ?? "Tool"}</p>
        <h1>{tool.title}</h1>
        <p>{tool.summary}</p>
      </section>

      <ToolRenderer tool={tool} />

      <AdSlot />

      {tool.affiliate ? <AffiliateCard offer={tool.affiliate} /> : null}

      <section className="content-block">
        <h2>How this tool helps</h2>
        <p>{tool.description}</p>
        <p>
          Utiliora tools are designed to work directly in modern browsers with clear input labels, mobile-friendly
          controls, and accessible result panels. Use related utilities below to continue your workflow without
          switching apps.
        </p>
      </section>

      <section className="faq" aria-label="Frequently asked questions">
        <h2>FAQ</h2>
        {tool.faq.map((item) => (
          <details key={item.question}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </section>

      <RelatedTools tools={relatedTools} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  );
}
