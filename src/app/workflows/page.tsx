import type { Metadata } from "next";
import { WorkflowBundleCard } from "@/components/WorkflowBundleCard";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { getWorkflowBundles } from "@/lib/growth";

export const metadata: Metadata = {
  title: "Workflows",
  description:
    "Browse guided workflows for website launches, creator assets, freelancer ops, money clarity, and job applications.",
  alternates: {
    canonical: "/workflows",
  },
  openGraph: {
    title: `Workflows | ${SITE_NAME}`,
    description:
      "Browse guided workflows for website launches, creator assets, freelancer ops, money clarity, and job applications.",
    url: absoluteUrl("/workflows"),
    type: "website",
  },
};

export default function WorkflowsPage() {
  const bundles = getWorkflowBundles();

  return (
    <div className="site-container page-stack">
      <section className="hero">
        <p className="eyebrow">Guided workflows</p>
        <h1>Finish common jobs with the right tools in the right order</h1>
        <p>
          These pages group related tools into practical workflows so you can move from one step to the next without
          guessing what to use next.
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
