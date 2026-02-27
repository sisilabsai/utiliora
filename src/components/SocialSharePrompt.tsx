"use client";

import { Copy, ExternalLink, Share2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import {
  DEFAULT_SOCIAL_SHARE_PROFILE,
  SHARE_AFTER_SUCCESS_COOLDOWN_MS,
  SHARE_DISMISS_COOLDOWN_MS,
  SHARE_PROMPT_COOLDOWN_MS,
  SHARE_PROMPT_SUCCESS_THRESHOLD,
  SHARE_SIGNAL_EVENT,
  type ShareSignalDetail,
  type SocialShareProfile,
  getShareSignalScore,
  readSocialShareProfile,
  writeSocialShareProfile,
} from "@/lib/social-share";

const SHARE_SESSION_PROMPT_PREFIX = "utiliora-social-share-session";

interface SocialSharePromptProps {
  toolTitle: string;
  toolSlug: string;
  toolPath: string;
}

function buildShareMessage(toolTitle: string, detail: ShareSignalDetail | null): string {
  if (detail?.context === "background-remover") {
    return "I removed an image background in seconds with Utiliora.";
  }
  if (detail?.action === "download") {
    return `I just finished a task in ${toolTitle} on Utiliora.`;
  }
  if (detail?.action === "success") {
    return `${toolTitle} on Utiliora worked really well for me.`;
  }
  return `Helpful tool I used on Utiliora: ${toolTitle}.`;
}

function readSessionPromptSeen(sessionKey: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(sessionKey) === "1";
  } catch {
    return false;
  }
}

function writeSessionPromptSeen(sessionKey: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(sessionKey, "1");
  } catch {
    // Ignore session storage failures.
  }
}

function shouldShowPrompt(profile: SocialShareProfile, now: number): boolean {
  if (profile.successScore < SHARE_PROMPT_SUCCESS_THRESHOLD) return false;
  if (profile.dismissedUntil > now) return false;
  if (profile.lastSharedAt && now - profile.lastSharedAt < SHARE_AFTER_SUCCESS_COOLDOWN_MS) return false;
  if (profile.lastPromptAt && now - profile.lastPromptAt < SHARE_PROMPT_COOLDOWN_MS) return false;
  return true;
}

