import Link from "next/link";
import { getCategory } from "@/lib/categories";
import type { ToolDefinition } from "@/lib/types";

interface ToolCardProps {
  tool: ToolDefinition;
}

export function ToolCard({ tool }: ToolCardProps) {
  const category = getCategory(tool.category);

  return (
    <article className="tool-card">
      <div className="tool-card-meta">{category?.shortTitle ?? "Tool"}</div>
      <h3 className="tool-card-title">
        <Link href={`/${tool.category}/${tool.slug}`}>{tool.title}</Link>
      </h3>
      <p className="tool-card-summary">{tool.summary}</p>
      <Link className="tool-card-link" href={`/${tool.category}/${tool.slug}`}>
        Open tool
      </Link>
    </article>
  );
}
