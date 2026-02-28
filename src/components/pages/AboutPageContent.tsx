"use client";

import { SpreadWordPanel } from "@/components/SpreadWordPanel";
import { useLocale } from "@/components/LocaleProvider";

export function AboutPageContent() {
  const { t } = useLocale();

  return (
    <div className="site-container page-stack info-page">
      <section className="hero info-hero">
        <p className="eyebrow">{t("about.eyebrow", undefined, "About Utiliora")}</p>
        <h1>{t("about.title", undefined, "Simple tools, fast workflows, clear outcomes.")}</h1>
        <p>
          {t(
            "about.desc",
            undefined,
            "Utiliora is built for people who need practical online tools without friction. We focus on speed, reliability, and a clean experience across desktop and mobile.",
          )}
        </p>
      </section>

      <section className="info-grid" aria-label={t("about.eyebrow", undefined, "About Utiliora")}>
        <article className="content-block info-card">
          <h2>{t("about.mission_title", undefined, "Our mission")}</h2>
          <p>
            {t(
              "about.mission_desc",
              undefined,
              "Make everyday digital tasks easier for everyone by offering high-quality utility tools that work instantly in the browser.",
            )}
          </p>
        </article>
        <article className="content-block info-card">
          <h2>{t("about.values_title", undefined, "What we value")}</h2>
          <p>
            {t(
              "about.values_desc",
              undefined,
              "Practical design, trustworthy outputs, and transparent behavior. We build features that save time and keep complexity low.",
            )}
          </p>
        </article>
        <article className="content-block info-card">
          <h2>{t("about.privacy_title", undefined, "Privacy-first by design")}</h2>
          <p>
            {t(
              "about.privacy_desc",
              undefined,
              "Most tools run client-side whenever possible. You stay in control of your data while working across the platform.",
            )}
          </p>
        </article>
      </section>

      <section className="content-block">
        <h2>{t("about.why_title", undefined, "Why people use Utiliora")}</h2>
        <ul className="plain-list">
          <li>{t("about.why_1", undefined, "Fast tools for calculators, file workflows, SEO, developer tasks, and productivity.")}</li>
          <li>{t("about.why_2", undefined, "No forced account flow for core usage.")}</li>
          <li>{t("about.why_3", undefined, "Mobile-ready interface that keeps sessions efficient on any device.")}</li>
          <li>{t("about.why_4", undefined, "Continuous updates based on real workflow demand.")}</li>
        </ul>
      </section>

      <SpreadWordPanel
        eventContext="about-page"
        shareUrl="https://utiliora.cloud/about"
        shareText={t("about.share_text", undefined, "I use Utiliora for fast online tools without login friction.")}
      />
    </div>
  );
}
