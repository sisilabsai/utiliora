import type { Metadata } from "next";
import { ToolCard } from "@/components/ToolCard";
import { ToolSearch } from "@/components/ToolSearch";
import { getAllTools } from "@/lib/tools";

export const metadata: Metadata = {
  title: "All Tools",
  description: "Browse the full Utiliora tool library across calculators, converters, SEO, image, and developer tools.",
  alternates: {
    canonical: "/tools",
  },
};

export default function AllToolsPage() {
  const tools = getAllTools();
  return (
    <div className="site-container page-stack">
      <section>
        <p className="eyebrow">Tool directory</p>
        <h1>All Utiliora tools</h1>
        <p>Use search to jump directly to the utility you need.</p>
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
