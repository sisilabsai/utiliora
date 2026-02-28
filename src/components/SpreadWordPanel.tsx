"use client";

import { useState } from "react";
import { Copy, Mail, MessageCircle, Share2 } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

interface SpreadWordPanelProps {
  title?: string;
  description?: string;
  shareUrl: string;
  shareText: string;
  eventContext: string;
}

export function SpreadWordPanel({
  title = "Help Us Spread the Word",
  description = "If Utiliora saves you time, share it with a friend, team, or community.",
  shareUrl,
  shareText,
  eventContext,
}: SpreadWordPanelProps) {
  const [status, setStatus] = useState("");
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
      setStatus("Link copied.");
      trackEvent("spread_word_copy_link", { context: eventContext });
    } catch {
      setStatus("Could not copy link.");
    }
  };

  return (
    <section className="mini-panel spread-panel" aria-label="Spread the word">
      <h3>{title}</h3>
      <p className="supporting-text">{description}</p>
      <div className="button-row">
        <button className="action-button secondary" type="button" onClick={() => void copyLink()}>
          <Copy size={15} />
          Copy link
        </button>
        <a
          className="action-button secondary"
          href={xHref}
          target="_blank"
          rel="noreferrer"
          onClick={() => trackEvent("spread_word_share", { context: eventContext, channel: "x" })}
        >
          <Share2 size={15} />
          Share on X
        </a>
        <a
          className="action-button secondary"
          href={linkedInHref}
          target="_blank"
          rel="noreferrer"
          onClick={() => trackEvent("spread_word_share", { context: eventContext, channel: "linkedin" })}
        >
          <Share2 size={15} />
          LinkedIn
        </a>
        <a
          className="action-button secondary"
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          onClick={() => trackEvent("spread_word_share", { context: eventContext, channel: "whatsapp" })}
        >
          <MessageCircle size={15} />
          WhatsApp
        </a>
        <a
          className="action-button secondary"
          href={mailHref}
          onClick={() => trackEvent("spread_word_share", { context: eventContext, channel: "email" })}
        >
          <Mail size={15} />
          Email
        </a>
      </div>
      {status ? <p className="supporting-text">{status}</p> : null}
    </section>
  );
}
