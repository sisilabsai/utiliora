import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdSlot } from "@/components/AdSlot";
import { AffiliateCard } from "@/components/AffiliateCard";
import { RelatedTools } from "@/components/RelatedTools";
import { SocialSharePrompt } from "@/components/SocialSharePrompt";
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
    description: tool.description,
    keywords: Array.from(new Set([...tool.keywords, tool.title.toLowerCase(), `${tool.category} tool`, "utiliora"])),
    alternates: {
      canonical: `/${tool.category}/${tool.slug}`,
    },
    openGraph: {
      title: tool.title,
      description: tool.description,
      url: `https://utiliora.cloud/${tool.category}/${tool.slug}`,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `${tool.title} | Utiliora`,
      description: tool.description,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

function buildJsonLd(
  toolTitle: string,
  description: string,
  categoryTitle: string,
  categorySlug: string,
  toolSlug: string,
  faq: Array<{ question: string; answer: string }>,
) {
  const url = `https://utiliora.cloud/${categorySlug}/${toolSlug}`;
  const softwareApplication = {
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
    url,
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://utiliora.cloud/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: categoryTitle,
        item: `https://utiliora.cloud/${categorySlug}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: toolTitle,
        item: url,
      },
    ],
  };

  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return [softwareApplication, breadcrumb, faqPage];
}

export default function ToolPage({ params }: ToolPageProps) {
  const tool = getToolByCategoryAndSlug(params.category, params.tool);
  if (!tool) notFound();

  const category = getCategory(tool.category);
  const relatedTools = getRelatedTools(tool);
  const categoryTitle = category?.title ?? "Utility Tool";
  const jsonLd = buildJsonLd(tool.title, tool.description, categoryTitle, tool.category, tool.slug, tool.faq);

  return (
    <div className="site-container page-stack">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <a href="/">Home</a>
        <span>/</span>
        <a href={`/${tool.category}`}>{category?.title ?? tool.category}</a>
        <span>/</span>
        <span aria-current="page">{tool.title}</span>
      </nav>

      <section className="tool-hero">
        <p className="eyebrow">{category?.shortTitle ?? "Tool"}</p>
        <h1>{tool.title}</h1>
        <p>{tool.summary}</p>
      </section>

      <ToolRenderer tool={tool} />
      <SocialSharePrompt toolTitle={tool.title} toolSlug={tool.slug} toolPath={`/${tool.category}/${tool.slug}`} />

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
