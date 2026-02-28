import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Utiliora privacy policy covering data handling, analytics, cookies, and user controls.",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPage() {
  const updatedOn = "February 28, 2026";

  return (
    <div className="site-container page-stack info-page">
      <section className="hero info-hero">
        <p className="eyebrow">Privacy</p>
        <h1>Privacy Policy</h1>
        <p>
          This policy explains how Utiliora handles information across our tools and pages. Last updated: {updatedOn}.
        </p>
      </section>

      <section className="content-block legal-block">
        <h2>1. Data processing approach</h2>
        <p>
          We design tools to process user inputs client-side whenever possible. Some features require server requests
          to complete network or API-based checks.
        </p>

        <h2>2. Information we may receive</h2>
        <ul className="plain-list">
          <li>Tool inputs you submit for processing.</li>
          <li>Technical telemetry like browser metadata and performance data.</li>
          <li>Analytics and usage events used to improve product quality.</li>
        </ul>

        <h2>3. Cookies and analytics</h2>
        <p>
          We may use analytics and measurement technologies to understand feature usage and platform health. This helps
          us improve content quality and user experience.
        </p>

        <h2>4. Advertising services</h2>
        <p>
          We may display ads through third-party networks such as Google AdSense. These partners may use cookies and
          similar technologies to deliver and measure relevant advertising according to their policies.
        </p>

        <h2>5. Data sharing</h2>
        <p>
          We do not sell personal data. We may share limited operational data with trusted processors that support
          platform infrastructure, analytics, and security.
        </p>

        <h2>6. Security</h2>
        <p>
          We use reasonable technical and operational safeguards. No system is perfectly secure, so please avoid
          submitting sensitive personal information into tools unless necessary.
        </p>

        <h2>7. Contact</h2>
        <p>
          For privacy questions, contact <a href="mailto:hello@utiliora.cloud">hello@utiliora.cloud</a>.
        </p>
      </section>
    </div>
  );
}
