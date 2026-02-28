import type { Metadata } from "next";
import { ContactPageContent } from "@/components/pages/ContactPageContent";

export const metadata: Metadata = {
  title: "Contact Utiliora",
  description:
    "Contact Utiliora through email or social channels. Reach us for support, product feedback, and partnership conversations.",
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: "Contact Utiliora",
    description:
      "Contact Utiliora through email or social channels. Reach us for support, product feedback, and partnership conversations.",
    url: "https://utiliora.cloud/contact",
    type: "website",
    siteName: "Utiliora",
  },
};

export default function ContactPage() {
  const contactSchema = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: "Utiliora Contact",
    url: "https://utiliora.cloud/contact",
    mainEntity: {
      "@type": "Organization",
      name: "Utiliora",
      email: "hello@utiliora.cloud",
    },
  };

  return (
    <>
      <ContactPageContent />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactSchema) }}
      />
    </>
  );
}
