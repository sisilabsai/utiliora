import type { Metadata } from "next";
import { WorkflowBundleCard } from "@/components/WorkflowBundleCard";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { getWorkflowBundles } from "@/lib/growth";

export const metadata: Metadata = {
  title: "Workflow Bundles",
  description:
    "Browse guided multi-tool workflows for website launches, creator assets, freelancer ops, money clarity, and job applications.",
  alternates: {
    canonical: "/workflows",
  },
  openGraph: {
    title: `Workflow Bundles | ${SITE_NAME}`,
    description:
      "Browse guided multi-tool workflows for website launches, creator assets, freelancer ops, money clarity, and job applications.",
    url: absoluteUrl("/workflows"),
    type: "website",
  },
};

export default function WorkflowsPage() {
  const bundles = getWorkflowBundles();

  return (
    <div className="site-container page-stack">
      <section className="hero">
        <p className="eyebrow">Workflow bundles</p>
        <h1>Start with a complete job, not a random tool</h1>
        <p>
          These bundle pages group tools into practical outcomes so visitors can move from one task to the next without
          guessing where to go.
        </p>
      </section>

      <section className="workflow-grid">
        {bundles.map((bundle) => (
          <WorkflowBundleCard key={bundle.slug} bundle={bundle} />
        ))}
      </section>
    </div>
  );
}
