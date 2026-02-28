"use client";

import { ToolCard } from "@/components/ToolCard";
import { ToolSearch } from "@/components/ToolSearch";
import { useLocale } from "@/components/LocaleProvider";
import type { ToolDefinition } from "@/lib/types";

interface ToolsDirectoryContentProps {
  tools: ToolDefinition[];
}

export function ToolsDirectoryContent({ tools }: ToolsDirectoryContentProps) {
  const { t } = useLocale();

  return (
    <div className="site-container page-stack">
      <section>
        <p className="eyebrow">{t("all_tools.eyebrow", undefined, "Tool directory")}</p>
        <h1>{t("all_tools.title", undefined, "All Utiliora tools")}</h1>
        <p>{t("all_tools.desc", undefined, "Use search to jump directly to the utility you need.")}</p>
      </section>
      <ToolSearch tools={tools} />
      <section className="tool-grid">
        {tools.map((tool) => (
          <ToolCard key={`${tool.category}-${tool.slug}`} tool={tool} />
        ))}
      </section>
    </div>
  );
}
