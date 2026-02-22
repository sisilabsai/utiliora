import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolCard } from "@/components/ToolCard";
import { AdSlot } from "@/components/AdSlot";
import { getCategory, orderedCategorySlugs } from "@/lib/categories";
import { getToolsByCategory } from "@/lib/tools";

interface CategoryPageProps {
  params: {
    category: string;
  };
}

export function generateStaticParams() {
  return orderedCategorySlugs().map((category) => ({ category }));
}

export function generateMetadata({ params }: CategoryPageProps): Metadata {
  const category = getCategory(params.category);
  if (!category) return {};

  return {
    title: category.title,
    description: category.description,
    alternates: {
      canonical: `/${category.slug}`,
    },
  };
}

export default function CategoryPage({ params }: CategoryPageProps) {
  const category = getCategory(params.category);
  if (!category) notFound();

  const tools = getToolsByCategory(category.slug);

  return (
    <div className="site-container page-stack">
      <section>
        <p className="eyebrow">{category.shortTitle} collection</p>
        <h1>{category.title}</h1>
        <p>{category.description}</p>
      </section>

      <AdSlot label="Sponsored placement" />

      <section className="tool-grid">
        {tools.map((tool) => (
          <ToolCard key={`${tool.category}-${tool.slug}`} tool={tool} />
        ))}
      </section>
    </div>
  );
}
