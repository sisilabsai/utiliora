import Link from "next/link";
import { getCategories } from "@/lib/categories";

export function SiteHeader() {
  const categories = getCategories();

  return (
    <header className="site-header">
      <div className="site-container header-inner">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden>
            U
          </span>
          <span className="brand-text">
            <strong>Utiliora</strong>
            <small>Simple tools. Instant results.</small>
          </span>
        </Link>

        <nav aria-label="Primary navigation" className="main-nav">
          <Link href="/tools">All Tools</Link>
          {categories.map((category) => (
            <Link key={category.slug} href={`/${category.slug}`}>
              {category.title}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
