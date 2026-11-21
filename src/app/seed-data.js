// Seed data: demo store details, hero slides, categories, products, plans and demo analytics.
// Moved verbatim out of src/app/main.js.

// Module scope keeps these names private, as the old IIFE wrapper did; what screen and shell
// modules need is exported at the end.
  // Seed dataset for Craft
export const storeInfo = {
  id: 1,
  name: "Craft",
  title: "Craft",
  tagline: "",
  description: "",
  location: "",
  email: "",
  phone: "",
  currency: "KES",
  currency_symbol: "KSh",
  announcement: "",
  announcement_active: 0,
  theme_mode: "light",
  primary_color: "#18181b",
  font_family: "sans",
  card_radius: "minimal",
  layout_density: "comfortable"
};

export const heroSlides = [];

export const categories = [];

export const products = [];

// Craft's own pricing, in the currency the shop owner actually earns in. Every tier is a whole
// shop: the first is the till on one phone, the second adds the website and lets a team share the
// till, and the third is for an owner running several shops at once.
export const plans = [
  {
    id: 1,
    slug: "counter",
    name: "Counter",
    price: 300,
    billing_period: "month",
    description: "The till, on one phone. For a shop owner who sells face to face.",
    badge: null,
    is_current: 0,
    features: [
      "One account",
      "POS on one phone",
      "Products, stock and receipts",
      "Sales and profit reports",
      "Works offline on the device"
    ]
  },
  {
    id: 2,
    slug: "shop-and-website",
    name: "Shop and website",
    price: 1140,
    billing_period: "month",
    description: "The till and your own website, with the counter shared across the team.",
    badge: "Most shops",
    is_current: 0,
    features: [
      "Everything in Counter",
      "One website, with your own address",
      "Share the till across up to 5 phones",
      "Several sellers on one counter",
      "Online orders, bookings and discount codes",
      "Website visitors and sales reports"
    ]
  },
  {
    id: 3,
    slug: "multi-shop",
    name: "Multi-shop",
    price: 5240,
    billing_period: "month",
    description: "Several shops and several websites, run from one place.",
    badge: null,
    is_current: 0,
    features: [
      "Everything in Shop and website",
      "4 accounts",
      "3 websites, plus 1 free website",
      "Up to 20 phones or devices on the counter",
      "Deeper business analysis across shops",
      "Stock split between the counter and the web"
    ]
  }
];

export const demoAnalytics = {
  summary: {
    traffic: 148290,
    traffic_growth: "+18.4%",
    visitors: 92450,
    visitors_growth: "+14.2%",
    product_views: 384100,
    product_views_growth: "+22.7%",
    orders: 1428,
    orders_growth: "+12.8%",
    revenue: 429650,
    revenue_growth: "+24.5%",
    conversion_rate: 3.72,
    conversion_growth: "+0.4%",
    aov: 300.87,
    aov_growth: "+8.9%"
  },
  periods: {
    today: { visitors: 3420, orders: 48, revenue: 14850, views: 12900 },
    "7d": { visitors: 22800, orders: 342, revenue: 104200, views: 88400 },
    "30d": { visitors: 92450, orders: 1428, revenue: 429650, views: 384100 },
    "90d": { visitors: 268000, orders: 4120, revenue: 1248000, views: 1095000 }
  },
  top_categories: [
    { name: "Men's Sartorial", share: "28%", revenue: 120300 },
    { name: "Horology & Watches", share: "24%", revenue: 103100 },
    { name: "Artisanal Leather Bags", share: "18%", revenue: 77300 },
    { name: "Handmade Shoes", share: "14%", revenue: 60150 },
    { name: "Modern Electronics", share: "9%", revenue: 38600 },
    { name: "Home & Architectural", share: "7%", revenue: 30200 }
  ]
};
