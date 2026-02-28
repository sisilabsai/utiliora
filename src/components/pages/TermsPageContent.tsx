"use client";

import { useLocale } from "@/components/LocaleProvider";

interface TermsPageContentProps {
  updatedOn: string;
}

export function TermsPageContent({ updatedOn }: TermsPageContentProps) {
  const { t } = useLocale();

  return (
    <div className="site-container page-stack info-page">
      <section className="hero info-hero">
        <p className="eyebrow">{t("terms.eyebrow", undefined, "Terms")}</p>
        <h1>{t("terms.title", undefined, "Terms of Use")}</h1>
        <p>
          {t(
            "terms.updated",
            { date: updatedOn },
            `These terms govern access to and use of Utiliora. By using the platform, you agree to these terms. Last updated: ${updatedOn}.`,
          )}
        </p>
      </section>

      <section className="content-block legal-block">
        <h2>{t("terms.section_1_title", undefined, "1. Use of the platform")}</h2>
        <p>
          {t(
            "terms.section_1_desc",
            undefined,
            "Utiliora provides utility tools for informational and workflow support purposes. You agree to use the platform lawfully and responsibly.",
          )}
        </p>

        <h2>{t("terms.section_2_title", undefined, "2. User responsibilities")}</h2>
        <ul className="plain-list">
          <li>{t("terms.section_2_item_1", undefined, "Do not misuse services or attempt unauthorized access.")}</li>
          <li>{t("terms.section_2_item_2", undefined, "Do not submit unlawful or harmful content.")}</li>
          <li>{t("terms.section_2_item_3", undefined, "Verify outputs before using them for high-stakes decisions.")}</li>
        </ul>

        <h2>{t("terms.section_3_title", undefined, "3. Tool output and warranties")}</h2>
        <p>
          {t(
            "terms.section_3_desc",
            undefined,
            "Tools are provided on an 'as is' basis without guarantees of fitness for a specific purpose. You are responsible for reviewing and validating generated output.",
          )}
        </p>

        <h2>{t("terms.section_4_title", undefined, "4. Third-party services")}</h2>
        <p>
          {t(
            "terms.section_4_desc",
            undefined,
            "Certain features may rely on third-party services for processing, analytics, or advertising. Their terms and policies may apply independently.",
          )}
        </p>

        <h2>{t("terms.section_5_title", undefined, "5. Intellectual property")}</h2>
        <p>
          {t(
            "terms.section_5_desc",
            undefined,
            "Platform branding, interface components, and original content are protected. Do not reproduce or redistribute proprietary assets without permission.",
          )}
        </p>

        <h2>{t("terms.section_6_title", undefined, "6. Limitation of liability")}</h2>
        <p>
          {t(
            "terms.section_6_desc",
            undefined,
            "To the maximum extent permitted by law, Utiliora is not liable for indirect or consequential damages arising from use of the platform.",
          )}
        </p>

        <h2>{t("terms.section_7_title", undefined, "7. Contact")}</h2>
        <p>
          {t("terms.section_7_desc", undefined, "For terms-related inquiries, contact")}{" "}
          <a href="mailto:hello@utiliora.cloud">hello@utiliora.cloud</a>.
        </p>
      </section>
    </div>
  );
}
