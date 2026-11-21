// Website business types: the type groups, the theme overrides and service duration options.
// Moved verbatim out of src/app/main.js.

  // Account & Studio Views + Static Informational Pages





export const WEBSITE_BUSINESS_TYPE_GROUPS = [
  {
    label: "Product Retail & E-commerce",
    sections: [
      { label: "Fashion and personal", themeId: "etalon-premium-fashion-apparel", types: [
        "Clothing boutiques", "Shoe stores", "Bags, accessories and jewelry", "Watches and sunglasses",
        "Thrift / mtumba shops", "Lingerie and underwear"
      ] },
      { label: "Electronics and tech", themeId: "kinetic-high-performance-electronics", types: [
        "Phone and accessories shops", "Laptops and computer stores", "Gaming and console stores",
        "Appliances", "Solar and power equipment"
      ] },
      { label: "Home and living", themeId: "woodora-modern-furniture-luxury-home-interiors-kenya", types: [
        "Furniture", "Home décor and interiors", "Kitchenware and utensils", "Bedding and curtains",
        "Hardware and building materials", "Garden and plant nurseries"
      ] },
      { label: "Health and beauty products", themeId: "elura-botanicals-luxury-cosmetics-skincare", types: [
        "Cosmetics and makeup", "Skincare and hair products", "Perfumes", "Pharmacies and chemists",
        "Wellness and supplements"
      ] },
      { label: "Everyday retail", themeId: "zima-fresh-supermarket-fresh-groceries-farm-produce-daily-essent", types: [
        "Supermarkets and minimarkets", "General shops (dukas)", "Stationery and books",
        "Toys and baby products", "Gift shops and flower shops", "Pet shops and pet supplies",
        "Auto parts and car accessories", "Sports and fitness equipment", "Wholesale and distributors",
        "Printing and branded merchandise"
      ] }
    ]
  },
  {
    label: "Food & Drinks",
    sections: [
      { label: "Eateries", themeId: "nairobi-feast-modern-cbd-kitchen-grill", types: [
        "Restaurants", "Cafés and coffee shops", "Fast food and takeaway", "Nyama choma joints",
        "Pizzerias and burger joints", "Street food and kiosks", "Food trucks", "Juice and smoothie bars"
      ] },
      { label: "Bars and nightlife", themeId: "mikaa-woodfire-coast-artisanal-coastal-hearth-restaurant", types: [
        "Bars and pubs", "Lounges and clubs", "Wine and spirits shops", "Breweries"
      ] },
      { label: "Bakery and sweets", themeId: "nairobi-feast-modern-cbd-kitchen-grill", types: [
        "Bakeries", "Cake and pastry shops", "Ice cream and dessert shops", "Chocolate and candy shops"
      ] },
      { label: "Food retail and supply", themeId: "harvest-lane-market-fresh-groceries-delivered-or-ready-to-collec", types: [
        "Butcheries", "Fresh produce and greengrocers", "Groceries and delivery services",
        "Health food stores", "Spice and herb shops"
      ] },
      { label: "Food services", themeId: "nairobi-feast-modern-cbd-kitchen-grill", types: [
        "Catering", "Meal prep and subscription meals", "Cloud kitchens (delivery only)",
        "Event food vendors"
      ] }
    ]
  },
  {
    label: "Hotels, Stays & Retreats",
    sections: [
      { label: "Accommodation and retreats", themeId: "aurelia-grand-luxury-hotels-stays-culinary-destinations", types: [
        "Hotels", "Lodges", "Guest houses", "Bed and breakfasts (B&Bs)", "Hostels and backpackers",
        "Serviced apartments", "Airbnb and short-term rentals", "Villas and holiday homes", "Resorts",
        "Safari camps and tented camps", "Campsites and glamping", "Eco-lodges",
        "Wellness and yoga retreats", "Corporate retreats and conference centers",
        "Wedding and event venues", "Farm stays", "Beach cottages"
      ] }
    ]
  },
  {
    label: "Beauty Services & Bookings",
    sections: [
      { label: "Hair", themeId: "maison-elysee-haute-coiffure-luxury-salon-beauty-atelier", types: [
        "Hair salons", "Barbershops", "Braiding and weaving studios",
        "Locticians and natural hair specialists", "Wig making and installation"
      ] },
      { label: "Nails and skin", themeId: "lacqueria-the-art-of-the-hand-nail-atelier-booking-shop", types: [
        "Nail studios (manicure and pedicure)", "Facial and skincare clinics",
        "Waxing and threading studios", "Lash and brow studios",
        "Makeup artists (bridal, events, shoots)", "Tanning studios"
      ] },
      { label: "Body and wellness", themeId: "aura-luxe-fine-botanical-cosmetics-luxury-beauty", types: [
        "Spas", "Massage therapy", "Aromatherapy and body treatments", "Sauna and steam rooms",
        "Fitness studios, gyms and personal trainers", "Yoga and pilates studios"
      ] },
      { label: "Specialty", themeId: "blush-theory-nail-studio-editorial-nail-art-online-booking-apoth", types: [
        "Cosmetic and aesthetic clinics", "Tattoo and piercing studios",
        "Mobile beauty services (home visits)", "Bridal beauty packages", "Grooming for men"
      ] }
    ]
  },
  {
    label: "Events",
    sections: [
      { label: "Event businesses", themeId: "arcadia-events-bespoke-event-planning-spatial-design-studio", types: [
        "Event planners", "Event production and décor", "Event venues"
      ] }
    ]
  },
  {
    label: "Property & Real Estate",
    sections: [
      { label: "Property businesses", themeId: "aurus-real-estate-kenya-luxury-property-discovery-platform", types: [
        "Real estate agencies", "Property developers", "Property rentals and management"
      ] }
    ]
  },
  {
    label: "Tours & Safaris",
    sections: [
      { label: "Tour businesses", themeId: "olkeri-expeditions-luxury-kenya-safaris", types: [
        "Tour operators", "Safari companies", "Travel and excursion companies"
      ] }
    ]
  }
];

