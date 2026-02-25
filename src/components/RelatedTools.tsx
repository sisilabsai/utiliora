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
            <a className="related-tool-link" href={`/${tool.category}/${tool.slug}`}>
              <strong>{tool.title}</strong>
              <p>{tool.summary}</p>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
