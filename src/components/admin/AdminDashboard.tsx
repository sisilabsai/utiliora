"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface AdminOverviewResponse {
  ok?: boolean;
  dashboard?: {
    user: {
      username: string;
      role: string;
    };
    newsletter: {
      totalSubscribers: number;
      activeSubscribers: number;
      recentSubscribers: Array<{
        email: string;
        source: string;
        page_path: string;
        status: string;
        created_at: string;
        last_subscribed_at: string | null;
      }>;
    };
    platform: {
      totalTools: number;
      totalCategories: number;
    };
  };
  error?: string;
}

interface AdminDashboardProps {
  username: string;
  role: string;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
}

export function AdminDashboard({ username, role }: AdminDashboardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<AdminOverviewResponse["dashboard"] | null>(null);
  const [logoutStatus, setLogoutStatus] = useState("");

  const refreshData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/overview", {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json()) as AdminOverviewResponse;
      if (!response.ok || !payload.ok || !payload.dashboard) {
        setError(payload.error || "Failed to load dashboard data.");
        setData(null);
        return;
      }
      setData(payload.dashboard);
    } catch {
      setError("Failed to load dashboard data.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  const logout = useCallback(async () => {
    setLogoutStatus("Signing out...");
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      setLogoutStatus("Signed out.");
      router.refresh();
    } catch {
      setLogoutStatus("Sign-out failed. Reload and try again.");
    }
  }, [router]);

  const activeRate = useMemo(() => {
    if (!data?.newsletter.totalSubscribers) return "0%";
    const ratio = (data.newsletter.activeSubscribers / data.newsletter.totalSubscribers) * 100;
    return `${ratio.toFixed(1)}%`;
  }, [data]);

  return (
    <div className="site-container page-stack">
      <section className="tool-hero">
        <p className="eyebrow">Admin Workspace</p>
        <h1>Marketing + Analysis Dashboard</h1>
        <p>
          Signed in as <strong>{username}</strong> ({role}). Manage newsletter growth and monitor platform signals.
        </p>
        <div className="button-row">
          <button className="action-button secondary" type="button" onClick={() => void refreshData()} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh data"}
          </button>
          <button className="action-button secondary" type="button" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
        <p className="supporting-text">{logoutStatus}</p>
      </section>

      {error ? (
        <section className="content-block">
          <h2>Dashboard Error</h2>
          <p>{error}</p>
          <p className="supporting-text">
            Confirm Supabase tables are created and `SUPABASE_SERVICE_ROLE_KEY` is configured.
          </p>
        </section>
      ) : null}

      {data ? (
        <>
          <section className="tool-grid">
            <article className="tool-card">
              <h3>Total subscribers</h3>
              <p className="tool-card-summary">{data.newsletter.totalSubscribers.toLocaleString("en-US")}</p>
            </article>
            <article className="tool-card">
              <h3>Active subscribers</h3>
              <p className="tool-card-summary">{data.newsletter.activeSubscribers.toLocaleString("en-US")}</p>
            </article>
            <article className="tool-card">
              <h3>Active ratio</h3>
              <p className="tool-card-summary">{activeRate}</p>
            </article>
            <article className="tool-card">
              <h3>Platform catalog</h3>
              <p className="tool-card-summary">
                {data.platform.totalTools} tools across {data.platform.totalCategories} categories
              </p>
            </article>
          </section>

          <section className="content-block">
            <h2>Recent Newsletter Registrations</h2>
            {data.newsletter.recentSubscribers.length ? (
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Source</th>
                      <th>Page path</th>
                      <th>Subscribed at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.newsletter.recentSubscribers.map((entry) => (
                      <tr key={`${entry.email}-${entry.created_at}`}>
                        <td>{entry.email}</td>
                        <td>{entry.status}</td>
                        <td>{entry.source || "-"}</td>
                        <td>{entry.page_path || "-"}</td>
                        <td>{formatDate(entry.last_subscribed_at || entry.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="supporting-text">No subscribers yet.</p>
            )}
          </section>

          <section className="content-block">
            <h2>Website Analysis (Roadmap)</h2>
            <p>
              This admin panel is now ready for expansion into advanced marketing ops: campaign tags, funnel
              attribution, top-converting page analysis, cohort retention, and automated outreach triggers.
            </p>
            <p className="supporting-text">
              Next phase: connect GA/GSC exports and add per-tool conversion dashboards.
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}