export const WEBSITE_BUSINESS_TYPE_THEME_OVERRIDES = {
  "Shoe stores": "kicks-vault-curated-sneaker-footwear-archive",
  "Bags, accessories and jewelry": "atelier-vera-mobile-first-luxury-storefront-paystack-checkout",
  "Watches and sunglasses": "atelier-vera-mobile-first-luxury-storefront-paystack-checkout",
  "Phone and accessories shops": "volthaus-electronics-superstore-phones-laptops-tvs-gaming-more",
  "Laptops and computer stores": "kinetic-high-performance-electronics",
  "Gaming and console stores": "volthaus-electronics-superstore-phones-laptops-tvs-gaming-more",
  "Appliances": "veluna-grand-electronics-retail-store",
  "Solar and power equipment": "kifaru-build-kenyan-hardware-construction-supply-superstore",
  "Hardware and building materials": "kifaru-build-kenyan-hardware-construction-supply-superstore",
  "Garden and plant nurseries": "harvest-lane-market-fresh-groceries-delivered-or-ready-to-collec",
  "Cosmetics and makeup": "aura-luxe-fine-botanical-cosmetics-luxury-beauty",
  "Skincare and hair products": "elura-botanicals-luxury-cosmetics-skincare",
  "Perfumes": "maison-alchemie-haute-parfumerie-niche-fragrances-18-place-vendo",
  "Pharmacies and chemists": "atelier-vera-mobile-first-luxury-storefront-paystack-checkout",
  "Wellness and supplements": "elura-botanicals-luxury-cosmetics-skincare",
  "Stationery and books": "atelier-vera-mobile-first-luxury-storefront-paystack-checkout",
  "Toys and baby products": "atelier-vera-mobile-first-luxury-storefront-paystack-checkout",
  "Gift shops and flower shops": "atelier-vera-mobile-first-luxury-storefront-paystack-checkout",
  "Pet shops and pet supplies": "atelier-vera-mobile-first-luxury-storefront-paystack-checkout",
  "Auto parts and car accessories": "autopro-kenya-premium-automotive-spares-parts",
  "Sports and fitness equipment": "volthaus-electronics-superstore-phones-laptops-tvs-gaming-more",
  "Printing and branded merchandise": "atelier-vera-mobile-first-luxury-storefront-paystack-checkout",
  "Restaurants": "mikaa-woodfire-coast-artisanal-coastal-hearth-restaurant",
  "Cafés and coffee shops": "mikaa-woodfire-coast-artisanal-coastal-hearth-restaurant",
  "Fast food and takeaway": "nairobi-feast-modern-cbd-kitchen-grill",
  "Nyama choma joints": "nairobi-feast-modern-cbd-kitchen-grill",
  "Pizzerias and burger joints": "nairobi-feast-modern-cbd-kitchen-grill",
  "Street food and kiosks": "nairobi-feast-modern-cbd-kitchen-grill",
  "Food trucks": "nairobi-feast-modern-cbd-kitchen-grill",
  "Juice and smoothie bars": "mikaa-woodfire-coast-artisanal-coastal-hearth-restaurant",
  "Butcheries": "harvest-lane-market-fresh-groceries-delivered-or-ready-to-collec",
  "Fresh produce and greengrocers": "harvest-lane-market-fresh-groceries-delivered-or-ready-to-collec",
  "Groceries and delivery services": "zima-fresh-supermarket-fresh-groceries-farm-produce-daily-essent",
  "Health food stores": "harvest-lane-market-fresh-groceries-delivered-or-ready-to-collec",
  "Spice and herb shops": "harvest-lane-market-fresh-groceries-delivered-or-ready-to-collec",
  "Catering": "nairobi-feast-modern-cbd-kitchen-grill",
  "Meal prep and subscription meals": "nairobi-feast-modern-cbd-kitchen-grill",
  "Cloud kitchens (delivery only)": "nairobi-feast-modern-cbd-kitchen-grill",
  "Event food vendors": "nairobi-feast-modern-cbd-kitchen-grill",
  "Lodges": "the-oserengoni-estate-conservancy-luxury-safari-retreat-kenya",
  "Guest houses": "elysian-stays-cinematic-vacation-boutique-short-stay-rentals",
  "Bed and breakfasts (B&Bs)": "elysian-stays-cinematic-vacation-boutique-short-stay-rentals",
  "Hostels and backpackers": "elysian-stays-cinematic-vacation-boutique-short-stay-rentals",
  "Airbnb and short-term rentals": "elysian-stays-cinematic-vacation-boutique-short-stay-rentals",
  "Villas and holiday homes": "elysian-stays-cinematic-vacation-boutique-short-stay-rentals",
  "Safari camps and tented camps": "olkeri-expeditions-luxury-kenya-safaris",
  "Campsites and glamping": "olkeri-expeditions-luxury-kenya-safaris",
  "Eco-lodges": "the-oserengoni-estate-conservancy-luxury-safari-retreat-kenya",
  "Wellness and yoga retreats": "the-oserengoni-estate-conservancy-luxury-safari-retreat-kenya",
  "Corporate retreats and conference centers": "aurelia-grand-luxury-hotels-stays-culinary-destinations",
  "Wedding and event venues": "arcadia-events-bespoke-event-planning-spatial-design-studio",
  "Farm stays": "the-oserengoni-estate-conservancy-luxury-safari-retreat-kenya",
  "Beach cottages": "elysian-stays-cinematic-vacation-boutique-short-stay-rentals",
  "Nail studios (manicure and pedicure)": "lacqueria-the-art-of-the-hand-nail-atelier-booking-shop",
  "Facial and skincare clinics": "aura-luxe-fine-botanical-cosmetics-luxury-beauty",
  "Waxing and threading studios": "blush-theory-nail-studio-editorial-nail-art-online-booking-apoth",
  "Lash and brow studios": "blush-theory-nail-studio-editorial-nail-art-online-booking-apoth",
  "Makeup artists (bridal, events, shoots)": "aura-luxe-fine-botanical-cosmetics-luxury-beauty",
  "Tanning studios": "aura-luxe-fine-botanical-cosmetics-luxury-beauty",
  "Spas": "maison-elysee-haute-coiffure-luxury-salon-beauty-atelier",
  "Massage therapy": "maison-elysee-haute-coiffure-luxury-salon-beauty-atelier",
  "Aromatherapy and body treatments": "maison-elysee-haute-coiffure-luxury-salon-beauty-atelier",
  "Sauna and steam rooms": "maison-elysee-haute-coiffure-luxury-salon-beauty-atelier",
  "Fitness studios, gyms and personal trainers": "maison-elysee-haute-coiffure-luxury-salon-beauty-atelier",
  "Yoga and pilates studios": "maison-elysee-haute-coiffure-luxury-salon-beauty-atelier",
  "Cosmetic and aesthetic clinics": "aura-luxe-fine-botanical-cosmetics-luxury-beauty",
  "Tattoo and piercing studios": "blush-theory-nail-studio-editorial-nail-art-online-booking-apoth",
  "Mobile beauty services (home visits)": "maison-elysee-haute-coiffure-luxury-salon-beauty-atelier",
  "Bridal beauty packages": "maison-elysee-haute-coiffure-luxury-salon-beauty-atelier",
  "Event production and décor": "cira-atelier-event-architecture-management",
  "Event venues": "cira-atelier-event-architecture-management"
};

export const WEBSITE_THEME_BUSINESS_GROUPS = {
  "Product Retail & E-commerce": [
    "agricra-minimarket",
    "glowmuse-beauty",
    "heenzy-footwear",
    "maridadi-living",
    "ujenzi-hub",
    "voltra-electronics",
    "vera-fashion"
  ],
  "Food & Drinks": ["freshbox-gourmet"]
};

// The till and the web form offer the same durations, from the one shared service definition.
export function webServiceDurationOptions(selected) {
  const model = window.EshopServiceModel;
  const step = model?.SERVICE_STEP_MINUTES || 15;
  const min = model?.SERVICE_MIN_MINUTES || 15;
  const max = model?.SERVICE_MAX_MINUTES || 240;
  const chosen = Number(selected) || model?.DEFAULT_SERVICE_MINUTES || 60;
  const options = [];
  for (let minutes = min; minutes <= max; minutes += step) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    const label = hours && rest ? `${hours} hr ${rest} min` : hours ? `${hours} hr` : `${minutes} min`;
    options.push(`<option value="${minutes}" ${minutes === chosen ? "selected" : ""}>${label}</option>`);
  }
  return options.join("");
}
