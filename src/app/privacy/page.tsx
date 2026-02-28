import type { Metadata } from "next";
import { PrivacyPageContent } from "@/components/pages/PrivacyPageContent";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Utiliora privacy policy covering data handling, analytics, cookies, and user controls.",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPage() {
  const updatedOn = "February 28, 2026";

  return <PrivacyPageContent updatedOn={updatedOn} />;
}
