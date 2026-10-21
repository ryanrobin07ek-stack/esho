import fs from 'node:fs';
// find `[...]` literal after a declaration of NAME; string/template/comment aware
export function findArraySpan(src, name) {
  const esc = name.replace(/[.$]/g, m => '\\' + m);
  const re = new RegExp('(?:(?:const|let|var)\\s+)?' + esc + '\\s*=\\s*(?:/\\*[^*]*\\*/\\s*)?\\[', 'g');
  let m;
  while ((m = re.exec(src))) {
    const start = m.index + m[0].length - 1;
    let d = 0, i = start;
    for (; i < src.length; i++) {
      const c = src[i], n = src[i + 1];
      if (c === '/' && n === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue; }
      if (c === '/' && n === '*') { i = src.indexOf('*/', i) + 1; continue; }
      if (c === '"' || c === "'") { i++; while (i < src.length && src[i] !== c) { if (src[i] === '\\') i++; i++; } continue; }
      if (c === '`') { i++; while (i < src.length && src[i] !== '`') { if (src[i] === '\\') i++; i++; } continue; }
      if (c === '[' || c === '{' || c === '(') d++;
      else if (c === ']' || c === '}' || c === ')') { d--; if (d === 0) return { start, end: i + 1 }; }
    }
  }
  return null;
}
export function mapProduct(p, entry, origText) {
  const f = entry.fields, o = {};
  const put = (k, v) => { if (k) o[k] = v; };
  const asArr = k => k && new RegExp('\\b' + k + '\\s*:\\s*\\[').test(origText);
  put(f.id, p.id); put(f.name, p.name); put(f.price, p.price); put(f.comparePrice, p.comparePrice ?? null);
  put(f.image, asArr(f.image) ? [p.image] : p.image);
  put(f.category, p.category); put(f.description, p.description ?? '');
  if (p.featured) put(f.featured, true); if (p.bestseller) put(f.bestseller, true);
  // theme-specific boolean flags (featured/bestSeller/isNew/deal...) drive home-page sections; turn them on
  const flags = {};
  for (const m of origText.matchAll(/["']?\b([A-Za-z_]\w*)["']?\s*:\s*(true|false)\b/g))
    if (!/out|sold|preorder|discontinu|hidden|disabled|archiv|inactive|draft/i.test(m[1])) flags[m[1]] = true;
  const extra = {};
  if (/\bbadge\s*:/.test(origText)) extra.badge = 'New';
  return { ...(entry.defaults || {}), ...flags, ...extra, ...o };
}
export function fillHtml(html, entry, shop) {
  const scriptRe = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
  let out = html, hit = false;
  for (const s of html.match(scriptRe) || []) {
    const span = findArraySpan(s, entry.array);
    if (!span) continue;
    const orig = s.slice(span.start, span.end);
    const mapped = shop.products.map(p => mapProduct(p, entry, orig));
    const ns = s.slice(0, span.start) + JSON.stringify(mapped) + s.slice(span.end);
    out = out.replace(s, () => ns); hit = true; break;
  }
  return hit ? out : null;
}

// ---- template mode: clone the theme's own first item so every field the theme's code reads exists ----
import vm from 'node:vm';
export function evalArray(text) {
  const mk = () => new Proxy(function(){}, { get: (t,k) => k === Symbol.toPrimitive ? () => '' : mk(), apply: () => mk(), construct: () => mk() });
  const ctx = vm.createContext(new Proxy({}, { has: () => true, get: (t,k) => k === Symbol.unscopables ? undefined : (k in globalThis ? globalThis[k] : mk()) }));
  try { return vm.runInContext('(' + text + ')', ctx, { timeout: 3000 }); } catch { return null; }
}
const IMGKEY = /(image|img|photo|picture|poster|thumb|cover|banner|src)/i;
function blank(v, key, p, depth = 0) {
  if (typeof v === 'string') {
    if (/^badge$/i.test(key)) return 'New';
    if (/^(id|slug|sku)$/i.test(key)) return p.id;
    if (/^(name|title)$/i.test(key)) return p.name;
    if (IMGKEY.test(key)) return p.image;
    if (/desc|summary|overview|tagline|about|text/i.test(key)) return p.description || '';
    if (/categor/i.test(key)) return p.category;
    if (/size|variant/i.test(key)) return 'Standard';
    return '';
  }
  if (typeof v === 'number') return /price|cost|amount|kes|usd|ksh/i.test(key) ? p.price : (/compare|original|was|old/i.test(key) ? 0 : v);
  if (typeof v === 'boolean') return /out|sold|preorder/i.test(key) ? false : true;
  if (Array.isArray(v)) {
    if (!v.length) return [];
    const first = v[0];
    if (typeof first === 'string') return [blank(first, IMGKEY.test(key) ? 'image' : (/size|variant/i.test(key) ? 'size' : key), p, depth + 1)];
    return [blank(first, key, p, depth + 1)];
  }
  if (v && typeof v === 'object') {
    const o = {};
    if (/^prices?$/i.test(key)) { for (const k of Object.keys(v)) o[k] = p.price; return o; }
    if (/multiplier/i.test(key)) { return { Standard: 1 }; }
    for (const k of Object.keys(v)) o[k] = blank(v[k], k, p, depth + 1);
    return o;
  }
  return v;
}
export function fillHtmlTemplate(html, entry, shop) {
  for (const s of html.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) || []) {
    const span = findArraySpan(s, entry.array); if (!span) continue;
    const arr = evalArray(s.slice(span.start, span.end));
    if (!Array.isArray(arr) || !arr.length || typeof arr[0] !== 'object') return null;
    const tpl = arr[0];
    const mapped = shop.products.map(p => { const x = blank(tpl, '', p); x.id = p.id; return x; });
    return html.replace(s, () => s.slice(0, span.start) + JSON.stringify(mapped) + s.slice(span.end));
  }
  return null;
}

// ---- multi-op fill: per-theme list of operations ----
// op kinds: {name, kind:'simple'|'template'|'empty'} replace that array literal; {freeze:'NAME'} make NAME.push a no-op right after its declaration
export function fillMulti(html, entry, ops, shop) {
  let out = html, done = 0;
  const scripts = html.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const op of ops) {
    for (const s of scripts) {
      let cur = out.includes(s) ? s : null; if (!cur) continue;
      if (op.freeze) {
        const re = new RegExp('((?:const|let|var)\\s+' + op.freeze + '\\s*=\\s*[^;]+;)');
        if (re.test(cur)) { out = out.replace(cur, () => cur.replace(re, `$1 ${op.freeze}.push=function(){return 0};`)); done++; break; }
        continue;
      }
      let span;
      if (op.lit === 'template') { const m = new RegExp(op.name + '\\s*=\\s*`').exec(cur); if (!m) continue; const st = m.index + m[0].length - 1; const en = cur.indexOf('`', st + 1); span = { start: st, end: en + 1 }; }
      else span = findArraySpan(cur, op.name);
      if (!span) continue;
      let json;
      if (op.custom) json = op.custom(shop);
      else if (op.kind === 'empty') json = '[]';
      else {
        const orig = cur.slice(span.start, span.end);
        if (op.kind === 'template') {
          const arr = evalArray(orig); if (!Array.isArray(arr) || !arr.length || typeof arr[0] !== 'object') return null;
          json = JSON.stringify(shop.products.map(p => { const x = blank(arr[0], '', p); x.id = p.id; return x; }));
        } else json = JSON.stringify(shop.products.map(p => mapProduct(p, entry, orig)));
      }
      let repl = json; if (op.freezeSelf) repl = json + `;${op.name}.push=function(){return 0}`;
      out = out.replace(cur, () => cur.slice(0, span.start) + repl + cur.slice(span.end)); done++; break;
    }
  }
  return done ? out : null;
}
