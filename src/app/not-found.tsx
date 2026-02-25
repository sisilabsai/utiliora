export default function NotFound() {
  return (
    <div className="site-container page-stack">
      <section className="tool-hero">
        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
        <p>The page you requested does not exist or may have moved.</p>
        <a className="action-link" href="/tools">
          Browse all tools
        </a>
      </section>
    </div>
  );
}
