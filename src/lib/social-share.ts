export type ShareSignalAction = "success" | "download" | "copy";

export interface ShareSignalDetail {
  action: ShareSignalAction;
  context?: string;
}

export interface SocialShareProfile {
  successScore: number;
  lastPromptAt: number;
  dismissedUntil: number;
  lastDismissedAt: number;
  lastSharedAt: number;
}

export const SHARE_SIGNAL_EVENT = "utiliora:share-signal";
export const SOCIAL_SHARE_PROFILE_STORAGE_KEY = "utiliora-social-share-profile-v1";

export const DAY_MS = 24 * 60 * 60 * 1000;
export const SHARE_PROMPT_SUCCESS_THRESHOLD = 2;
export const SHARE_PROMPT_COOLDOWN_MS = 7 * DAY_MS;
export const SHARE_DISMISS_COOLDOWN_MS = 30 * DAY_MS;
export const SHARE_AFTER_SUCCESS_COOLDOWN_MS = 90 * DAY_MS;

export const DEFAULT_SOCIAL_SHARE_PROFILE: SocialShareProfile = {
  successScore: 0,
  lastPromptAt: 0,
  dismissedUntil: 0,
  lastDismissedAt: 0,
  lastSharedAt: 0,
};

export function readSocialShareProfile(): SocialShareProfile {
  if (typeof window === "undefined") return DEFAULT_SOCIAL_SHARE_PROFILE;
  try {
    const raw = window.localStorage.getItem(SOCIAL_SHARE_PROFILE_STORAGE_KEY);
    if (!raw) return DEFAULT_SOCIAL_SHARE_PROFILE;
    const parsed = JSON.parse(raw) as Partial<SocialShareProfile> | null;
    if (!parsed || typeof parsed !== "object") return DEFAULT_SOCIAL_SHARE_PROFILE;
    return {
      successScore: Number.isFinite(parsed.successScore) ? Math.max(0, Number(parsed.successScore)) : 0,
      lastPromptAt: Number.isFinite(parsed.lastPromptAt) ? Math.max(0, Number(parsed.lastPromptAt)) : 0,
      dismissedUntil: Number.isFinite(parsed.dismissedUntil) ? Math.max(0, Number(parsed.dismissedUntil)) : 0,
      lastDismissedAt: Number.isFinite(parsed.lastDismissedAt) ? Math.max(0, Number(parsed.lastDismissedAt)) : 0,
      lastSharedAt: Number.isFinite(parsed.lastSharedAt) ? Math.max(0, Number(parsed.lastSharedAt)) : 0,
    };
  } catch {
    return DEFAULT_SOCIAL_SHARE_PROFILE;
  }
}

export function writeSocialShareProfile(profile: SocialShareProfile): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SOCIAL_SHARE_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore local storage failures.
  }
}

export function getShareSignalScore(action: ShareSignalAction): number {
  if (action === "success") return 1;
  if (action === "download") return 1;
  return 0.35;
}

export function emitShareSignal(detail: ShareSignalDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ShareSignalDetail>(SHARE_SIGNAL_EVENT, { detail }));
}
