import fs from 'node:fs'; import path from 'node:path';
import { chromium } from 'playwright';
import { fillHtml, fillHtmlTemplate, fillMulti } from './fill.mjs';
const MODE = process.argv[3] || 'simple';
const T = '/home/claude/themes/themes-html-css', maps = JSON.parse(fs.readFileSync('/home/claude/field-maps.json'));
const FOLD = {"aura-luxe":"aura-luxe","elura-botanicals":"#U00e9lura","atelier-vera":"atelier-v","autopro-kenya":"autopro","etalon":"etalon","kicks-vault":"kicks-vault","kifaru-build":"kifaru","kinetic-electronics":"kinetic","maison-alchemie":"maison-alch","veluna":"veluna","woodora":"woodora","volthaus":"volthaus","aurex-electronics":"aurex","shamba-bora":"shamba","olkeri-expeditions":"olkeri","index (grocery)":"index","shop (nail supplies)":"shop","blush-nailtech":"blush nail","nairobi-feast":"nairobi-feast","aurus-real-estate":"aurus","elysian-stays":"elysian","arcadia-events":"arcadia","mikaa-woodfire-coast":"mikaa"};
const OPS = {
  'kicks-vault': [{name:'MODEL_BLUEPRINTS',kind:'template'},{name:'EXTRA_VARIANTS',kind:'empty'}],
  'kifaru-build': [{name:'PRODUCT_BLUEPRINTS',kind:'template'},{freeze:'CATALOG_PRODUCTS'}],
  'shop (nail supplies)': [{name:'PRODUCT_SEED',custom: sh => JSON.stringify(sh.products.map(p => [p.name,'',p.category,'',p.price,p.comparePrice||null,50,5,0,p.description||'','',''])) }],
  'atelier-vera': [{name:'RAW_CATALOG',custom: sh => JSON.stringify(sh.products.map(p => [p.category,p.name,p.price,p.comparePrice||null,'','','',['One Size'],['Default']])) }],
  'index (grocery)': [{name:'PRODUCT_SEED',lit:'template',custom: sh => '`\n' + sh.products.map(p => [p.name,'',p.category,'',p.price,'each','',''].join('|')).join('\n') + '\n`' }],
  'volthaus': [{name:'PRODUCTS',kind:'simple',freezeSelf:true}],
  'blush-nailtech': [{name:'SHOP_PRODUCTS',kind:'template'}],
  'olkeri-expeditions': [{name:'PACKAGES',kind:'template'}],
  'maison-alchemie': [{name:'PRODUCTS',kind:'template'}],
};
const dir = k => fs.readdirSync(T).find(d => d.toLowerCase().startsWith(FOLD[k].toLowerCase()));
const IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#888"/></svg>');
const shop = { products: [
 {id:'s1',name:'ZQ Alpha Widget',price:1111,image:IMG,category:'one',description:'ZQ desc one'},
 {id:'s2',name:'ZQ Beta Widget',price:2222,comparePrice:3000,image:IMG,category:'two',description:'ZQ desc two'},
 {id:'s3',name:'ZQ Gamma Widget',price:3333,image:IMG,category:'one',description:'ZQ desc three'}]};
const b = await chromium.launch(); const rows = [];
const only = process.argv[2];
for (const entry of maps) {
  if (!FOLD[entry.theme] || !entry.array) continue; if (only && entry.theme !== only) continue;
  const d = dir(entry.theme), orig = fs.readFileSync(path.join(T, d, 'index.html'), 'utf8');
  let cat = {}; try { cat = JSON.parse(fs.readFileSync(`/home/claude/catalogs/${entry.theme}.catalog.json`, 'utf8')); } catch {}
  const demoNames = (cat.products || []).map(p => p.name).filter(n => n && n.length > 6);
  const cids = (cat.categories || []).map(c => c.id).filter(Boolean); const rawCat = (cat.products||[]).map(p=>p.category).filter(Boolean);
  const FORCE = {'atelier-vera':['apparel'],'shop (nail supplies)':['polish','gel'],'index (grocery)':['fresh-produce']};
  const useCats = FORCE[entry.theme] ? FORCE[entry.theme] : rawCat.length ? [...new Set(rawCat)].slice(0,2) : (cids.length ? cids.slice(0,2) : ['one','two']);
  const thisShop = { products: shop.products.map((p,i)=>({...p, category: useCats[i % useCats.length]})) };
  const filled = OPS[entry.theme] ? fillMulti(orig, entry, OPS[entry.theme], thisShop) : (MODE === 'template' ? fillHtmlTemplate(orig, entry, thisShop) : fillHtml(orig, entry, thisShop));
  if (!filled) { rows.push({theme: entry.theme, shopShownInDOM:'NO-ARRAY'}); continue; }
  const fp = `/tmp/filled-${entry.theme}.html`; fs.writeFileSync(fp, filled);
  const pg = await b.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(String(e.message).slice(0, 90)));
  await pg.addInitScript(() => {
    const mk = () => new Proxy(function(){}, { get: (t,k) => k === Symbol.toPrimitive ? () => '' : mk(), apply: () => mk(), construct: () => mk() });
    for (const k of ['lucide','tailwind','gsap','ScrollTrigger','Swiper','AOS','Chart','Alpine','feather','Lenis','THREE','Splide','Flickity'])
      try { window[k] = mk(); } catch {}
  });
  await pg.route('**/*', r => /^(file|data|about):/.test(r.request().url()) ? r.continue() : r.abort());
  await pg.goto('file://' + fp, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(1200); await pg.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=600){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,60));}window.scrollTo(0,0);}); await pg.waitForTimeout(800);
  const dom = await pg.evaluate(() => { const c = document.documentElement.cloneNode(true); c.querySelectorAll('script,style').forEach(n => n.remove()); return c.outerHTML; });
  const shown = ['ZQ Alpha','ZQ Beta','ZQ Gamma'].filter(n => dom.includes(n)).length;
  const domLeaks = demoNames.filter(n => dom.includes(n.replace(/&/g,'&amp;')) || dom.includes(n));
  const srcLeaks = demoNames.filter(n => filled.includes(n));
  const realErrs = errs.filter(e => !/tailwind is not defined/.test(e));
  rows.push({theme: entry.theme, shopShownInDOM: shown + '/3', realJsErrors: realErrs.length, firstErr: realErrs[0] || '', demoInDOM: `${domLeaks.length}/${demoNames.length}`, demoInSource: `${srcLeaks.length}/${demoNames.length}`});
  await pg.close();
}
await b.close(); console.table(rows);
