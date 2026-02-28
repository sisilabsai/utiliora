"use client";

import { useMemo, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import type { ToolDefinition } from "@/lib/types";

interface ToolSearchProps {
  tools: ToolDefinition[];
}

export function ToolSearch({ tools }: ToolSearchProps) {
  const { t } = useLocale();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return tools.slice(0, 18);
    return tools
      .filter((tool) => {
        const haystack = `${tool.title} ${tool.summary} ${tool.keywords.join(" ")}`.toLowerCase();
        return haystack.includes(normalized);
      })
      .slice(0, 24);
  }, [query, tools]);

  return (
    <section className="search-panel" aria-label="Tool search">
      <label className="field-label" htmlFor="tool-search-input">
        {t("tool_search.label", undefined, "Search tools")}
      </label>
      <input
        id="tool-search-input"
        className="text-input"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("tool_search.placeholder", undefined, "Try: EMI, JSON, QR code, BMI...")}
      />
      <p className="supporting-text">
        {query
          ? t("tool_search.results_found", { count: results.length }, `${results.length} result(s) found.`)
          : t("tool_search.popular_tools", undefined, "Popular tools:")}
      </p>
      <ul className="search-results" role="list">
        {results.map((tool) => (
          <li key={`${tool.category}-${tool.slug}`}>
            <a href={`/${tool.category}/${tool.slug}`}>
              <span>{tool.title}</span>
              <small>{tool.summary}</small>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