export function SocialSharePrompt({ toolTitle, toolSlug, toolPath }: SocialSharePromptProps) {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [lastSignal, setLastSignal] = useState<ShareSignalDetail | null>(null);
  const profileRef = useRef<SocialShareProfile>(DEFAULT_SOCIAL_SHARE_PROFILE);
  const sessionKey = `${SHARE_SESSION_PROMPT_PREFIX}:${toolSlug}`;

  useEffect(() => {
    profileRef.current = readSocialShareProfile();
  }, []);

  const buildShareUrl = useCallback((channel: string) => {
    if (typeof window === "undefined") return "";
    const url = new URL(toolPath, window.location.origin);
    url.searchParams.set("utm_source", channel);
    url.searchParams.set("utm_medium", "social");
    url.searchParams.set("utm_campaign", "user_share");
    return url.toString();
  }, [toolPath]);

  const shareText = useMemo(() => buildShareMessage(toolTitle, lastSignal), [lastSignal, toolTitle]);

  const markShared = useCallback((channel: string) => {
    const now = Date.now();
    const nextProfile: SocialShareProfile = {
      ...profileRef.current,
      successScore: 0,
      lastSharedAt: now,
      lastPromptAt: now,
      dismissedUntil: now + SHARE_AFTER_SUCCESS_COOLDOWN_MS,
    };
    profileRef.current = nextProfile;
    writeSocialShareProfile(nextProfile);
    writeSessionPromptSeen(sessionKey);
    setAcknowledged(true);
    setExpanded(false);
    setCopyStatus("");
    trackEvent("social_share_completed", { channel, tool: toolSlug });
    window.setTimeout(() => setVisible(false), 2600);
  }, [sessionKey, toolSlug]);

  const dismissPrompt = useCallback(() => {
    const now = Date.now();
    const nextProfile: SocialShareProfile = {
      ...profileRef.current,
      lastDismissedAt: now,
      lastPromptAt: now,
      dismissedUntil: now + SHARE_DISMISS_COOLDOWN_MS,
    };
    profileRef.current = nextProfile;
    writeSocialShareProfile(nextProfile);
    writeSessionPromptSeen(sessionKey);
    setVisible(false);
    setExpanded(false);
    setAcknowledged(false);
    setCopyStatus("");
    trackEvent("social_share_prompt_dismissed", { tool: toolSlug });
  }, [sessionKey, toolSlug]);

  const copyShareLink = useCallback(async () => {
    const url = buildShareUrl("copy_link");
    const payload = `${shareText} ${url}`;
    try {
      await navigator.clipboard.writeText(payload);
      setCopyStatus("Share text copied.");
      markShared("copy_link");
    } catch {
      setCopyStatus("Could not copy. Use the share links below.");
    }
  }, [buildShareUrl, markShared, shareText]);

  const tryNativeShare = useCallback(async () => {
    const url = buildShareUrl("native_share");
    if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
      setExpanded(true);
      return;
    }

    try {
      await navigator.share({
        title: `${toolTitle} | Utiliora`,
        text: shareText,
        url,
      });
      markShared("native_share");
    } catch {
      setExpanded(true);
    }
  }, [buildShareUrl, markShared, shareText, toolTitle]);

  useEffect(() => {
    const onSignal = (event: Event) => {
      const detail = (event as CustomEvent<ShareSignalDetail>).detail;
      if (!detail || !detail.action) return;
      const now = Date.now();
      const nextProfile: SocialShareProfile = {
        ...profileRef.current,
        successScore: Math.min(20, profileRef.current.successScore + getShareSignalScore(detail.action)),
      };
      profileRef.current = nextProfile;
      writeSocialShareProfile(nextProfile);
      setLastSignal(detail);

      if (visible || acknowledged || readSessionPromptSeen(sessionKey)) return;
      if (!shouldShowPrompt(nextProfile, now)) return;

      const promptedProfile: SocialShareProfile = {
        ...nextProfile,
        lastPromptAt: now,
      };
      profileRef.current = promptedProfile;
      writeSocialShareProfile(promptedProfile);
      writeSessionPromptSeen(sessionKey);
      setAcknowledged(false);
      setExpanded(false);
      setCopyStatus("");
      setVisible(true);
      trackEvent("social_share_prompt_shown", { tool: toolSlug, action: detail.action });
    };

    window.addEventListener(SHARE_SIGNAL_EVENT, onSignal as EventListener);
    return () => window.removeEventListener(SHARE_SIGNAL_EVENT, onSignal as EventListener);
  }, [acknowledged, sessionKey, toolSlug, visible]);

  if (!visible) return null;

  const xUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(`${shareText} ${buildShareUrl("x")}`)}`;
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(buildShareUrl("linkedin"))}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${buildShareUrl("whatsapp")}`)}`;

  return (
    <aside className="share-toast" aria-live="polite">
      <p className="share-toast-title">{acknowledged ? "Thanks for sharing Utiliora." : "Was this useful?"}</p>
      <p className="supporting-text">
        {acknowledged ? "You helped more people discover these tools." : "If this helped, share it with your friends and team."}
      </p>

      {acknowledged ? null : (
        <div className="button-row">
          <button className="action-button" type="button" onClick={() => void tryNativeShare()}>
            <Share2 size={15} />
            Share
          </button>
          <button className="action-button secondary" type="button" onClick={dismissPrompt}>
            Not now
          </button>
        </div>
      )}

      {expanded && !acknowledged ? (
        <div className="share-channel-grid">
          <button className="action-button secondary" type="button" onClick={() => void copyShareLink()}>
            <Copy size={15} />
            Copy message
          </button>
          <a className="action-button secondary" href={xUrl} target="_blank" rel="noreferrer" onClick={() => markShared("x")}>
            <ExternalLink size={15} />
            X
          </a>
          <a
            className="action-button secondary"
            href={linkedInUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => markShared("linkedin")}
          >
            <ExternalLink size={15} />
            LinkedIn
          </a>
          <a
            className="action-button secondary"
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => markShared("whatsapp")}
          >
            <ExternalLink size={15} />
            WhatsApp
          </a>
        </div>
      ) : null}
      {copyStatus ? <p className="supporting-text">{copyStatus}</p> : null}
    </aside>
  );
}
