import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-container footer-inner">
        <p>
          Built for global users who need practical utility tools without logins or friction.
        </p>
        <div className="footer-links">
          <Link href="/tools">Browse all tools</Link>
          <Link href="/calculators">Calculators</Link>
          <Link href="/converters">Converters</Link>
          <a href="mailto:team@utiliora.com">team@utiliora.com</a>
        </div>
      </div>
    </footer>
  );
}
