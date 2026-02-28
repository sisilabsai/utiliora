"use client";

import { getCategory } from "@/lib/categories";
import { useLocale } from "@/components/LocaleProvider";
import type { ToolDefinition } from "@/lib/types";
import { CategoryIcon } from "@/components/CategoryIcon";

interface ToolCardProps {
  tool: ToolDefinition;
}

export function ToolCard({ tool }: ToolCardProps) {
  const { t } = useLocale();
  const category = getCategory(tool.category);
  const categoryShort = category
    ? t(`category.${category.slug}.short`, undefined, category.shortTitle)
    : t("tool_card.tool", undefined, "Tool");

  return (
    <article className="tool-card">
      <div className="tool-card-meta">
        <CategoryIcon category={tool.category} size={14} />
        <span>{categoryShort}</span>
      </div>
      <h3 className="tool-card-title">
        <a href={`/${tool.category}/${tool.slug}`}>{tool.title}</a>
      </h3>
      <p className="tool-card-summary">{tool.summary}</p>
      <a className="tool-card-link" href={`/${tool.category}/${tool.slug}`}>
        {t("tool_card.open_tool", undefined, "Open tool")}
      </a>
    </article>
  );
}
