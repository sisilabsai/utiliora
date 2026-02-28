"use client";

import { SpreadWordPanel } from "@/components/SpreadWordPanel";
import { useLocale } from "@/components/LocaleProvider";

export function ContactPageContent() {
  const { t } = useLocale();

  return (
    <div className="site-container page-stack info-page">
      <section className="hero info-hero">
        <p className="eyebrow">{t("contact.eyebrow", undefined, "Contact")}</p>
        <h1>{t("contact.title", undefined, "Reach the Utiliora team")}</h1>
        <p>
          {t(
            "contact.desc",
            undefined,
            "For support requests, feedback, or partnership discussions, use email or social channels below. We review messages regularly and prioritize product-impact conversations.",
          )}
        </p>
      </section>

      <section className="info-grid" aria-label={t("contact.eyebrow", undefined, "Contact")}>
        <article className="content-block info-card">
          <h2>{t("contact.email_title", undefined, "Email")}</h2>
          <p>
            <a href="mailto:hello@utiliora.cloud">hello@utiliora.cloud</a>
          </p>
          <p className="supporting-text">
            {t("contact.email_desc", undefined, "Best for product feedback, support requests, and collaboration inquiries.")}
          </p>
        </article>
        <article className="content-block info-card">
          <h2>{t("contact.social_title", undefined, "Social channels")}</h2>
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
          <h2>{t("contact.links_title", undefined, "Useful links")}</h2>
          <ul className="plain-list">
            <li>
              <a href="/tools">{t("contact.links_tools", undefined, "Browse all tools")}</a>
            </li>
            <li>
              <a href="/about">{t("contact.links_about", undefined, "About Utiliora")}</a>
            </li>
            <li>
              <a href="/privacy">{t("contact.links_privacy", undefined, "Privacy policy")}</a>
            </li>
            <li>
              <a href="/terms">{t("contact.links_terms", undefined, "Terms of use")}</a>
            </li>
          </ul>
        </article>
      </section>

      <SpreadWordPanel
        eventContext="contact-page"
        shareUrl="https://utiliora.cloud/contact"
        shareText={t(
          "contact.share_text",
          undefined,
          "Utiliora has fast, practical tools. Sharing in case it helps your workflow.",
        )}
      />
    </div>
  );
}
