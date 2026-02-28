"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

const NEWSLETTER_STATUS_KEY = "utiliora-newsletter-status-v1";
const NEWSLETTER_DISMISS_KEY = "utiliora-newsletter-dismissed-at-v1";
const DISMISS_COOLDOWN_MS = 1000 * 60 * 60 * 24 * 14;

interface SubscribeResponse {
  ok?: boolean;
  message?: string;
  error?: string;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value);
}

export function NewsletterSignup() {
  const pathname = usePathname();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState("Get practical growth updates and feature launches.");
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    try {
      const subscriptionStatus = localStorage.getItem(NEWSLETTER_STATUS_KEY);
      if (subscriptionStatus === "subscribed") {
        setIsVisible(false);
        return;
      }

      const dismissedAtRaw = localStorage.getItem(NEWSLETTER_DISMISS_KEY);
      const dismissedAt = dismissedAtRaw ? Number.parseInt(dismissedAtRaw, 10) : NaN;
      if (Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS) {
        setIsVisible(false);
      }
    } catch {
      // Ignore storage failures.
    }
  }, []);

  const canSubmit = useMemo(() => {
    const normalized = normalizeEmail(email);
    return isValidEmail(normalized) && !isSubmitting;
  }, [email, isSubmitting]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      setStatus("Enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    setStatus("Subscribing...");
    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizeEmail(email),
          source: "newsletter-form",
          pagePath: pathname || "/",
        }),
      });
      const payload = (await response.json()) as SubscribeResponse;
      if (!response.ok || !payload.ok) {
        setStatus(payload.error || "Subscription failed. Please try again.");
        return;
      }

      try {
        localStorage.setItem(NEWSLETTER_STATUS_KEY, "subscribed");
      } catch {
        // Ignore storage failures.
      }
      setStatus(payload.message || "Subscribed successfully.");
      setEmail("");
      setTimeout(() => setIsVisible(false), 900);
    } catch {
      setStatus("Subscription failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isVisible || pathname?.startsWith("/admin")) return null;

  return (
    <section className="newsletter-card" aria-label="Newsletter registration">
      <div className="newsletter-head">
        <p className="eyebrow">Newsletter</p>
        <button
          className="pwa-dismiss-button"
          type="button"
          aria-label="Dismiss newsletter form"
          onClick={() => {
            setIsVisible(false);
            try {
              localStorage.setItem(NEWSLETTER_DISMISS_KEY, String(Date.now()));
            } catch {
              // Ignore storage failures.
            }
          }}
        >
          x
        </button>
      </div>
      <h2>Stay ahead with Utiliora updates</h2>
      <p className="supporting-text">
        Weekly product launches, conversion experiments, and high-impact tool improvements.
      </p>
      <form className="newsletter-form" onSubmit={submit}>
        <label className="field">
          <span>Email address</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <button className="action-button" type="submit" disabled={!canSubmit}>
          {isSubmitting ? "Subscribing..." : "Join newsletter"}
        </button>
      </form>
      <p className="supporting-text">{status}</p>
    </section>
  );
}
