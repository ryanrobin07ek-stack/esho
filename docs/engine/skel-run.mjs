import fs from 'node:fs'; import path from 'node:path';
import { chromium } from 'playwright';
import { fillMulti } from './fill.mjs';
const S = '/home/claude/demoeo', maps = JSON.parse(fs.readFileSync('/home/claude/field-maps.json'));
const PFX = {"aura-luxe":"aura-luxe","elura-botanicals":"elura","atelier-vera":"atelier-vera","autopro-kenya":"autopro","etalon":"etalon","kicks-vault":"kicks-vault","kifaru-build":"kifaru","kinetic-electronics":"kinetic","maison-alchemie":"maison-alchemie","veluna":"veluna","woodora":"woodora","volthaus":"volthaus","aurex-electronics":"aurex","shamba-bora":"shamba","olkeri-expeditions":"olkeri","nairobi-feast":"nairobi","aurus-real-estate":"aurus","elysian-stays":"elysian","arcadia-events":"arcadia","mikaa-woodfire-coast":"mikaa","blush-nailtech":"blush-theory","index (grocery)":"harvest-lane","shop (nail supplies)":"lacqueria","aurelia-hotels":"aurelia","maison-elysee":"maison-elysee"};
const OPS = {
  'kicks-vault': [{name:'MODEL_BLUEPRINTS',kind:'template'},{name:'EXTRA_VARIANTS',kind:'empty'}],
  'kifaru-build': [{name:'PRODUCT_BLUEPRINTS',kind:'template'},{freeze:'CATALOG_PRODUCTS'}],
  'shop (nail supplies)': [{name:'PRODUCT_SEED',custom: sh => JSON.stringify(sh.products.map(p => [p.name,'',p.category,'',p.price,p.comparePrice||null,50,5,0,p.description||'','',''])) }],
  'atelier-vera': [{name:'RAW_CATALOG',custom: sh => JSON.stringify(sh.products.map(p => [p.category,p.name,p.price,p.comparePrice||null,'','','',['One Size'],['Default']])) }],
  'index (grocery)': [{name:'PRODUCT_SEED',lit:'template',custom: sh => '`\n' + sh.products.map(p => [p.name,'',p.category,'',p.price,'each','',''].join('|')).join('\n') + '\n`' }],
  'volthaus': [{name:'PRODUCTS',kind:'simple',freezeSelf:true}],
  'blush-nailtech': [{name:'SHOP_PRODUCTS',kind:'template'}],
};
const IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#888"/></svg>');
const base = [
 {id:'s1',name:'ZQ Alpha Widget',price:1111,image:IMG,description:'ZQ desc one'},
 {id:'s2',name:'ZQ Beta Widget',price:2222,comparePrice:3000,image:IMG,description:'ZQ desc two'},
 {id:'s3',name:'ZQ Gamma Widget',price:3333,image:IMG,description:'ZQ desc three'}];
const b = await chromium.launch(); const rows = []; const only = process.argv[2];
for (const entry of maps) {
  const pf = PFX[entry.theme]; if (!pf || !entry.array) continue; if (only && entry.theme !== only) continue;
  const dd = fs.readdirSync(S).find(d => d.startsWith(pf)); if (!dd) continue;
  const sk = fs.readFileSync(path.join(S, dd, 'index.html'), 'utf8');
  let cat = {}; try { cat = JSON.parse(fs.readFileSync(`/home/claude/catalogs/${entry.theme}.catalog.json`, 'utf8')); } catch {}
  const demoNames = (cat.products || []).map(p => p.name).filter(n => n && n.length > 6);
  const FORCE = {'atelier-vera':['apparel'],'shop (nail supplies)':['polish','gel'],'index (grocery)':['fresh-produce']};
  const cats = FORCE[entry.theme] || [...new Set((cat.products||[]).map(p=>p.category).filter(Boolean))].slice(0,2) || ['one'];
  const c2 = cats.length ? cats : ['one','two'];
  const shop = { products: base.map((p,i)=>({...p, category: c2[i % c2.length]})) };
  const ops = OPS[entry.theme] || [{name: entry.array, kind:'template'}];
  const filled = fillMulti(sk, entry, ops, shop);
  if (!filled) { rows.push({theme: entry.theme, shown:'NO-ARRAY'}); continue; }
  const filled2 = filled.replace(/\sdata-eshop-skeleton-preview=""/, '');
  const fp = `/tmp/sk-${entry.theme.replace(/\W+/g,'_')}.html`; fs.writeFileSync(fp, filled2);
  const pg = await b.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(String(e.message).slice(0, 90)));
  await pg.addInitScript(() => { const mk = () => new Proxy(function(){}, { get: (t,k) => k === Symbol.toPrimitive ? () => '' : mk(), apply: () => mk(), construct: () => mk() }); for (const k of ['lucide','tailwind','gsap','ScrollTrigger','Swiper','AOS','Chart','Alpine','feather','Lenis','THREE']) try { window[k] = mk(); } catch {} });
  await pg.route('**/*', r => /^(file|data|about):/.test(r.request().url()) ? r.continue() : r.abort());
  await pg.goto('file://' + fp, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(1200);
  await pg.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=600){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,50));}window.scrollTo(0,0);}); await pg.waitForTimeout(600);
  const dom = await pg.evaluate(() => { const c = document.documentElement.cloneNode(true); c.querySelectorAll('script,style').forEach(n => n.remove()); return c.outerHTML; });
  const shown = ['ZQ Alpha','ZQ Beta','ZQ Gamma'].filter(n => dom.includes(n)).length;
  const dl = demoNames.filter(n => dom.includes(n)).length, sl = demoNames.filter(n => filled2.includes(n)).length;
  rows.push({theme: entry.theme, shown: shown+'/3', errs: errs.length, firstErr: errs[0]||'', demoDOM: `${dl}/${demoNames.length}`, demoSrc: `${sl}/${demoNames.length}`});
  await pg.close();
}
await b.close(); console.table(rows);
