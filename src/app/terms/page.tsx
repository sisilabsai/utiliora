import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Utiliora terms of use for platform access, acceptable use, and limitation notices.",
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsPage() {
  const updatedOn = "February 28, 2026";

  return (
    <div className="site-container page-stack info-page">
      <section className="hero info-hero">
        <p className="eyebrow">Terms</p>
        <h1>Terms of Use</h1>
        <p>
          These terms govern access to and use of Utiliora. By using the platform, you agree to these terms. Last
          updated: {updatedOn}.
        </p>
      </section>

      <section className="content-block legal-block">
        <h2>1. Use of the platform</h2>
        <p>
          Utiliora provides utility tools for informational and workflow support purposes. You agree to use the
          platform lawfully and responsibly.
        </p>

        <h2>2. User responsibilities</h2>
        <ul className="plain-list">
          <li>Do not misuse services or attempt unauthorized access.</li>
          <li>Do not submit unlawful or harmful content.</li>
          <li>Verify outputs before using them for high-stakes decisions.</li>
        </ul>

        <h2>3. Tool output and warranties</h2>
        <p>
          Tools are provided on an “as is” basis without guarantees of fitness for a specific purpose. You are
          responsible for reviewing and validating generated output.
        </p>

        <h2>4. Third-party services</h2>
        <p>
          Certain features may rely on third-party services for processing, analytics, or advertising. Their terms and
          policies may apply independently.
        </p>

        <h2>5. Intellectual property</h2>
        <p>
          Platform branding, interface components, and original content are protected. Do not reproduce or redistribute
          proprietary assets without permission.
        </p>

        <h2>6. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, Utiliora is not liable for indirect or consequential damages arising
          from use of the platform.
        </p>

        <h2>7. Contact</h2>
        <p>
          For terms-related inquiries, contact <a href="mailto:hello@utiliora.cloud">hello@utiliora.cloud</a>.
        </p>
      </section>
    </div>
  );
}
