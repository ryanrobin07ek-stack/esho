// Storefront pages: the shop home (with its hero carousel) and custom pages (/pages/:slug).
// Moved verbatim from the app script (index.html, then src/app/main.js).
import { AppController, AppUtils, SQLiteEngine, StoreRenderers } from '../../app/main.js';

export const pagesScreen = {
  renderHome(builderPreview = false) {
    const categories = SQLiteEngine.getCategories();
    const flagshipQuery = SQLiteEngine.getProducts({ flagshipOnly: true, limit: 2 });
    const featuredQuery = SQLiteEngine.getProducts({ featuredOnly: true, limit: 8 });
    const bestsellersQuery = SQLiteEngine.getProducts({ bestsellersOnly: true, limit: 8 });
    const newArrivalsQuery = SQLiteEngine.getProducts({ newOnly: true, limit: 4 });
    const moreProductsQuery = SQLiteEngine.getProducts({ limit: 8, offset: 8 });

    AppUtils.updateSEO({
      title: "Craft — Curated Modern Luxury & Contemporary Essentials",
      description: "Discover bespoke tailoring, Swiss automatic timepieces, Tuscan leather carry, and architectural living objects curated for discerning living.",
      schema: {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "Craft Atelier",
        "url": window.location.origin,
        "potentialAction": {
          "@type": "SearchAction",
          "target": `${window.location.origin}/search?q={search_term_string}`,
          "query-input": "required name=search_term_string"
        }
      }
    });

    return `
      ${this.renderNavbar('/', '', { builderPreview })}
      <main id="main-content">
        <!-- Hero Carousel Section -->
        <section class="hero-section" id="hero-carousel-section">
          <div class="hero-carousel" id="hero-carousel">
            <div class="hero-slide active" data-slide="0">
              <img src="https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=1800&q=85" alt="The Sartorial Architecture" class="hero-bg-img" width="1800" height="640">
              <div class="container">
                <div class="hero-content">
                  <span class="hero-badge">Autumn/Winter 2026</span>
                  <h1 class="hero-title">The Sartorial Architecture</h1>
                  <p class="hero-subtitle">Precision tailoring meets unyielding minimalist form. Handcrafted double-faced cashmere and structured outerwear.</p>
                  <a href="/category/men" class="hero-cta" data-route="/category/men">
                    <span>Explore Men's Sartorial</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </a>
                </div>
              </div>
            </div>

            <div class="hero-slide" data-slide="1">
              <img src="https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1800&q=85" alt="Precision Timepieces" class="hero-bg-img" width="1800" height="640">
              <div class="container">
                <div class="hero-content">
                  <span class="hero-badge">Curated Horology</span>
                  <h2 class="hero-title">Precision Timepieces</h2>
                  <p class="hero-subtitle">Swiss automatic chronometers and titanium tool watches engineered for decades of mechanical resilience.</p>
                  <a href="/category/watches" class="hero-cta" data-route="/category/watches">
                    <span>Discover Watches</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </a>
                </div>
              </div>
            </div>

            <div class="hero-slide" data-slide="2">
              <img src="https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1800&q=85" alt="Quiet Form and Function" class="hero-bg-img" width="1800" height="640">
              <div class="container">
                <div class="hero-content">
                  <span class="hero-badge">Artisanal Leather</span>
                  <h2 class="hero-title">Quiet Form & Function</h2>
                  <p class="hero-subtitle">Vegetable-tanned full grain Tuscan calfskin. Minimalist everyday carry designed to develop a rich, personal patina.</p>
                  <a href="/category/bags" class="hero-cta" data-route="/category/bags">
                    <span>View Carry Collection</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </a>
                </div>
              </div>
            </div>

            <div class="hero-controls">
              <button class="hero-arrow-btn" id="hero-prev" aria-label="Previous Slide">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <div class="hero-dots" id="hero-dots">
                <span class="hero-dot active" data-index="0"></span>
                <span class="hero-dot" data-index="1"></span>
                <span class="hero-dot" data-index="2"></span>
              </div>
              <button class="hero-arrow-btn" id="hero-next" aria-label="Next Slide">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
          </div>
        </section>

        <!-- Category Circles Discovery Rail -->
        <section class="categories-rail-section">
          <div class="container">
            <div style="display: flex; justify-content: space-between; align-items: flex-end;">
              <div>
                <span class="section-eyebrow">Curated Departments</span>
                <h2 class="section-heading">Explore By Collection</h2>
              </div>
              <a href="/categories" class="nav-link" data-route="/categories" style="font-weight: 600;">View All (${categories.length}) &rarr;</a>
            </div>
            <div class="categories-rail">
              ${categories.map(cat => {
                const categoryImage = cat.image || SQLiteEngine.getProducts({ categoryId: cat.id }).items.find(product => product.images && product.images[0])?.images[0] || "";
                return `
                  <a href="/category/${encodeURIComponent(cat.slug)}" class="category-circle-card" data-route="/category/${encodeURIComponent(cat.slug)}">
                    <div class="category-circle-thumb-wrapper">
                      ${categoryImage ? `<img src="${AppUtils.escapeHTML(categoryImage)}" alt="${AppUtils.escapeHTML(cat.name)}" class="category-circle-img" loading="lazy" width="84" height="84">` : `<span class="category-circle-name" aria-hidden="true">${AppUtils.escapeHTML(cat.name.slice(0, 1))}</span>`}
                    </div>
                    <span class="category-circle-name">${AppUtils.escapeHTML(cat.name)}</span>
                  </a>
                `;
              }).join("")}
            </div>
          </div>
        </section>

        <!-- Flagship Spotlight Section -->
        <section class="flagship-section">
          <div class="container">
            <div class="flagship-grid">
              <div class="flagship-banner">
                <img src="https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=1200&q=80" alt="Flagship Series" class="flagship-img">
                <div class="flagship-card-overlay">
                  <span class="section-eyebrow" style="color: rgba(255,255,255,0.8);">Flagship Curation</span>
                  <h3 style="font-family: var(--font-serif); font-size: 2rem; margin: 8px 0 12px; font-weight: 400;">The Mongolian Cashmere Edition</h3>
                  <p style="font-size: 0.9375rem; color: rgba(255,255,255,0.9); line-height: 1.5; margin-bottom: 20px;">
                    Crafted from unlined double-faced cashmere woven in northern Italy. Pure substance and drape with zero synthetic additives.
                  </p>
                  <a href="/product/double-faced-cashmere-overcoat" class="hero-cta" data-route="/product/double-faced-cashmere-overcoat" style="padding: 10px 20px;">
                    View Masterpiece &rarr;
                  </a>
                </div>
              </div>
              <div style="display: flex; flex-direction: column; gap: 24px;">
                <div>
                  <span class="section-eyebrow">Spotlight Editions</span>
                  <h2 class="section-heading" style="margin-bottom: 8px;">Master Craftsmanship</h2>
                  <p style="font-size: 0.9375rem; color: var(--text-muted); line-height: 1.6;">
                    Each piece in our flagship collection is built on enduring silhouettes, artisanal materials, and traceable origin.
                  </p>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                  ${flagshipQuery.items.map(p => this.renderProductCard(p)).join("")}
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Featured Products Section -->
        <section style="padding: 64px 0; border-bottom: 1px solid var(--border);">
          <div class="container">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px;">
              <div>
                <span class="section-eyebrow">Editorial Selection</span>
                <h2 class="section-heading">Featured Pieces</h2>
              </div>
              <a href="/categories" class="nav-link" data-route="/categories" style="font-weight: 600;">Browse All &rarr;</a>
            </div>
            <div class="products-grid">
              ${featuredQuery.items.map(p => this.renderProductCard(p)).join("")}
            </div>
          </div>
        </section>

        <!-- Seasonal Campaign Banner -->
        <section class="campaign-banner-section">
          <div class="container">
            <div class="campaign-card">
              <img src="https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=1600&q=80" alt="Living Architecture" class="campaign-bg-img">
              <div class="campaign-inner">
                <span class="section-eyebrow" style="color: #FFFFFF;">Living Architecture</span>
                <h2 style="font-family: var(--font-serif); font-size: 2.5rem; font-weight: 400; margin: 12px 0 16px;">Smoked Glass & Cast Bronze</h2>
                <p style="font-size: 1rem; color: rgba(255,255,255,0.85); line-height: 1.6; margin-bottom: 28px;">
                  Quiet objects that elevate daily rituals. Discover hand-blown Italian glassware and lost-wax cast lighting designed for a lifetime of reflection.
                </p>
                <a href="/category/home" class="hero-cta" data-route="/category/home">Explore Architectural Living</a>
              </div>
            </div>
          </div>
        </section>

        <!-- Best Sellers Section -->
        <section style="padding: 64px 0; border-bottom: 1px solid var(--border);">
          <div class="container">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px;">
              <div>
                <span class="section-eyebrow">Client Favorites</span>
                <h2 class="section-heading">Best Sellers</h2>
              </div>
              <span style="font-size: 0.875rem; color: var(--text-muted);">${bestsellersQuery.totalCount} items in demand</span>
            </div>
            <div class="products-grid">
              ${bestsellersQuery.items.map(p => this.renderProductCard(p)).join("")}
            </div>
          </div>
        </section>

        <!-- New Arrivals Showcase -->
        <section style="padding: 64px 0; border-bottom: 1px solid var(--border);">
          <div class="container">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px;">
              <div>
                <span class="section-eyebrow">Fresh Release</span>
                <h2 class="section-heading">New Arrivals</h2>
              </div>
              <a href="/categories" class="nav-link" data-route="/categories" style="font-weight: 600;">View Lookbook &rarr;</a>
            </div>
            <div class="products-grid">
              ${newArrivalsQuery.items.map(p => this.renderProductCard(p)).join("")}
            </div>
          </div>
        </section>

        <!-- Pillars of Craftsmanship -->
        <section style="padding: 64px 0; background: var(--surface);">
          <div class="container">
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 32px; text-align: center;">
              <div>
                <div style="font-size: 1.5rem; margin-bottom: 12px; color: var(--accent);">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                </div>
                <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 6px;">Worldwide Carbon-Neutral</h3>
                <p style="font-size: 0.8125rem; color: var(--text-muted); line-height: 1.5;">Complimentary express shipping on all orders exceeding $150 with 100% offset carbon.</p>
              </div>
              <div>
                <div style="font-size: 1.5rem; margin-bottom: 12px; color: var(--accent);">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 6px;">Artisanal Provenance</h3>
                <p style="font-size: 0.8125rem; color: var(--text-muted); line-height: 1.5;">Direct partnership with heritage mills in Biella, Okayama, Florence, and Solothurn.</p>
              </div>
              <div>
                <div style="font-size: 1.5rem; margin-bottom: 12px; color: var(--accent);">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                </div>
                <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 6px;">30-Day Guaranteed Returns</h3>
                <p style="font-size: 0.8125rem; color: var(--text-muted); line-height: 1.5;">Complimentary prepaid return labels included with every dispatch parcel.</p>
              </div>
              <div>
                <div style="font-size: 1.5rem; margin-bottom: 12px; color: var(--accent);">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </div>
                <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 6px;">Private Concierge</h3>
                <p style="font-size: 0.8125rem; color: var(--text-muted); line-height: 1.5;">Dedicated personal assistance for bespoke sizing, care advice, and gift curation.</p>
              </div>
            </div>
          </div>
        </section>
        <section class="store-newsletter-signup" aria-labelledby="store-newsletter-heading">
          <span class="section-eyebrow">The Craft edit</span>
          <h2 id="store-newsletter-heading">New arrivals, thoughtfully chosen.</h2>
          <p>Subscribe for occasional product news and shop updates.</p>
          <form id="web-newsletter-signup">
            <label class="sr-only" for="web-newsletter-email">Email address</label>
            <input id="web-newsletter-email" name="email" type="email" autocomplete="email" placeholder="Your email address" required>
            <label class="store-newsletter-consent"><input name="consent" type="checkbox" required> I agree to receive occasional email updates. I can unsubscribe at any time.</label>
            <button type="submit">Subscribe</button>
            <button type="button" data-enable-notifications>Enable product notifications</button>
            <button type="button" data-disable-notifications>Turn off notifications</button>
            <span role="status" aria-live="polite"></span>
          </form>
          <small>We’ll email you a confirmation link. Your subscription starts only after you confirm.</small>
        </section>
      </main>
      ${this.renderFooter()}
    `;
  },
  renderCustomPage(slug) {
    const page = SQLiteEngine.getPageBySlug(slug, true);
    if (!page) return null;
    const store = SQLiteEngine.getStore();
    AppUtils.updateSEO({
      title: `${page.title} — ${store.name || "Craft"}`,
      description: page.content.slice(0, 160)
    });
    const safeContent = AppUtils.escapeHTML(page.content || "").replace(/\r\n?|\n/g, "<br>");
    return `
      ${this.renderNavbar(`/pages/${encodeURIComponent(page.slug)}`)}
      <main id="main-content" class="container" style="max-width: 900px; min-height:65vh; padding:48px 16px 80px;">
        <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/" data-route="/">Home</a><span>/</span><span>${AppUtils.escapeHTML(page.title)}</span></nav>
        <article>
          <h1 class="section-heading" style="font-size:clamp(2rem,7vw,3rem); margin:16px 0 24px;">${AppUtils.escapeHTML(page.title)}</h1>
          <div style="line-height:1.8; white-space:normal;">${safeContent}</div>
        </article>
      </main>
      ${this.renderFooter()}
    `;
  },
};

