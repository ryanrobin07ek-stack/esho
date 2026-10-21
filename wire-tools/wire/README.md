# Skeleton wirer + adaptation test

Layout (put this `wire/` folder next to these three, same parent folder):
  skel/fixed-skeletons/      <- the FIXED skeletons zip (fill.mjs, field-maps.json, theme-skeletons/)
  claudemd/public/           <- app source (theme-skeleton-engine.js, theme-skeleton-data.js)
  themes/themes-html-css/    <- original themes (for demo-name checks + eshop-mobile.css)
  tools/field-maps.work.json <- field maps (copy of field-maps.json, Etalon defaults extended)
  wire/                      <- this folder      (needs: npm i playwright)

1. node build-engine.mjs                      # engine + generic mapper -> engine.bundle.js
2. node wire.mjs <skeletonDir> <theme>        # adds data marker + fieldMap schema -> out/<theme>/
3. node adapt-test.mjs out/<theme> <originalIndexHtml>   # renders with 0 / 1 / 3 / 50 products
4. node batch.mjs                             # steps 2+3 for the 13 retail themes

Engine change: one line in theme-skeleton-engine.js (done in build-engine.mjs at build time):
  schema.fieldMap ? mapGeneric(schema, data) : dataForTheme(schema.themeId, data)
Not tested here: styling of Tailwind-CDN themes (CDN stubbed), real images, checkout.
