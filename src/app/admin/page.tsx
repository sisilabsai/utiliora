import { cookies } from "next/headers";
import type { Metadata } from "next";
import { ADMIN_SESSION_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin-session";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";

export const metadata: Metadata = {
  title: "Admin",
  description: "Utiliora admin dashboard for marketing and platform operations.",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default function AdminPage() {
  const cookieStore = cookies();
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  const session = verifyAdminSessionToken(sessionToken);

  if (!session) {
    return (
      <div className="site-container page-stack">
        <AdminLoginForm />
      </div>
    );
  }

  return <AdminDashboard username={session.username} role={session.role} />;
}