export const pagesController = {
  initHeroCarousel() {
    const slides = document.querySelectorAll(".hero-slide");
    const dots = document.querySelectorAll(".hero-dot");
    const prevBtn = document.getElementById("hero-prev");
    const nextBtn = document.getElementById("hero-next");
    const carousel = document.getElementById("hero-carousel");
    if (!slides.length) return;

    this.carouselIndex = 0;
    const showSlide = (idx) => {
      this.carouselIndex = (idx + slides.length) % slides.length;
      slides.forEach((s, i) => s.classList.toggle("active", i === this.carouselIndex));
      dots.forEach((d, i) => d.classList.toggle("active", i === this.carouselIndex));
    };

    if (prevBtn) prevBtn.onclick = () => showSlide(this.carouselIndex - 1);
    if (nextBtn) nextBtn.onclick = () => showSlide(this.carouselIndex + 1);

    dots.forEach((dot, i) => {
      dot.onclick = () => showSlide(i);
    });

    const startAuto = () => {
      if (this.carouselTimer) clearInterval(this.carouselTimer);
      this.carouselTimer = setInterval(() => {
        showSlide(this.carouselIndex + 1);
      }, 5500);
    };

    startAuto();

    if (carousel) {
      carousel.addEventListener("mouseenter", () => {
        if (this.carouselTimer) clearInterval(this.carouselTimer);
      });
      carousel.addEventListener("mouseleave", () => {
        startAuto();
      });
    }
  },
};

// Screen entry points. The router (handleRoute in src/app/main.js) still draws this screen
// itself, through StoreRenderers.renderHome() / renderCustomPage(); mount()/unmount() draw and set up this one screen on their own.
export function mount(root, slug) {
  root.innerHTML = slug ? StoreRenderers.renderCustomPage(slug) : StoreRenderers.renderHome();
  if (document.getElementById("hero-carousel")) AppController.initHeroCarousel();
}

export function unmount() {
  if (AppController.carouselTimer) {
    clearInterval(AppController.carouselTimer);
    AppController.carouselTimer = null;
  }
}
