"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("admin@utiliora.cloud");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState("Enter your admin credentials.");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setStatus("Signing in...");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setStatus(payload.error || "Login failed.");
        return;
      }

      setStatus("Signed in. Loading dashboard...");
      router.refresh();
    } catch {
      setStatus("Login failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="admin-auth-shell">
      <div className="admin-auth-card">
        <p className="eyebrow">Utiliora Admin</p>
        <h1>Admin Sign In</h1>
        <p className="supporting-text">
          Access newsletter marketing controls and platform analytics.
        </p>
        <form className="admin-auth-form" onSubmit={submit}>
          <label className="field">
            <span>Username</span>
            <input
              type="email"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <button className="action-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="supporting-text">{status}</p>
      </div>
    </section>
  );
}
