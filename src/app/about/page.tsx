import type { Metadata } from "next";
import { SpreadWordPanel } from "@/components/SpreadWordPanel";

export const metadata: Metadata = {
  title: "About Utiliora",
  description:
    "Learn about Utiliora, our mission, privacy-first principles, and how we build fast utility tools for everyone.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "About Utiliora",
    description:
      "Learn about Utiliora, our mission, privacy-first principles, and how we build fast utility tools for everyone.",
    url: "https://utiliora.cloud/about",
    type: "website",
    siteName: "Utiliora",
  },
};

export default function AboutPage() {
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Utiliora",
    url: "https://utiliora.cloud",
    email: "hello@utiliora.cloud",
    sameAs: [
      "https://x.com/utilioracloud",
      "https://www.threads.com/@utilioracloud",
      "https://www.youtube.com/@utiliora",
    ],
  };

  return (
    <div className="site-container page-stack info-page">
      <section className="hero info-hero">
        <p className="eyebrow">About Utiliora</p>
        <h1>Simple tools, fast workflows, clear outcomes.</h1>
        <p>
          Utiliora is built for people who need practical online tools without friction. We focus on speed,
          reliability, and a clean experience across desktop and mobile.
        </p>
      </section>

      <section className="info-grid" aria-label="About highlights">
        <article className="content-block info-card">
          <h2>Our mission</h2>
          <p>
            Make everyday digital tasks easier for everyone by offering high-quality utility tools that work instantly
            in the browser.
          </p>
        </article>
        <article className="content-block info-card">
          <h2>What we value</h2>
          <p>
            Practical design, trustworthy outputs, and transparent behavior. We build features that save time and keep
            complexity low.
          </p>
        </article>
        <article className="content-block info-card">
          <h2>Privacy-first by design</h2>
          <p>
            Most tools run client-side whenever possible. You stay in control of your data while working across the
            platform.
          </p>
        </article>
      </section>

      <section className="content-block">
        <h2>Why people use Utiliora</h2>
        <ul className="plain-list">
          <li>Fast tools for calculators, file workflows, SEO, developer tasks, and productivity.</li>
          <li>No forced account flow for core usage.</li>
          <li>Mobile-ready interface that keeps sessions efficient on any device.</li>
          <li>Continuous updates based on real workflow demand.</li>
        </ul>
      </section>

      <SpreadWordPanel
        eventContext="about-page"
        shareUrl="https://utiliora.cloud/about"
        shareText="I use Utiliora for fast online tools without login friction."
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
    </div>
  );
}
