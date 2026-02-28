import type { Metadata } from "next";
import { SpreadWordPanel } from "@/components/SpreadWordPanel";

export const metadata: Metadata = {
  title: "Contact Utiliora",
  description:
    "Contact Utiliora through email or social channels. Reach us for support, product feedback, and partnership conversations.",
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: "Contact Utiliora",
    description:
      "Contact Utiliora through email or social channels. Reach us for support, product feedback, and partnership conversations.",
    url: "https://utiliora.cloud/contact",
    type: "website",
    siteName: "Utiliora",
  },
};

export default function ContactPage() {
  const contactSchema = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: "Utiliora Contact",
    url: "https://utiliora.cloud/contact",
    mainEntity: {
      "@type": "Organization",
      name: "Utiliora",
      email: "hello@utiliora.cloud",
    },
  };

  return (
    <div className="site-container page-stack info-page">
      <section className="hero info-hero">
        <p className="eyebrow">Contact</p>
        <h1>Reach the Utiliora team</h1>
        <p>
          For support requests, feedback, or partnership discussions, use email or social channels below. We review
          messages regularly and prioritize product-impact conversations.
        </p>
      </section>

      <section className="info-grid" aria-label="Contact channels">
        <article className="content-block info-card">
          <h2>Email</h2>
          <p>
            <a href="mailto:hello@utiliora.cloud">hello@utiliora.cloud</a>
          </p>
          <p className="supporting-text">Best for product feedback, support requests, and collaboration inquiries.</p>
        </article>
        <article className="content-block info-card">
          <h2>Social channels</h2>
          <ul className="plain-list">
            <li>
              <a href="https://x.com/utilioracloud" target="_blank" rel="noreferrer">
                X / Twitter
              </a>
            </li>
            <li>
              <a href="https://www.threads.com/@utilioracloud" target="_blank" rel="noreferrer">
                Threads
              </a>
            </li>
            <li>
              <a href="https://www.youtube.com/@utiliora" target="_blank" rel="noreferrer">
                YouTube
              </a>
            </li>
          </ul>
        </article>
        <article className="content-block info-card">
          <h2>Useful links</h2>
          <ul className="plain-list">
            <li>
              <a href="/tools">Browse all tools</a>
            </li>
            <li>
              <a href="/about">About Utiliora</a>
            </li>
            <li>
              <a href="/privacy">Privacy policy</a>
            </li>
            <li>
              <a href="/terms">Terms of use</a>
            </li>
          </ul>
        </article>
      </section>

      <SpreadWordPanel
        eventContext="contact-page"
        shareUrl="https://utiliora.cloud/contact"
        shareText="Utiliora has fast, practical tools. Sharing in case it helps your workflow."
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactSchema) }}
      />
    </div>
  );
}
