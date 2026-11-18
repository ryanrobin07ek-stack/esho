export const CRAFT_AI_SCREEN_DIRECTORY = [
  {
    id: "home",
    title: "Craft home",
    route: "/",
    purpose: "Daily sales summary, low-stock and payment follow-up counts, and recent orders.",
    overviewLabels: ["Sales today", "Orders", "Average order", "Yesterday", "Needs attention", "Low stock", "Payment follow-up", "Recent orders"]
  },
  {
    id: "business-overview",
    title: "Main Store overview",
    route: "/account/main-shop",
    purpose: "Whole-business products, categories, inventory, collected revenue, and business performance.",
    overviewLabels: ["Revenue", "Paid orders", "Gross profit", "Customers", "Average order", "Net after recorded expenses", "Web visitors", "Stock value at cost", "Business performance", "Priority signals", "Break-even position", "Top products", "Revenue by category", "Payment methods", "Latest transactions"]
  },
  {
    id: "business-dashboard",
    title: "Business Dashboard",
    route: "/account/dashboard",
    purpose: "Sales volume, customer visits, web revenue, awaiting website payments, and storefront activity."
  },
  {
    id: "products-manager",
    title: "Products Manager",
    route: "/account/products",
    purpose: "Advanced web catalog for managing product details, pricing, imagery, and specifications.",
    actions: ["Manage product details", "Manage pricing", "Manage imagery", "Manage specifications"]
  },
  {
    id: "web-studio",
    title: "Build Your Web",
    route: "/account/web",
    purpose: "Manage website products, store details, analytics, customers, and payments."
  },
  {
    id: "web-products",
    title: "Web Store products",
    route: "/account/web/studio/store/products",
    purpose: "Manage website products. Use Add web product to create a website listing, Add from Store to import an existing Store product, or Publish to update the live website. Local changes are not published automatically.",
    actions: ["Add web product", "Add from Store", "Advanced web catalog", "Publish"]
  },
  {
    id: "web-overview",
    title: "Web Studio overview",
    route: "/account/web/studio/dashboard/overview",
    purpose: "Website revenue, customer visits, awaiting payments, storefront visit history, and products gaining momentum.",
    overviewLabels: ["Paid web revenue", "Customer visits", "Awaiting payments", "Storefront visit history", "What’s moving"]
  },
  {
    id: "web-visits",
    title: "Web Studio visits",
    route: "/account/web/studio/dashboard/visits",
    purpose: "Review storefront visit history and visitor details."
  },
  {
    id: "web-traffic",
    title: "Web Studio traffic",
    route: "/account/web/studio/dashboard/traffic",
    purpose: "Review total visits, unique visitors, and product page views."
  },
  {
    id: "web-performance",
    title: "Web Studio performance",
    route: "/account/web/studio/dashboard/performance",
    purpose: "Review storefront performance and recorded sales."
  },
  {
    id: "web-product-intelligence",
    title: "Web product intelligence",
    route: "/account/web/studio/dashboard/product-intelligence",
    purpose: "Review product views, favorites, and add-to-basket activity."
  },
  {
    id: "web-categories",
    title: "Web Store categories",
    route: "/account/web/studio/store/categories",
    purpose: "Manage categories used by website products."
  },
  {
    id: "web-inventory",
    title: "Web Store inventory",
    route: "/account/web/studio/store/inventory",
    purpose: "Review website product stock."
  },
  {
    id: "web-orders",
    title: "Web Store orders",
    route: "/account/web/studio/store/orders",
    purpose: "Review online orders and payment status."
  },
  {
    id: "web-bookings",
    title: "Web Store bookings",
    route: "/account/web/studio/store/bookings",
    purpose: "Review website booking activity."
  },
  {
    id: "web-customers",
    title: "Web Studio customers",
    route: "/account/web/studio/crm/customers",
    purpose: "Review customer records and repeat-purchase activity."
  },
  {
    id: "web-loyalty",
    title: "Web Studio loyalty points",
    route: "/account/web/studio/crm/points",
    purpose: "Manage customer loyalty points."
  },
  {
    id: "web-subscribers",
    title: "Web Studio subscribers",
    route: "/account/web/studio/crm/subscribers",
    purpose: "Review newsletter subscribers."
  },
  {
    id: "web-notifications",
    title: "Web Studio notifications",
    route: "/account/web/studio/crm/notifications",
    purpose: "Manage storefront customer notifications."
  },
  {
    id: "websites",
    title: "Websites",
    route: "/account/web/studio/websites/list",
    purpose: "Manage websites associated with the account."
  },
  {
    id: "new-website",
    title: "Create a website",
    route: "/account/web/studio/websites/webmaker",
    purpose: "Start building a new website."
  },
  {
    id: "website-editor",
    title: "Website editor",
    route: "/account/web/studio/websites/editor",
    purpose: "Open Litrus Mixer, the website editor, to design the storefront's sections, products, colours and publishing."
  },
  {
    id: "web-payments",
    title: "Web Studio payments",
    route: "/account/web/studio/payments",
    purpose: "Configure and review website payment options."
  },
  {
    id: "web-store-details",
    title: "Web Store details",
    route: "/account/web/store",
    purpose: "Edit store details and publish the storefront."
  },
  {
    id: "inventory",
    title: "Inventory",
    route: "/account/inventory",
    purpose: "Review and update product stock counts."
  },
  {
    id: "categories",
    title: "Categories",
    route: "/account/categories",
    purpose: "Create and organize web catalog categories. A category may be needed before adding products."
  },
  {
    id: "account-settings",
    title: "Account settings",
    route: "/account/settings",
    purpose: "Adjust account and storefront preferences."
  },
  {
    id: "shops",
    title: "My shops",
    route: "/account/tenants",
    purpose: "Manage websites and shops linked to the account."
  },
  {
    id: "website-plans",
    title: "Plans & Tiering",
    route: "/account/plans",
    purpose: "Review available plans and features."
  },
  {
    id: "store-orders",
    title: "Store orders",
    route: "/store/orders",
    purpose: "Review business orders, POS receipts, and online order status."
  },
  {
    id: "point-of-sale",
    title: "Point of Sale",
    route: "/pos",
    purpose: "Open checkout and record a POS sale."
  },
  {
    id: "pos-overview",
    title: "POS overview",
    route: "/pos/overview",
    purpose: "Review POS sales, revenue, profit estimates, stock, payments, and reports.",
    overviewLabels: ["Summary", "Revenue", "Profit", "Products", "Stock", "Payments", "Reports", "Sales recorded", "Net sales", "Operating profit", "Credit", "Recent net sales", "Period comparison", "Quick insights", "Monthly net-sales goal"]
  },
  {
    id: "pos-products",
    title: "POS products",
    route: "/pos/catalogue/products?new=1",
    purpose: "Add a product to the POS register catalog."
  },
  {
    id: "pos-inventory",
    title: "POS inventory",
    route: "/pos/catalogue/inventory",
    purpose: "Review POS stock, restock products, and track inventory costs."
  },
  {
    id: "pos-categories",
    title: "POS categories",
    route: "/pos/catalogue/categories",
    purpose: "Manage POS product categories."
  },
  {
    id: "pos-suppliers",
    title: "POS suppliers",
    route: "/pos/catalogue/suppliers",
    purpose: "Manage suppliers for POS inventory."
  },
  {
    id: "pos-orders",
    title: "POS orders",
    route: "/pos/orders",
    purpose: "Review POS orders."
  },
  {
    id: "pos-invoices",
    title: "POS invoices",
    route: "/pos/orders/invoices",
    purpose: "Create and manage POS invoices."
  },
  {
    id: "pos-quotations",
    title: "POS quotations",
    route: "/pos/orders/quotations",
    purpose: "Create and manage POS quotations."
  },
  {
    id: "pos-customers",
    title: "POS customers",
    route: "/pos/customers",
    purpose: "Review customers linked to POS sales."
  },
  {
    id: "pos-settings",
    title: "POS settings",
    route: "/pos/more/settings",
    purpose: "Configure POS currency, tax, receipts, and register preferences."
  },
  {
    id: "pos-sales",
    title: "Sales & receipts",
    route: "/pos/sales",
    purpose: "Review recorded POS sales, receipts, and outstanding balances."
  },
  {
    id: "store-settings",
    title: "Store Settings",
    route: "/account/settings",
    purpose: "Adjust storefront appearance and preferences."
  }
];
