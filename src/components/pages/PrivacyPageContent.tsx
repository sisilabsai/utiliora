"use client";

import { useLocale } from "@/components/LocaleProvider";

interface PrivacyPageContentProps {
  updatedOn: string;
}

export function PrivacyPageContent({ updatedOn }: PrivacyPageContentProps) {
  const { t } = useLocale();

  return (
    <div className="site-container page-stack info-page">
      <section className="hero info-hero">
        <p className="eyebrow">{t("privacy.eyebrow", undefined, "Privacy")}</p>
        <h1>{t("privacy.title", undefined, "Privacy Policy")}</h1>
        <p>
          {t(
            "privacy.updated",
            { date: updatedOn },
            `This policy explains how Utiliora handles information across our tools and pages. Last updated: ${updatedOn}.`,
          )}
        </p>
      </section>

      <section className="content-block legal-block">
        <h2>{t("privacy.section_1_title", undefined, "1. Data processing approach")}</h2>
        <p>
          {t(
            "privacy.section_1_desc",
            undefined,
            "We design tools to process user inputs client-side whenever possible. Some features require server requests to complete network or API-based checks.",
          )}
        </p>

        <h2>{t("privacy.section_2_title", undefined, "2. Information we may receive")}</h2>
        <ul className="plain-list">
          <li>{t("privacy.section_2_item_1", undefined, "Tool inputs you submit for processing.")}</li>
          <li>{t("privacy.section_2_item_2", undefined, "Technical telemetry like browser metadata and performance data.")}</li>
          <li>{t("privacy.section_2_item_3", undefined, "Analytics and usage events used to improve product quality.")}</li>
        </ul>

        <h2>{t("privacy.section_3_title", undefined, "3. Cookies and analytics")}</h2>
        <p>
          {t(
            "privacy.section_3_desc",
            undefined,
            "We may use analytics and measurement technologies to understand feature usage and platform health. This helps us improve content quality and user experience.",
          )}
        </p>

        <h2>{t("privacy.section_4_title", undefined, "4. Advertising services")}</h2>
        <p>
          {t(
            "privacy.section_4_desc",
            undefined,
            "We may display ads through third-party networks such as Google AdSense. These partners may use cookies and similar technologies to deliver and measure relevant advertising according to their policies.",
          )}
        </p>

        <h2>{t("privacy.section_5_title", undefined, "5. Data sharing")}</h2>
        <p>
          {t(
            "privacy.section_5_desc",
            undefined,
            "We do not sell personal data. We may share limited operational data with trusted processors that support platform infrastructure, analytics, and security.",
          )}
        </p>

        <h2>{t("privacy.section_6_title", undefined, "6. Security")}</h2>
        <p>
          {t(
            "privacy.section_6_desc",
            undefined,
            "We use reasonable technical and operational safeguards. No system is perfectly secure, so please avoid submitting sensitive personal information into tools unless necessary.",
          )}
        </p>

        <h2>{t("privacy.section_7_title", undefined, "7. Contact")}</h2>
        <p>
          {t("privacy.section_7_desc", undefined, "For privacy questions, contact")}{" "}
          <a href="mailto:hello@utiliora.cloud">hello@utiliora.cloud</a>.
        </p>
      </section>
    </div>
  );
}
