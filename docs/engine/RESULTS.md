# Theme mapping test results (products only) - round 2

Method: the theme's product data in the ORIGINAL HTML is replaced with 3 fake shop products, the page is
rendered in headless Chromium (CDN libraries stubbed, no network) and checked for: shop products visible
on the page, JS errors, and original demo product names left behind.
Run: `cd pw-folder && node run.mjs` (all) or `node run.mjs <theme>`.

## Works: shop products render, 0 JS errors (17 themes)
aura-luxe, elura-botanicals, atelier-vera, autopro-kenya, etalon, kicks-vault, kinetic-electronics,
maison-alchemie, veluna, woodora, volthaus, aurex-electronics, shamba-bora, olkeri-expeditions,
nairobi-feast, aurus-real-estate, elysian-stays

Demo product names still present after fill: veluna 6/25 and elysian-stays 1/8 (visible on page),
maison-alchemie 5/9 (visible; hardcoded marketing text), woodora 1/16 and shamba-bora 5/207 (script source only),
aura-luxe 1/19 (script source only). atelier-vera, kicks-vault, volthaus: leak not measurable (no extracted original list).

## Still failing (6)
- kifaru-build: only 1/3 shown. Seed list swapped and generator disabled (demo names in source fell 97 -> 3), but the department/search views do not show the products. Needs its page flow checked.
- index (grocery): JS error reading 'id'. Pipe-delimited seed replaced; the theme expects fields my row format leaves empty.
- shop (nail supplies): 0/3 shown, no error. Row-format seed replaced; rendering path not yet found.
- blush-nailtech: 2/3 shown. Products list works; one product hidden by a limit or section rule. Its SERVICES list not mapped.
- mikaa-woodfire-coast: 0/3. Its mapped array is a photo gallery, not products. Menu data is elsewhere.
- arcadia-events: data lives in APP_DATA.services (object, not an array). Not handled.

## Not attempted
maison-elysee (salon, services built by function), cira-atelier (no product data), oserengoni-estate and zima-fresh (React bundles).

## What this does NOT cover
- Hardcoded static copy: hero text, reviews, phone/email/address, socials, meta/og tags, JSON-LD (e.g. maison-alchemie still names its perfumes in marketing text).
- Images: themes whose image comes from their own photo picker (atelier-vera, shop, index) ignore the shop image.
- Category lists / filter chips are still the theme's own.
- Cart, checkout and prices in other currencies were not exercised.
- "Shown" means the 3 test product names appear somewhere in the rendered default page; every page/route was not visited.
- Test ran with CDN libraries stubbed; a real browser with network was not used.
