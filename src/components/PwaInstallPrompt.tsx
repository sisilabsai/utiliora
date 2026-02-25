"use client";

import NextImage from "next/image";
import { Bell, Download, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type NotificationPermissionState = NotificationPermission | "unsupported";

const BANNER_DISMISS_UNTIL_KEY = "utiliora-pwa-banner-dismiss-until-v1";
const INSTALL_COMPLETED_KEY = "utiliora-pwa-install-completed-v1";
const NOTIFICATION_OPT_IN_KEY = "utiliora-pwa-notification-opt-in-v1";
const NOTIFICATION_LAST_SENT_KEY = "utiliora-pwa-notification-last-sent-v1";
const REMINDER_INTERVAL_MS = 20 * 60 * 60 * 1000;

function isStandaloneDisplayMode(): boolean {
  if (typeof window === "undefined") return false;
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || Boolean(navigatorWithStandalone.standalone);
}

function isIosSafariBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(userAgent);
  const isWebkit = /safari/.test(userAgent);
  const isOtherIosBrowser = /crios|fxios|edgios|opios/.test(userAgent);
  return isIos && isWebkit && !isOtherIosBrowser;
}

async function getOrRegisterServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration("/");
    if (existing) return existing;
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

async function showPwaNotification(title: string, body: string, targetUrl = "/tools"): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") {
    return false;
  }

  const registration = await getOrRegisterServiceWorker();
  if (!registration?.showNotification) return false;

  try {
    await registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/favicon-48x48.png",
      tag: "utiliora-pwa",
      data: { url: targetUrl },
    });
    localStorage.setItem(NOTIFICATION_LAST_SENT_KEY, Date.now().toString());
    return true;
  } catch {
    return false;
  }
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installCompleted, setInstallCompleted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermissionState>("unsupported");
  const [status, setStatus] = useState("");
  const isIosSafari = useMemo(() => isIosSafariBrowser(), []);
  const canPromptInstall = Boolean(deferredPrompt);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setInstallCompleted(isStandaloneDisplayMode());
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }

    try {
      const dismissUntil = Number(localStorage.getItem(BANNER_DISMISS_UNTIL_KEY) ?? 0);
      if (Number.isFinite(dismissUntil) && dismissUntil > Date.now()) {
        setDismissed(true);
      }

      const installed = localStorage.getItem(INSTALL_COMPLETED_KEY) === "true";
      if (installed) {
        setInstallCompleted(true);
      }
    } catch {
      // Ignore storage failures.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    void getOrRegisterServiceWorker();

    const onBeforeInstallPrompt = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent;
      installEvent.preventDefault();
      setDeferredPrompt(installEvent);
      setDismissed(false);
    };

    const onAppInstalled = () => {
      setInstallCompleted(true);
      setDeferredPrompt(null);
      setStatus("Utiliora is now installed. Launch it from your device home screen.");
      try {
        localStorage.setItem(INSTALL_COMPLETED_KEY, "true");
        localStorage.removeItem(BANNER_DISMISS_UNTIL_KEY);
      } catch {
        // Ignore storage failures.
      }
      void showPwaNotification("Utiliora installed", "Open your toolkit any time from your home screen.");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (notificationPermission !== "granted") return;
    if (localStorage.getItem(NOTIFICATION_OPT_IN_KEY) !== "true") return;

    const lastSent = Number(localStorage.getItem(NOTIFICATION_LAST_SENT_KEY) ?? 0);
    if (Number.isFinite(lastSent) && Date.now() - lastSent < REMINDER_INTERVAL_MS) return;

    void showPwaNotification(
      "Your tools are ready",
      "Run your daily workflows faster with Utiliora on your device.",
      "/tools",
    );
  }, [notificationPermission]);

  const handleInstall = useCallback(async () => {
    if (canPromptInstall && deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setStatus("Installing Utiliora...");
          setDeferredPrompt(null);
          return;
        }
        setStatus("Install dismissed. You can install any time from this prompt.");
        return;
      } catch {
        setStatus("Install failed. Please try again.");
        return;
      }
    }

    if (isIosSafari) {
      setStatus('On iPhone/iPad: tap Share, then choose "Add to Home Screen".');
      return;
    }

    setStatus("Install prompt is not available yet in this browser session.");
  }, [canPromptInstall, deferredPrompt, isIosSafari]);

  const handleNotificationOptIn = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setStatus("Notifications are not supported on this browser.");
      return;
    }

    if (Notification.permission === "denied") {
      setNotificationPermission("denied");
      setStatus("Notifications are blocked. Enable them in browser settings to receive reminders.");
      return;
    }

    let permission: NotificationPermission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }

    setNotificationPermission(permission);
    if (permission !== "granted") {
      setStatus("Notification permission was not granted.");
      return;
    }

    try {
      localStorage.setItem(NOTIFICATION_OPT_IN_KEY, "true");
    } catch {
      // Ignore storage failures.
    }
    const shown = await showPwaNotification(
      "Notifications enabled",
      "You will get gentle reminders to come back to your daily workflows.",
      "/tools",
    );
    setStatus(shown ? "Notifications enabled successfully." : "Notifications enabled.");
  }, []);

  const dismissBanner = useCallback(() => {
    setDismissed(true);
    setStatus("");
    try {
      localStorage.setItem(BANNER_DISMISS_UNTIL_KEY, (Date.now() + 12 * 60 * 60 * 1000).toString());
    } catch {
      // Ignore storage failures.
    }
  }, []);

  const showInstallControls = !installCompleted && (canPromptInstall || isIosSafari);
  const showNotificationControls =
    notificationPermission !== "granted" && notificationPermission !== "unsupported";
  const shouldRender = !dismissed && (showInstallControls || showNotificationControls || Boolean(status));

  if (!shouldRender) return null;

  return (
    <aside className="pwa-banner" aria-live="polite">
      <div className="pwa-banner-head">
        <div className="pwa-brand-lockup">
          <NextImage src="/branding/utiliora-mark-96.png" alt="Utiliora logo" width={44} height={44} />
          <div>
            <strong>Install Utiliora</strong>
            <small>Launch instantly, keep tools one tap away, and get workflow reminders.</small>
          </div>
        </div>
        <button className="pwa-dismiss-button" type="button" onClick={dismissBanner} aria-label="Dismiss install prompt">
          <X size={16} />
        </button>
      </div>
      <div className="pwa-banner-actions">
        {showInstallControls ? (
          <button className="action-button" type="button" onClick={() => void handleInstall()}>
            <Download size={15} />
            Install app
          </button>
        ) : null}
        {showNotificationControls ? (
          <button className="action-button secondary" type="button" onClick={() => void handleNotificationOptIn()}>
            <Bell size={15} />
            Enable notifications
          </button>
        ) : null}
      </div>
      {status ? <p className="supporting-text pwa-status">{status}</p> : null}
    </aside>
  );
}
