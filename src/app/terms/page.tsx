import type { Metadata } from "next";
import { TermsPageContent } from "@/components/pages/TermsPageContent";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Utiliora terms of use for platform access, acceptable use, and limitation notices.",
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsPage() {
  const updatedOn = "February 28, 2026";

  return <TermsPageContent updatedOn={updatedOn} />;
}
