"use client";

import { useLocale } from "@/components/LocaleProvider";
import type { ResolvedWorkflowBundle } from "@/lib/growth";

interface WorkflowBundleCardProps {
  bundle: ResolvedWorkflowBundle;
  href?: string;
}

export function WorkflowBundleCard({ bundle, href = `/workflows/${bundle.slug}` }: WorkflowBundleCardProps) {
  const { t } = useLocale();

  return (
    <article className="workflow-card">
      <div className="workflow-card-head">
        <p className="eyebrow">{t("home.bundle_label", undefined, "Workflow bundle")}</p>
        <h3>
          <a href={href}>{bundle.title}</a>
        </h3>
      </div>
      <p>{bundle.summary}</p>
      <p className="workflow-card-outcome">
        <strong>{t("home.bundle_outcome", undefined, "Outcome")}:</strong> {bundle.outcome}
      </p>
      <div className="chip-row">
        {bundle.tools.map((tool) => (
          <a key={`${tool.category}-${tool.slug}`} className="chip-link" href={`/${tool.category}/${tool.slug}`}>
            {tool.title}
          </a>
        ))}
      </div>
      <a className="tool-card-link" href={href}>
        {t("home.bundle_cta", undefined, "Open workflow")}
      </a>
    </article>
  );
}
