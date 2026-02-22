import Link from "next/link";
import type { ToolDefinition } from "@/lib/types";

interface RelatedToolsProps {
  tools: ToolDefinition[];
}

export function RelatedTools({ tools }: RelatedToolsProps) {
  if (!tools.length) return null;

  return (
    <section className="related-tools">
      <h2>Related tools</h2>
      <ul>
        {tools.map((tool) => (
          <li key={`${tool.category}-${tool.slug}`}>
            <Link href={`/${tool.category}/${tool.slug}`}>{tool.title}</Link>
            <p>{tool.summary}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
