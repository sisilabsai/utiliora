"use client";

import { useState } from "react";
import { Copy, Mail, MessageCircle, Share2 } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { trackEvent } from "@/lib/analytics";

interface SpreadWordPanelProps {
  title?: string;
  description?: string;
  shareUrl: string;
  shareText: string;
  eventContext: string;
}

export function SpreadWordPanel({
  title,
  description,
  shareUrl,
  shareText,
  eventContext,
}: SpreadWordPanelProps) {
  const { t } = useLocale();
  const [status, setStatus] = useState("");
  const resolvedTitle = title ?? t("spread.title", undefined, "Help Us Spread the Word");
  const resolvedDescription =
    description ?? t("spread.description", undefined, "If Utiliora saves you time, share it with a friend, team, or community.");
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(shareText);
  const xHref = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
  const linkedInHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
  const whatsappHref = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;
  const mailHref = `mailto:?subject=${encodeURIComponent("Try Utiliora tools")}&body=${encodeURIComponent(
    `${shareText}\n\n${shareUrl}`,
  )}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setStatus(t("spread.link_copied", undefined, "Link copied."));
      trackEvent("spread_word_copy_link", { context: eventContext });
    } catch {
      setStatus(t("spread.copy_failed", undefined, "Could not copy link."));
    }
  };

  return (
    <section className="mini-panel spread-panel" aria-label={t("spread.aria", undefined, "Spread the word")}>
      <h3>{resolvedTitle}</h3>
      <p className="supporting-text">{resolvedDescription}</p>
      <div className="button-row">
        <button className="action-button secondary" type="button" onClick={() => void copyLink()}>
          <Copy size={15} />
          {t("spread.copy_link", undefined, "Copy link")}
        </button>
        <a
          className="action-button secondary"
          href={xHref}
          target="_blank"
          rel="noreferrer"
          onClick={() => trackEvent("spread_word_share", { context: eventContext, channel: "x" })}
        >
          <Share2 size={15} />
          {t("spread.share_x", undefined, "Share on X")}
        </a>
        <a
          className="action-button secondary"
          href={linkedInHref}
          target="_blank"
          rel="noreferrer"
          onClick={() => trackEvent("spread_word_share", { context: eventContext, channel: "linkedin" })}
        >
          <Share2 size={15} />
          {t("spread.linkedin", undefined, "LinkedIn")}
        </a>
        <a
          className="action-button secondary"
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          onClick={() => trackEvent("spread_word_share", { context: eventContext, channel: "whatsapp" })}
        >
          <MessageCircle size={15} />
          {t("spread.whatsapp", undefined, "WhatsApp")}
        </a>
        <a
          className="action-button secondary"
          href={mailHref}
          onClick={() => trackEvent("spread_word_share", { context: eventContext, channel: "email" })}
        >
          <Mail size={15} />
          {t("spread.email", undefined, "Email")}
        </a>
      </div>
      {status ? <p className="supporting-text">{status}</p> : null}
    </section>
  );
}
