import { CATEGORY_ORDER, type ToolCategory, type ToolCategorySlug } from "@/lib/types";

export const CATEGORIES: ToolCategory[] = [
  {
    slug: "calculators",
    title: "Calculators",
    shortTitle: "Calculator",
    description: "Finance, business, and health calculators with instant browser-based results.",
  },
  {
    slug: "converters",
    title: "Converters",
    shortTitle: "Converter",
    description: "Unit and number converters for quick, accurate transformations.",
  },
  {
    slug: "seo-tools",
    title: "SEO & Text Tools",
    shortTitle: "SEO Tool",
    description: "Writing, optimization, formatting, and text productivity utilities.",
  },
  {
    slug: "image-tools",
    title: "Image Tools",
    shortTitle: "Image Tool",
    description: "Client-side image and color tools with privacy-friendly workflows.",
  },
  {
    slug: "developer-tools",
    title: "Developer Tools",
    shortTitle: "Developer Tool",
    description: "Practical tools for debugging, formatting, encoding, and diagnostics.",
  },
  {
    slug: "productivity-tools",
    title: "Productivity Tools",
    shortTitle: "Productivity Tool",
    description: "Lightweight utilities for focus, note taking, and daily execution.",
  },
];

const categoryLookup = new Map(CATEGORIES.map((category) => [category.slug, category]));

export function getCategories(): ToolCategory[] {
  return [...CATEGORIES];
}

export function getCategory(slug: string): ToolCategory | null {
  return categoryLookup.get(slug as ToolCategorySlug) ?? null;
}

export function orderedCategorySlugs(): ToolCategorySlug[] {
  return [...CATEGORY_ORDER];
}
