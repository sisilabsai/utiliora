import { getCategory } from "@/lib/categories";
import type { ToolDefinition } from "@/lib/types";
import { CategoryIcon } from "@/components/CategoryIcon";

interface ToolCardProps {
  tool: ToolDefinition;
}

export function ToolCard({ tool }: ToolCardProps) {
  const category = getCategory(tool.category);

  return (
    <article className="tool-card">
      <div className="tool-card-meta">
        <CategoryIcon category={tool.category} size={14} />
        <span>{category?.shortTitle ?? "Tool"}</span>
      </div>
      <h3 className="tool-card-title">
        <a href={`/${tool.category}/${tool.slug}`}>{tool.title}</a>
      </h3>
      <p className="tool-card-summary">{tool.summary}</p>
      <a className="tool-card-link" href={`/${tool.category}/${tool.slug}`}>
        Open tool
      </a>
    </article>
  );
}
