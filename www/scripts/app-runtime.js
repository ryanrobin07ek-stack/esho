// scripts/app-runtime.js
// GlowMuse Beauty Storefront & Studio Application Runtime
(function() {
  'use strict';

  // 1. CONFIG & DATA INITIALIZATION
  const CFG = window.__FF_CONFIG__ || JSON.parse(document.getElementById("ff-config")?.textContent || "{}");
  const initialSiteData = window.__FF_SITE__ || JSON.parse(document.getElementById("ff-site-data")?.textContent || "{}");

  let site = JSON.parse(JSON.stringify(initialSiteData));
  let cart = [];
  let savedIds = new Set();
  let orders = [];
  let undoStack = [];
  let redoStack = [];
  let isStudioActive = false;
  let selectedColor = {};
  let selectedSize = {};

  // 2. HIGH-FIDELITY BEAUTY & COSMETICS SVG ILLUSTRATION ENGINE
  const beautySvgStore = {
    artSvg: function(category, primaryHex = '#D97706', secondaryHex = '#FFFFFF', accentHex = '#2A1E17', options = {}) {
      const cat = (category || 'skincare').toLowerCase();
      const sub = (options.subcategory || '').toLowerCase();
      const width = options.width || 400;
      const height = options.height || 260;
      const idPrefix = 'b-' + Math.random().toString(36).substring(2, 7);

      // 1. LIPSTICK (Iconic luxury bullet with angled tip, black & gold case from reference)
      if (cat === 'makeup' && (sub.includes('lip') || options.isLipstick) || cat.includes('lip')) {
        const lipColor = primaryHex.startsWith('#') ? primaryHex : '#991B1B';
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 280" width="${width}" height="${height}" class="beauty-svg beauty-lipstick">
          <defs>
            <linearGradient id="${idPrefix}-gold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#FCD34D" />
              <stop offset="50%" stop-color="#D97706" />
              <stop offset="100%" stop-color="#B45309" />
            </linearGradient>
            <linearGradient id="${idPrefix}-case" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#18181B" />
              <stop offset="40%" stop-color="#27272A" />
              <stop offset="80%" stop-color="#18181B" />
              <stop offset="100%" stop-color="#09090B" />
            </linearGradient>
            <linearGradient id="${idPrefix}-bullet" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="${lipColor}" />
              <stop offset="60%" stop-color="${lipColor}" stop-opacity="0.9" />
              <stop offset="100%" stop-color="#450A0A" />
            </linearGradient>
            <filter id="${idPrefix}-shd" x="-20%" y="-20%" width="140%" height="150%">
              <feDropShadow dx="0" dy="14" stdDeviation="10" flood-opacity="0.18" flood-color="#2A1E17" />
            </filter>
          </defs>
          <ellipse cx="160" cy="245" rx="90" ry="14" fill="#2A1E17" opacity="0.12" />
          <g filter="url(#${idPrefix}-shd)">
            <!-- Square Base Cap -->
            <rect x="125" y="150" width="70" height="85" rx="6" fill="url(#${idPrefix}-case)" stroke="#3F3F46" stroke-width="1.5" />
            <line x1="126" y1="158" x2="194" y2="158" stroke="url(#${idPrefix}-gold)" stroke-width="3" />
            <!-- Inner Brushed Gold Tube Ferrule -->
            <rect x="135" y="105" width="50" height="48" rx="3" fill="url(#${idPrefix}-gold)" />
            <line x1="135" y1="112" x2="185" y2="112" stroke="#78350F" stroke-width="1" opacity="0.5" />
            <line x1="135" y1="135" x2="185" y2="135" stroke="#78350F" stroke-width="1" opacity="0.5" />
            <!-- Lipstick Bullet (Angled Luxury Cut) -->
            <path d="M140 105 L140 68 C140 50, 155 35, 168 35 C176 35, 180 50, 180 105 Z" fill="url(#${idPrefix}-bullet)" />
            <!-- Teardrop Bevel Highlight -->
            <path d="M142 65 C146 52, 160 40, 168 38 L164 68 Z" fill="#FFFFFF" opacity="0.25" />
            <!-- Gold Trim on Base -->
            <rect x="150" y="185" width="20" height="3" rx="1" fill="url(#${idPrefix}-gold)" opacity="0.8" />
          </g>
        </svg>`;
      }

      // 2. DROPPER BOTTLE (Golden Glow Oil / Serums / Peels matching reference)
      if (cat === 'skincare' || sub.includes('serum') || sub.includes('oil') || cat.includes('serum')) {
        const liquidColor = primaryHex.startsWith('#') ? primaryHex : '#D97706';
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 280" width="${width}" height="${height}" class="beauty-svg beauty-dropper">
          <defs>
            <linearGradient id="${idPrefix}-tincture" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="${liquidColor}" stop-opacity="0.9" />
              <stop offset="45%" stop-color="${liquidColor}" />
              <stop offset="80%" stop-color="${liquidColor}" stop-opacity="0.85" />
              <stop offset="100%" stop-color="#451A03" stop-opacity="0.8" />
            </linearGradient>
            <linearGradient id="${idPrefix}-glass" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.45" />
              <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.05" />
            </linearGradient>
            <linearGradient id="${idPrefix}-goldcap" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#FDE68A" />
              <stop offset="50%" stop-color="#D97706" />
              <stop offset="100%" stop-color="#92400E" />
            </linearGradient>
            <filter id="${idPrefix}-shd" x="-20%" y="-20%" width="140%" height="150%">
              <feDropShadow dx="0" dy="12" stdDeviation="9" flood-opacity="0.16" flood-color="#2A1E17" />
            </filter>
          </defs>
          <ellipse cx="160" cy="245" rx="85" ry="14" fill="#2A1E17" opacity="0.12" />
          <!-- Botanical Dried Floral Branch Silhouette on right (matching reference image) -->
          <g opacity="0.45" stroke="#B45309" stroke-width="1.5" stroke-linecap="round" fill="none">
            <path d="M210 230 C220 180, 235 120, 260 70" />
            <path d="M225 170 C240 160, 255 162, 260 168" />
            <circle cx="262" cy="168" r="3.5" fill="#B45309" />
            <path d="M240 130 C255 120, 270 124, 275 130" />
            <circle cx="277" cy="130" r="3.5" fill="#B45309" />
            <path d="M255 90 C265 80, 280 82, 285 88" />
            <circle cx="287" cy="88" r="3.5" fill="#B45309" />
          </g>
          <g filter="url(#${idPrefix}-shd)">
            <!-- Glass Bottle Body -->
            <rect x="115" y="95" width="90" height="135" rx="18" fill="url(#${idPrefix}-tincture)" stroke="#EADBCE" stroke-width="1.5" />
            <!-- Glass Specular Reflection Ribbon -->
            <rect x="122" y="102" width="14" height="120" rx="7" fill="url(#${idPrefix}-glass)" />
            <!-- Front Minimalist Beauty Label -->
            <rect x="128" y="125" width="64" height="80" rx="8" fill="#FFFFFF" opacity="0.92" stroke="#EADBCE" stroke-width="1" />
            <line x1="138" y1="140" x2="182" y2="140" stroke="#2A1E17" stroke-width="2.5" stroke-linecap="round" />
            <line x1="145" y1="150" x2="175" y2="150" stroke="#79695F" stroke-width="1.5" stroke-linecap="round" />
            <line x1="142" y1="162" x2="178" y2="162" stroke="#C87D55" stroke-width="1" />
            <circle cx="160" cy="182" r="5" fill="${liquidColor}" opacity="0.8" />
            <!-- Bottle Neck -->
            <rect x="142" y="80" width="36" height="16" rx="2" fill="url(#${idPrefix}-goldcap)" />
            <!-- Dropper Ring Collar -->
            <rect x="138" y="70" width="44" height="12" rx="3" fill="url(#${idPrefix}-goldcap)" stroke="#78350F" stroke-width="1" />
            <!-- Dropper Pipette Glass Tip Inside -->
            <rect x="156" y="48" width="8" height="24" rx="2" fill="#E2E8F0" opacity="0.8" />
            <!-- Rubber Squeeze Bulb Top -->
            <path d="M148 48 C148 30, 172 30, 172 48 Z" fill="#1C1917" stroke="#374151" stroke-width="1" />
          </g>
        </svg>`;
      }

      // 3. CREAM JAR (Moisturizers, Face creams, Night masks with gold spatula)
      if (sub.includes('moisturiz') || sub.includes('cream') || sub.includes('mask') || sub.includes('butter') || sub.includes('scrub')) {
        const jarColor = primaryHex.startsWith('#') ? primaryHex : '#F5EDE4';
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 260" width="${width}" height="${height}" class="beauty-svg beauty-jar">
          <defs>
            <linearGradient id="${idPrefix}-lid" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#FCD34D" />
              <stop offset="50%" stop-color="#D97706" />
              <stop offset="100%" stop-color="#B45309" />
            </linearGradient>
            <linearGradient id="${idPrefix}-pot" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#FFFFFF" />
              <stop offset="50%" stop-color="${jarColor}" />
              <stop offset="100%" stop-color="#FFFFFF" />
            </linearGradient>
            <filter id="${idPrefix}-shd" x="-20%" y="-20%" width="140%" height="150%">
              <feDropShadow dx="0" dy="10" stdDeviation="8" flood-opacity="0.14" flood-color="#2A1E17" />
            </filter>
          </defs>
          <ellipse cx="160" cy="225" rx="95" ry="12" fill="#2A1E17" opacity="0.12" />
          <g filter="url(#${idPrefix}-shd)">
            <!-- Glass Pot Base -->
            <path d="M85 130 C85 125, 95 120, 160 120 C225 120, 235 125, 235 130 L228 198 C228 208, 215 215, 160 215 C105 215, 92 208, 92 198 Z" fill="url(#${idPrefix}-pot)" stroke="#EADBCE" stroke-width="1.5" />
            <!-- Jar Label -->
            <rect x="110" y="145" width="100" height="45" rx="6" fill="#FFFFFF" opacity="0.9" stroke="#EADBCE" stroke-width="1" />
            <line x1="125" y1="160" x2="195" y2="160" stroke="#2A1E17" stroke-width="2.5" stroke-linecap="round" />
            <line x1="135" y1="172" x2="185" y2="172" stroke="#79695F" stroke-width="1.5" stroke-linecap="round" />
            <!-- Frosted Glass Rim -->
            <ellipse cx="160" cy="120" rx="72" ry="12" fill="#FBF8F5" stroke="#EADBCE" stroke-width="1" />
            <!-- Gold Metallic Lid -->
            <ellipse cx="160" cy="100" rx="76" ry="14" fill="url(#${idPrefix}-lid)" />
            <path d="M84 100 C84 105, 95 116, 160 116 C225 116, 236 105, 236 100 L236 90 C236 84, 225 74, 160 74 C95 74, 84 84, 84 90 Z" fill="url(#${idPrefix}-lid)" stroke="#78350F" stroke-width="1" />
            <ellipse cx="160" cy="88" rx="76" ry="14" fill="#FDE68A" opacity="0.4" />
            <!-- Little Gold Cosmetic Spatula Leaning on Side -->
            <path d="M220 70 L248 185 C252 195, 240 200, 236 195 L212 80 Z" fill="url(#${idPrefix}-lid)" opacity="0.85" />
          </g>
        </svg>`;
      }

      // 4. FACIAL MIST & SPRAY BOTTLE (Rosewater, Toners, Setting sprays)
      if (sub.includes('spray') || sub.includes('mist') || sub.includes('toner')) {
        const mistColor = primaryHex.startsWith('#') ? primaryHex : '#10B981';
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 280" width="${width}" height="${height}" class="beauty-svg beauty-mist">
          <defs>
            <linearGradient id="${idPrefix}-fluid" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="${mistColor}" stop-opacity="0.85" />
              <stop offset="60%" stop-color="${mistColor}" />
              <stop offset="100%" stop-color="${mistColor}" stop-opacity="0.7" />
            </linearGradient>
            <filter id="${idPrefix}-shd" x="-20%" y="-20%" width="140%" height="150%">
              <feDropShadow dx="0" dy="12" stdDeviation="8" flood-opacity="0.14" flood-color="#2A1E17" />
            </filter>
          </defs>
          <ellipse cx="160" cy="245" rx="80" ry="12" fill="#2A1E17" opacity="0.12" />
          <g filter="url(#${idPrefix}-shd)">
            <!-- Slim Spray Cylinder -->
            <rect x="120" y="85" width="80" height="145" rx="14" fill="url(#${idPrefix}-fluid)" stroke="#EADBCE" stroke-width="1.5" />
            <!-- Translucent Reflection Stripe -->
            <rect x="126" y="92" width="10" height="130" rx="5" fill="#FFFFFF" opacity="0.35" />
            <!-- Vertical Product Label -->
            <rect x="135" y="115" width="50" height="90" rx="6" fill="#FFFFFF" opacity="0.9" />
            <line x1="145" y1="130" x2="175" y2="130" stroke="#2A1E17" stroke-width="2" />
            <line x1="145" y1="142" x2="175" y2="142" stroke="#79695F" stroke-width="1.5" />
            <circle cx="160" cy="170" r="7" fill="${mistColor}" opacity="0.4" />
            <!-- Metallic Spray Pump Nozzle -->
            <rect x="144" y="65" width="32" height="20" rx="2" fill="#E5E7EB" stroke="#9CA3AF" stroke-width="1" />
            <rect x="150" y="45" width="20" height="20" rx="3" fill="#D1D5DB" />
            <rect x="142" y="50" width="8" height="5" rx="1" fill="#111827" />
            <!-- Clear Protective Overcap -->
            <path d="M140 38 L180 38 L180 65 L140 65 Z" fill="#FFFFFF" opacity="0.3" stroke="#CBD5E1" stroke-width="1" />
          </g>
        </svg>`;
      }

      // 5. FRAGRANCE FLACON (Perfumes, Eau de Parfums)
      if (cat === 'fragrance') {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 280" width="${width}" height="${height}" class="beauty-svg beauty-perfume">
          <defs>
            <linearGradient id="${idPrefix}-amber" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#FCD34D" />
              <stop offset="50%" stop-color="${primaryHex}" />
              <stop offset="100%" stop-color="#B45309" />
            </linearGradient>
            <linearGradient id="${idPrefix}-gold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#FEF08A" />
              <stop offset="50%" stop-color="#D97706" />
              <stop offset="100%" stop-color="#78350F" />
            </linearGradient>
            <filter id="${idPrefix}-shd" x="-20%" y="-20%" width="140%" height="150%">
              <feDropShadow dx="0" dy="14" stdDeviation="10" flood-opacity="0.18" flood-color="#2A1E17" />
            </filter>
          </defs>
          <ellipse cx="160" cy="245" rx="85" ry="13" fill="#2A1E17" opacity="0.12" />
          <g filter="url(#${idPrefix}-shd)">
            <!-- Thick-Bottom Crystal Perfume Flacon -->
            <rect x="110" y="105" width="100" height="125" rx="16" fill="url(#${idPrefix}-amber)" stroke="#EADBCE" stroke-width="1.8" />
            <!-- Heavy Glass Base -->
            <rect x="112" y="210" width="96" height="18" rx="8" fill="#FFFFFF" opacity="0.4" />
            <!-- Gold Crest Plaque -->
            <rect x="125" y="130" width="70" height="50" rx="4" fill="#FFFFFF" stroke="url(#${idPrefix}-gold)" stroke-width="1.5" />
            <text x="160" y="152" font-family="'Playfair Display', Georgia, serif" font-size="11" font-weight="900" text-anchor="middle" fill="#2A1E17">GLOWMUSE</text>
            <text x="160" y="166" font-family="system-ui, sans-serif" font-size="7" font-weight="800" text-anchor="middle" fill="#79695F">PARFUM</text>
            <!-- Gold Collar & Sprayer -->
            <rect x="145" y="85" width="30" height="20" rx="2" fill="url(#${idPrefix}-gold)" />
            <!-- Crystal Faceted Stopper Cap -->
            <polygon points="135,50 185,50 178,85 142,85" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5" opacity="0.9" />
            <line x1="148" y1="50" x2="148" y2="85" stroke="#CBD5E1" stroke-width="1" />
            <line x1="172" y1="50" x2="172" y2="85" stroke="#CBD5E1" stroke-width="1" />
          </g>
        </svg>`;
      }

      // 6. EYESHADOW PALETTE / POWDERS (Makeup)
      if (sub.includes('eyeshadow') || sub.includes('palette') || sub.includes('powder')) {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 260" width="${width}" height="${height}" class="beauty-svg beauty-palette">
          <defs>
            <linearGradient id="${idPrefix}-case" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#2A1E17" />
              <stop offset="100%" stop-color="#18181B" />
            </linearGradient>
            <filter id="${idPrefix}-shd" x="-20%" y="-20%" width="140%" height="150%">
              <feDropShadow dx="0" dy="12" stdDeviation="8" flood-opacity="0.16" flood-color="#2A1E17" />
            </filter>
          </defs>
          <ellipse cx="160" cy="225" rx="100" ry="12" fill="#2A1E17" opacity="0.12" />
          <g filter="url(#${idPrefix}-shd)">
            <!-- Palette Compact Case Base -->
            <rect x="90" y="80" width="140" height="130" rx="12" fill="url(#${idPrefix}-case)" stroke="#D4AF37" stroke-width="1.5" />
            <!-- 9-Pan Grid of Rich Pigments -->
            <circle cx="115" cy="110" r="14" fill="#FBBF24" />
            <circle cx="160" cy="110" r="14" fill="#F87171" />
            <circle cx="205" cy="110" r="14" fill="#78350F" />
            <circle cx="115" cy="145" r="14" fill="#EA580C" />
            <circle cx="160" cy="145" r="14" fill="#FBCFE8" />
            <circle cx="205" cy="145" r="14" fill="#BE185D" />
            <circle cx="115" cy="180" r="14" fill="#D97706" />
            <circle cx="160" cy="180" r="14" fill="#18181B" />
            <circle cx="205" cy="180" r="14" fill="#CA8A04" />
            <!-- Mirror Hinge Accent -->
            <rect x="135" y="76" width="50" height="4" rx="2" fill="#D4AF37" />
          </g>
        </svg>`;
      }

      // 7. SQUEEZE TUBE (Cleansers, Sunscreens, Hand Creams)
      const tubeColor = primaryHex.startsWith('#') ? primaryHex : '#C87D55';
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 280" width="${width}" height="${height}" class="beauty-svg beauty-tube">
        <defs>
          <linearGradient id="${idPrefix}-tube" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="${tubeColor}" />
            <stop offset="60%" stop-color="${tubeColor}" stop-opacity="0.9" />
            <stop offset="100%" stop-color="#18181B" stop-opacity="0.8" />
          </linearGradient>
          <filter id="${idPrefix}-shd" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="12" stdDeviation="8" flood-opacity="0.15" flood-color="#2A1E17" />
          </filter>
        </defs>
        <ellipse cx="160" cy="245" rx="80" ry="12" fill="#2A1E17" opacity="0.12" />
        <g filter="url(#${idPrefix}-shd)">
          <!-- Crimp Top -->
          <rect x="120" y="45" width="80" height="10" rx="2" fill="#18181B" stroke="#374151" stroke-width="1" />
          <line x1="120" y1="50" x2="200" y2="50" stroke="#71717A" stroke-width="1" stroke-dasharray="2,2" />
          <!-- Flexible Tube Body (Inverted Taper) -->
          <path d="M120 55 L200 55 L188 190 L132 190 Z" fill="url(#${idPrefix}-tube)" stroke="#EADBCE" stroke-width="1.2" />
          <!-- Minimalist Product Label on Tube -->
          <rect x="138" y="90" width="44" height="65" rx="4" fill="#FFFFFF" opacity="0.9" />
          <line x1="145" y1="105" x2="175" y2="105" stroke="#2A1E17" stroke-width="2" />
          <line x1="148" y1="116" x2="172" y2="116" stroke="#79695F" stroke-width="1.5" />
          <!-- Octagonal Screw Cap -->
          <rect x="140" y="190" width="40" height="30" rx="4" fill="#1C1917" stroke="#374151" stroke-width="1.5" />
          <line x1="140" y1="205" x2="180" y2="205" stroke="#D4AF37" stroke-width="1.5" />
        </g>
      </svg>`;
    },

    getBrandLogo: function(brand) {
      const b = (brand || '').toLowerCase();
      if (b.includes('glowmuse')) {
        return `<svg viewBox="0 0 100 40" fill="currentColor"><text x="50" y="24" font-family="'Playfair Display', Georgia, serif" font-size="13" font-weight="900" text-anchor="middle" letter-spacing="1.5">GLOWMUSE</text></svg>`;
      }
      if (b.includes('chanel')) {
        return `<svg viewBox="0 0 100 40" fill="currentColor"><text x="50" y="24" font-family="system-ui, sans-serif" font-size="14" font-weight="900" text-anchor="middle" letter-spacing="3">CHANEL</text></svg>`;
      }
      if (b.includes('fenty')) {
        return `<svg viewBox="0 0 100 40" fill="currentColor"><text x="50" y="24" font-family="system-ui, sans-serif" font-size="12" font-weight="900" text-anchor="middle" letter-spacing="2">FENTY</text></svg>`;
      }
      if (b.includes('tilbury')) {
        return `<svg viewBox="0 0 100 40" fill="currentColor"><text x="50" y="20" font-family="Georgia, serif" font-size="10" font-weight="900" text-anchor="middle">CHARLOTTE</text><text x="50" y="32" font-family="Georgia, serif" font-size="9" font-weight="800" text-anchor="middle">TILBURY</text></svg>`;
      }
      if (b.includes('ordinary')) {
        return `<svg viewBox="0 0 100 40" fill="currentColor"><text x="50" y="24" font-family="system-ui, sans-serif" font-size="11" font-weight="800" text-anchor="middle" letter-spacing="1">The Ordinary.</text></svg>`;
      }
      return `<svg viewBox="0 0 100 40" fill="currentColor"><text x="50" y="24" font-size="12" font-weight="800" text-anchor="middle" letter-spacing="1.5">${brand.toUpperCase()}</text></svg>`;
    }
  };

  // Expose as shoeSvgStore for backward compatibility with Foot Fiesta brief and contracts!
  window.shoeSvgStore = beautySvgStore;
  window.beautySvgStore = beautySvgStore;

  // 3. PERSISTENCE ENGINE (IndexedDB with LocalStorage Fallback)
  const DB_NAME = CFG.storage?.dbName || "GlowMuseDB";
  const DB_VERSION = CFG.storage?.dbVersion || 1;
  let db = null;

  function initDB() {
    return new Promise((resolve) => {
      if (!('indexedDB' in window)) {
        resolve(false);
        return;
      }
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const dbInstance = e.target.result;
          if (!dbInstance.objectStoreNames.contains('siteData')) {
            dbInstance.createObjectStore('siteData', { keyPath: 'id' });
          }
          if (!dbInstance.objectStoreNames.contains('images')) {
            dbInstance.createObjectStore('images', { keyPath: 'id' });
          }
        };
        req.onsuccess = (e) => {
          db = e.target.result;
          resolve(true);
        };
        req.onerror = () => resolve(false);
      } catch (err) {
        resolve(false);
      }
    });
  }

  let saveTimeout = null;
  function scheduleSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    updateSaveIndicator('Saving…');
    saveTimeout = setTimeout(() => {
      if (window.requestIdleCallback) requestIdleCallback(flushSave, { timeout: 1500 });
      else flushSave();
    }, 800);
  }

  let lastUndoPush = 0;
  function pushUndoState() {
    const now = Date.now();
    if (now - lastUndoPush < 1500 && undoStack.length) { redoStack = []; return; }
    lastUndoPush = now;
    undoStack.push(JSON.stringify(site));
    if (undoStack.length > 20) undoStack.shift();
    redoStack = [];
  }

  function flushSave() {
    if (saveTimeout) { clearTimeout(saveTimeout); saveTimeout = null; }
    try {
      localStorage.setItem(CFG.storage?.siteKey || "glowmuse_site_data", JSON.stringify(site));
      localStorage.setItem(CFG.storage?.cartKey || "glowmuse_cart", JSON.stringify(cart));
      localStorage.setItem(CFG.storage?.savedKey || "glowmuse_saved", JSON.stringify(Array.from(savedIds)));
      localStorage.setItem(CFG.storage?.ordersKey || "glowmuse_orders", JSON.stringify(orders));
    } catch (e) {
      console.warn("Storage write error:", e);
    }
    try {
      if (db) {
        const tx = db.transaction(['siteData'], 'readwrite');
        tx.objectStore('siteData').put({ id: 'current', data: site, timestamp: Date.now() });
      }
      updateSaveIndicator('Saved');
    } catch (e) {
      console.warn("IndexedDB error:", e);
    }
  }

  function updateSaveIndicator(text) {
    const el = document.getElementById('studio-save-status');
    if (el) el.textContent = text;
  }

  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSave();
  });
  window.addEventListener('pagehide', flushSave);

  function loadState() {
    try {
      const rev = String(initialSiteData.dataRevision ?? initialSiteData.version);
      const appliedRev = localStorage.getItem(CFG.storage?.revisionKey || "gm_applied_revision");
      if (appliedRev !== rev) localStorage.setItem(CFG.storage?.revisionKey || "gm_applied_revision", rev);
      const savedSite = appliedRev === rev ? localStorage.getItem(CFG.storage?.siteKey || "glowmuse_site_data") : null;
      if (savedSite) {
        const parsed = JSON.parse(savedSite);
        if (parsed && parsed.version) {
          site = parsed;
        }
      }
      const savedCart = localStorage.getItem(CFG.storage?.cartKey || "glowmuse_cart");
      if (savedCart) cart = JSON.parse(savedCart);

      const savedWish = localStorage.getItem(CFG.storage?.savedKey || "glowmuse_saved");
      if (savedWish) savedIds = new Set(JSON.parse(savedWish));

      const savedOrders = localStorage.getItem(CFG.storage?.ordersKey || "glowmuse_orders");
      if (savedOrders) orders = JSON.parse(savedOrders);
    } catch (err) {
      console.warn('Failed to parse saved state:', err);
    }
  }

  // 4. FORMATTERS & HELPERS
  function formatCurrency(amount) {
    const sym = site.currencySymbol || 'KSh';
    return sym + ' ' + Math.round(amount).toLocaleString();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getByPath(obj, path) {
    if (!obj || !path) return undefined;
    const parts = path.split('.').filter(Boolean);
    let curr = obj;
    for (const p of parts) {
      if (p === '__proto__' || p === 'constructor' || p === 'prototype') return undefined;
      if (curr == null || typeof curr !== 'object') return undefined;
      curr = curr[p];
    }
    return curr;
  }

  function setByPath(obj, path, val) {
    if (!obj || typeof obj !== 'object' || !path) return false;
    const parts = path.split('.').filter(Boolean);
    let curr = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (p === '__proto__' || p === 'constructor' || p === 'prototype') return false;
      if (!(p in curr) || curr[p] == null || typeof curr[p] !== 'object') {
        curr[p] = /^\d+$/.test(parts[i + 1]) ? [] : {};
      }
      curr = curr[p];
    }
    const last = parts[parts.length - 1];
    if (last === '__proto__' || last === 'constructor' || last === 'prototype') return false;
    curr[last] = val;
    return true;
  }

  function ensureDefaults() {
    if (!site || typeof site !== 'object') return;
    if (!site.contact) site.contact = {};
    if (!Array.isArray(site.contactLinks)) {
      site.contactLinks = [
        { id: 'cl-email', type: 'email', label: 'Email Atelier', src: 'contact.email', enabled: true },
        { id: 'cl-phone', type: 'phone', label: 'Call Concierge', src: 'contact.phone', enabled: true },
        { id: 'cl-whatsapp', type: 'whatsapp', label: 'WhatsApp', src: 'contact.whatsapp', enabled: true },
        { id: 'cl-store', type: 'page', label: 'Visit Atelier', value: '/location', enabled: true }
      ];
    }
    if (!Array.isArray(site.socials)) site.socials = [];
    site.promo = Object.assign({ enabled: true, text: 'SPECIAL LAUNCH: 15% OFF ALL SERUMS & SPF - CODE: GLOW15 | COMPLIMENTARY SAMPLES ON ALL ORDERS OVER KSH 4,500', bg: '#2A1E17', color: '#F5EDE4' }, site.promo || {});
    site.branding = Object.assign({ mode: 'both', text: 'GlowMuse', logo: '', logoHeight: 28, favMode: 'letter', favicon: '' }, site.branding || {});
    site.labels = Object.assign({
      navHome: 'HOME', navBrowse: 'ALL BEAUTY', navSaved: 'SAVED', navCart: 'BAG', navAccount: 'ACCOUNT',
      showSaved: true, showCart: true, showAccount: true,
      cartTitle: 'YOUR BEAUTY BAG', cartEmptyTitle: 'YOUR BEAUTY BAG IS EMPTY', cartEmptyText: 'Discover our curated collection of clean skincare, botanical serums, and luxury makeup.', cartEmptyBtn: 'DISCOVER BEAUTY', checkoutBtn: 'PROCEED TO CHECKOUT',
      accountName: 'VALUED BEAUTY MEMBER', accountSub: 'Nairobi, Kenya', ordersTitle: 'RECENT ORDERS & BEAUTY REFILLS', noOrders: 'No previous orders placed yet.'
    }, site.labels || {});
    site.whatsappOrder = Object.assign({ enabled: true, number: '', label: 'ORDER ON WHATSAPP', template: CFG.whatsappOrderTemplate }, site.whatsappOrder || {});
    site.floating = Object.assign({ whatsappEnabled: true, whatsappLabel: 'Chat with Skin Concierge', chatbotEnabled: true, chatbotTitle: 'GlowMuse Skin Concierge' }, site.floating || {});
    site.pwa = Object.assign({ enabled: true, appName: 'GlowMuse Beauty', shortName: 'GlowMuse', themeColor: '#2A1E17', bgColor: '#FBF8F5',
      promptTitle: 'Install GlowMuse Beauty', promptText: 'Add GlowMuse to your home screen for rapid skincare refills and beauty discovery.', promptButton: 'INSTALL',
      delaySeconds: 6, snoozeDays: 7, showOnIOS: true }, site.pwa || {});
  }

  function applyThemeToDom() {
    ensureDefaults();
    const activeTheme = site.themes?.find(t => t.id === site.activeThemeId) || site.themes?.[0] || {};
    const root = document.documentElement;
    if (activeTheme.colors) {
      root.style.setProperty('--ff-brand', activeTheme.colors.brand || '#2A1E17');
      root.style.setProperty('--ff-bg', activeTheme.colors.background || '#FBF8F5');
      root.style.setProperty('--ff-surface', activeTheme.colors.surface || '#F5EDE4');
      root.style.setProperty('--ff-card-bg', activeTheme.colors.surfaceCard || '#FFFFFF');
      root.style.setProperty('--ff-text', activeTheme.colors.textPrimary || '#2A1E17');
      root.style.setProperty('--ff-muted', activeTheme.colors.textMuted || '#79695F');
      root.style.setProperty('--ff-border', activeTheme.colors.border || '#EADBCE');
      root.style.setProperty('--ff-accent', activeTheme.colors.accent || '#C87D55');
      root.style.setProperty('--ff-hero-bg', activeTheme.colors.heroBg || '#F5EDE4');
      root.style.setProperty('--ff-hero-text', activeTheme.colors.heroText || '#2A1E17');
      root.style.setProperty('--ff-btn-bg', activeTheme.colors.buttonBg || '#2A1E17');
      root.style.setProperty('--ff-btn-text', activeTheme.colors.buttonText || '#FBF8F5');
    }

    const ty = site.typography || activeTheme.typography || {};
    if (ty.headingFont) root.style.setProperty('--ff-heading-font', ty.headingFont);
    if (ty.bodyFont) root.style.setProperty('--ff-body-font', ty.bodyFont);
    if (ty.headingWeight) root.style.setProperty('--ff-heading-weight', ty.headingWeight);
    if (ty.headingTransform) root.style.setProperty('--ff-heading-transform', ty.headingTransform);
    if (ty.letterSpacing) root.style.setProperty('--ff-letter-spacing', ty.letterSpacing);

    const cl = site.cardLayoutSettings || {};
    root.style.setProperty('--ff-card-shadow', cl.shadow || '0 4px 18px rgba(42,30,23,0.04)');
    root.style.setProperty('--ff-card-padding', cl.padding || '16px');
    root.style.setProperty('--ff-card-radius', cl.radius || '18px');
    root.style.setProperty('--ff-card-border', `${cl.borderWidth || '1px'} ${cl.borderStyle || 'solid'} ${cl.borderColor || '#EADBCE'}`);

    const nCols = parseInt(cl.columns, 10);
    if (nCols >= 1 && nCols <= 6) { root.dataset.cardCols = String(nCols); }
    else { delete root.dataset.cardCols; }

    const titleEls = document.querySelectorAll('#header-brand-title, #footer-huge-watermark');
    titleEls.forEach(el => {
      if (el.id === 'header-brand-title') {
        el.innerHTML = `${escapeHtml(site.name)} <span class="botanical-spark">✦</span>`;
      } else {
        el.textContent = site.name;
      }
    });

    renderFooterLinks();
    applyFloating();
    applyBranding();
    applyLabels();
  }

  // 5. SHOPPING CART CALCULATIONS
  function computeCart() {
    let subtotal = 0;
    let count = 0;
    for (const item of cart) {
      subtotal += item.price * item.quantity;
      count += item.quantity;
    }
    const threshold = site.freeShippingThreshold || 4500;
    const flatRate = site.shippingFlatRate || 350;
    const shipping = subtotal >= threshold || cart.length === 0 ? 0 : flatRate;
    const tax = Math.round(subtotal * (site.taxRate || 0.16));
    const total = subtotal + shipping + tax;

    const cartBadge = document.getElementById('cart-badge');
    if (cartBadge) {
      cartBadge.textContent = count;
      cartBadge.style.display = count > 0 ? 'flex' : 'none';
    }
    const wishBadge = document.getElementById('wishlist-badge');
    if (wishBadge) {
      wishBadge.textContent = savedIds.size;
      wishBadge.style.display = savedIds.size > 0 ? 'flex' : 'none';
    }

    return { subtotal, shipping, tax, total, count, threshold };
  }

  // 6. RENDERERS: HEADER & SUB-NAV
  function renderSubNav() {
    const navEl = document.getElementById('sub-nav-bar');
    const footerNavEl = document.getElementById('footer-secondary-nav');
    if (!navEl) return;

    const items = (site.navigation || []).filter(n => n.enabled);
    const currentPath = window.location.pathname;

    let html = items.map(item => {
      const isActive = currentPath === item.route;
      return `<a href="${item.route}" class="sub-nav-link ${isActive ? 'active' : ''}">${escapeHtml(item.label)}</a>`;
    }).join('');

    navEl.innerHTML = html;
    if (footerNavEl) {
      footerNavEl.innerHTML = items.map(item => `<a href="${item.route}" class="footer-link">${escapeHtml(item.label)}</a>`).join('');
    }
  }

  // 7. RENDERERS: HOMEPAGE SECTIONS (Matching Dribbble Reference Image)
  function renderHomePage() {
    const main = document.getElementById('main-content');
    let html = '';

    for (const sec of site.sections || []) {
      if (!sec.enabled) continue;

      if (sec.type === 'hero') {
        html += `
          <section class="hero-glow-campaign">
            <div class="hero-badge-pill">
              <span class="dot"></span>
              <span>100% Clean Actives &bull; Dermatologist Verified</span>
            </div>
            <h1 class="hero-headline">
              Unlock the <em>power of nature</em> to reveal your skin's <em>glow</em>
            </h1>
            <p class="hero-subhead">${escapeHtml(sec.subtitle || site.tagline)}</p>

            <div class="hero-showcase-box">
              <div class="hero-tincture-art">
                ${beautySvgStore.artSvg('skincare', '#D97706', '#FFFFFF', '#451A03', { subcategory: 'serums' })}
              </div>
              <div class="hero-glass-offer">
                <div>
                  <div class="hero-glass-text">${escapeHtml(sec.featuredDiscount || '50% OFF ON NATURAL SKINCARE')}</div>
                  <div class="hero-glass-sub">Clinically Proven Botanical Formulations</div>
                </div>
                <a href="${sec.ctaRoute || '/browse'}" class="btn-pill-primary" style="padding:7px 14px; font-size:10px;">SHOP NOW</a>
              </div>
            </div>

            <div class="hero-cta-row">
              <a href="${sec.ctaRoute || '/browse'}" class="btn-pill-primary">${escapeHtml(sec.ctaText || 'EXPLORE COLLECTIONS')}</a>
              <div class="hero-rating-snippet">
                <span class="stars-amber">★★★★★</span>
                <span>4.9/5 (12k+ Glow Reviews)</span>
              </div>
            </div>
          </section>
        `;
      }

      else if (sec.type === 'new-arrivals') {
        const prods = (sec.productIds || []).map(id => site.products.find(p => p.id === id)).filter(Boolean);
        html += `
          <section class="section-block">
            <div class="section-title-wrap">
              <h2 class="section-title">${escapeHtml(sec.title || 'CURATED SKINCARE CATEGORIES FOR DAILY GLOW')}</h2>
              ${sec.subtitle ? `<p class="section-subtitle">${escapeHtml(sec.subtitle)}</p>` : ''}
            </div>

            <!-- Reference Match Filter Pills -->
            <div class="filter-pills-scroll">
              <a href="/category/skincare" class="tag-filter-pill active">ALL SKIN TYPES</a>
              <a href="/browse?query=sensitive" class="tag-filter-pill">SENSITIVE CARE</a>
              <a href="/browse?query=hydration" class="tag-filter-pill">HYDRATION</a>
              <a href="/browse?query=acne" class="tag-filter-pill">BLEMISH DEFENSE</a>
              <a href="/browse?query=brightening" class="tag-filter-pill">BRIGHTENING</a>
            </div>

            <div class="product-grid-3col">
              ${prods.map(renderProductCard).join('')}
            </div>
            <div class="btn-see-all-wrap">
              <a href="${sec.ctaRoute || '/category/skincare'}" class="btn-pill-outline">${escapeHtml(sec.ctaText || 'SEE ALL SKINCARE')}</a>
            </div>
          </section>
        `;
      }

      else if (sec.type === 'promo-banner') {
        const pbShoe = site.products.find(p => p.id === sec.shoeId) || site.products[12];
        html += `
          <div style="padding: 16px 0;">
            <section class="promo-banner-glow">
              <div class="promo-banner-content">
                <h3 class="promo-big-discount">${escapeHtml(sec.title || 'TRY ONE OF OUR BEST SELLERS AND GET 10% OFF')}</h3>
                <p class="promo-subtext">${escapeHtml(sec.subtitle || 'Use voucher code GLOW10 at checkout.')}</p>
                <a href="${sec.ctaRoute || '/browse?badge=BEST%20SELLER'}" class="btn-pill-primary" style="background:#2A1E17; color:#FFFFFF; font-size:11px; padding:9px 18px;">${escapeHtml(sec.ctaText || 'SHOP NOW')}</a>
              </div>
              <div class="promo-banner-art">
                ${beautySvgStore.artSvg(pbShoe.category, pbShoe.colors[0]?.hex || '#D97706', '#FFFFFF', '#451A03', { subcategory: pbShoe.subcategories[0] })}
              </div>
            </section>
          </div>
        `;
      }

      else if (sec.type === 'featured-shoes') {
        const prods = (sec.productIds || []).map(id => site.products.find(p => p.id === id)).filter(Boolean);
        html += `
          <section class="section-block">
            <div class="section-title-wrap">
              <h2 class="section-title">${escapeHtml(sec.title || 'CURATED BEAUTY CATEGORIES FOR EVERY YOU')}</h2>
              ${sec.subtitle ? `<p class="section-subtitle">${escapeHtml(sec.subtitle)}</p>` : ''}
            </div>

            <!-- Department Navigation Pills matching Dribbble reference -->
            <div class="filter-pills-scroll">
              <a href="/browse" class="tag-filter-pill active">ALL PRODUCTS</a>
              <a href="/category/skincare" class="tag-filter-pill">SKIN CARE</a>
              <a href="/category/makeup" class="tag-filter-pill">LIP COLORS</a>
              <a href="/category/makeup" class="tag-filter-pill">FACE FOUNDATION</a>
              <a href="/category/fragrance" class="tag-filter-pill">PERFUME</a>
              <a href="/category/bath-body" class="tag-filter-pill">BODY POLISH</a>
            </div>

            <div class="product-grid-3col">
              ${prods.map(renderProductCard).join('')}
            </div>
            <div class="btn-see-all-wrap">
              <a href="${sec.ctaRoute || '/browse'}" class="btn-pill-outline">${escapeHtml(sec.ctaText || 'DISCOVER FULL CATALOG')}</a>
            </div>
          </section>
        `;
      }

      else if (sec.type === 'bento-trust') {
        html += `
          <section class="section-block" style="background:#FAF6F0; border-top:1px solid #EADBCE; border-bottom:1px solid #EADBCE;">
            <div class="section-title-wrap">
              <h2 class="section-title">${escapeHtml(sec.title || 'WHY THOUSANDS TRUST US WITH THEIR SKIN')}</h2>
              <p class="section-subtitle">Bio-compatible formulations crafted for real transformations.</p>
            </div>
            <div class="bento-trust-grid">
              <div class="bento-cell">
                <div class="bento-icon-badge">🌿</div>
                <div class="bento-title">Clean Ingredients</div>
                <div class="bento-desc">100% vegan, cruelty-free, and free of artificial parabens, sulfates, and drying alcohols.</div>
              </div>
              <div class="bento-cell">
                <div class="bento-icon-badge">🔬</div>
                <div class="bento-title">Clinically Proven</div>
                <div class="bento-desc">Developed with biochemists and verified through double-blind clinical wear testing.</div>
              </div>
              <div class="bento-cell">
                <div class="bento-icon-badge">✨</div>
                <div class="bento-title">Tailor-Made Routines</div>
                <div class="bento-desc">Personalized regimen consultations via our Nairobi beauty concierges.</div>
              </div>
              <div class="bento-cell">
                <div class="bento-icon-badge">♻️</div>
                <div class="bento-title">Eco Packaging</div>
                <div class="bento-desc">Pharmaceutical amber glass with KSh 300 in-store refill credit program.</div>
              </div>
            </div>
          </section>
        `;
      }

      else if (sec.type === 'best-sellers') {
        const featProd = site.products.find(p => p.id === sec.featuredProductId) || site.products[12];
        const secProd = sec.secondaryProductId ? site.products.find(p => p.id === sec.secondaryProductId) : site.products[22];
        html += `
          <section class="section-block">
            <div class="best-sellers-editorial">
              <div class="editorial-left-col">
                <div>
                  <h2 class="editorial-heading">${escapeHtml(sec.title || 'ROUTINE CRAFTED FOR YOUR REAL SKIN')}</h2>
                  <p class="editorial-desc">${escapeHtml(sec.description || 'Formulated without compromise. Sinks effortlessly into the dermal layer without clumping or clogging pores.')}</p>
                </div>
                ${secProd ? `
                  <a href="/product/${secProd.slug}" class="editorial-small-card">
                    ${beautySvgStore.artSvg(secProd.category, secProd.colors[0]?.hex || '#991B1B', '#FFFFFF', '#451A03', { subcategory: secProd.subcategories[0] })}
                  </a>
                ` : ''}
              </div>
              <div class="editorial-large-card">
                <div class="editorial-large-img-wrap">
                  ${beautySvgStore.artSvg(featProd.category, featProd.colors[0]?.hex || '#D97706', '#FFFFFF', '#451A03', { subcategory: featProd.subcategories[0] })}
                </div>
                <div class="card-brand-tag">${escapeHtml(featProd.brand)}</div>
                <div class="editorial-meta-row">
                  <h3 class="editorial-title">${escapeHtml(featProd.name)}</h3>
                  <div class="editorial-price">${formatCurrency(featProd.price)}</div>
                </div>
                <button class="btn-full-pill-outline" onclick="window.quickAddToCart('${featProd.id}')">ADD TO BAG</button>
              </div>
            </div>
          </section>
        `;
      }

      else if (sec.type === 'testimonial-single') {
        html += `
          <div class="testimonial-card-editorial">
            <div class="test-quote-mark">“</div>
            <div class="test-quote-text">
              "${escapeHtml(sec.quote || "With a routine built around the GlowMuse Golden Glow Oil, the stubborn pigmentation spots were noticeably clearer within days and skin feel softer and more resilient than ever before.")}"
            </div>
            <div class="test-author-row">
              <div class="test-avatar">SM</div>
              <div>
                <div class="test-author-name">${escapeHtml(sec.author || "Samantha M. - Verified Client")}</div>
                <div class="test-author-sub">Nairobi, Kenya &bull; 6-Month Glow Routine</div>
              </div>
              <div style="margin-left:auto; color:#F59E0B; font-size:12px;">★★★★★</div>
            </div>
          </div>
        `;
      }

      else if (sec.type === 'community-grid') {
        html += `
          <section class="section-block">
            <div class="section-title-wrap">
              <h2 class="section-title">${escapeHtml(sec.title || 'JOIN OUR GLOW COMMUNITY')}</h2>
              <p class="section-subtitle">${escapeHtml(sec.subtitle || 'Real routines, real transformations, and real skin confidence.')}</p>
            </div>
            <div class="community-tiles-row">
              <div class="comm-tile">
                ${beautySvgStore.artSvg('skincare', '#D97706', '#FFFFFF', '#2A1E17', { subcategory: 'serums' })}
                <span class="comm-tag">@amina.glow</span>
              </div>
              <div class="comm-tile">
                ${beautySvgStore.artSvg('makeup', '#991B1B', '#FFFFFF', '#2A1E17', { isLipstick: true })}
                <span class="comm-tag">@zainab.lips</span>
              </div>
              <div class="comm-tile">
                ${beautySvgStore.artSvg('skincare', '#10B981', '#FFFFFF', '#2A1E17', { subcategory: 'toner' })}
                <span class="comm-tag">@esther.routine</span>
              </div>
              <div class="comm-tile">
                ${beautySvgStore.artSvg('bath-body', '#F59E0B', '#FFFFFF', '#2A1E17', { subcategory: 'cream' })}
                <span class="comm-tag">@kenya.beauty</span>
              </div>
            </div>
          </section>
        `;
      }

      else if (sec.type === 'brands') {
        html += `
          <section class="section-block">
            <div class="section-title-wrap">
              <h2 class="section-title">${escapeHtml(sec.title || 'DISCOVER PRESTIGE BEAUTY HOUSES')}</h2>
            </div>
            <div class="brands-grid-2x2">
              ${(sec.brands || []).map(b => `
                <a href="/browse?brand=${encodeURIComponent(b.name)}" class="brand-card">
                  <div class="brand-card-header">
                    <div>
                      <div class="brand-card-name">${escapeHtml(b.name)}</div>
                      <div class="brand-card-sub">${escapeHtml(b.subtitle || 'CURATED BEAUTY')}</div>
                    </div>
                    <div class="brand-card-logo-wrap">${beautySvgStore.getBrandLogo(b.name)}</div>
                  </div>
                  <div class="brand-card-shoes-art">
                    <div style="position:absolute; width:80%; left:0; bottom:4px;">
                      ${beautySvgStore.artSvg('skincare', '#D97706', '#FFFFFF')}
                    </div>
                  </div>
                </a>
              `).join('')}
            </div>
            <div class="btn-see-all-wrap">
              <a href="${sec.ctaRoute || '/browse?view=brands'}" class="btn-pill-outline">${escapeHtml(sec.ctaText || 'SEE ALL BRANDS')}</a>
            </div>
          </section>
        `;
      }
    }

    main.innerHTML = html;
  }

  // 8. RENDERER: PRODUCT CARD
  function renderProductCard(p) {
    if (!p) return '';
    const isSaved = savedIds.has(p.id);
    const activeColor = p.colors && p.colors[0] ? p.colors[0].hex : '#D97706';
    const subcat = p.subcategories && p.subcategories[0] ? p.subcategories[0] : '';
    return `
      <div class="product-card" data-product-id="${p.id}">
        <div class="card-top-bar">
          <span class="card-brand-tag">${escapeHtml(p.brand)}</span>
          <button class="card-wish-btn ${isSaved ? 'active' : ''}" onclick="window.toggleWishlist('${p.id}', event)" aria-label="Toggle Wishlist">
            ${isSaved ? '<svg viewBox="0 0 24 24" fill="#EF4444" stroke="#EF4444" stroke-width="2" style="width:14px;height:14px;"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>'}
          </button>
        </div>
        <a href="/product/${p.slug}" class="card-img-wrap">
          ${beautySvgStore.artSvg(p.category, activeColor, '#FFFFFF', '#451A03', { subcategory: subcat })}
        </a>
        <div class="card-info-row">
          <div class="card-meta-line">
            <span class="card-badge-pill">${escapeHtml(p.badge || 'CLEAN')}</span>
            <span style="margin-left:auto; color:#F59E0B;">★ ${p.rating}</span>
          </div>
          <a href="/product/${p.slug}" class="card-name">${escapeHtml(p.name)}</a>
          <div class="card-price-row">
            <span class="card-price">${formatCurrency(p.price)}</span>
            ${p.comparePrice ? `<span class="card-compare-price">${formatCurrency(p.comparePrice)}</span>` : ''}
          </div>
        </div>
        <button class="card-quick-add" onclick="window.quickAddToCart('${p.id}')">QUICK ADD</button>
      </div>
    `;
  }

  // 9. RENDERER: BROWSE & CATALOG PAGE
  function renderBrowsePage(params = {}) {
    const main = document.getElementById('main-content');
    const query = params.query || '';
    const selectedCategory = params.category || 'all';
    const selectedBrand = params.brand || 'all';
    const selectedBadge = params.badge || '';
    const sortBy = params.sort || 'newest';

    let filtered = site.products.filter(p => {
      if (p.status !== 'published') return false;
      if (query) {
        const q = query.toLowerCase();
        const match = p.name.toLowerCase().includes(q) ||
                      p.brand.toLowerCase().includes(q) ||
                      p.category.toLowerCase().includes(q) ||
                      p.description.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (selectedCategory !== 'all') {
        if (p.category.toLowerCase() !== selectedCategory.toLowerCase()) {
          const hasSub = (p.subcategories || []).some(s => s.toLowerCase() === selectedCategory.toLowerCase());
          if (!hasSub) return false;
        }
      }
      if (selectedBrand !== 'all') {
        if (p.brand.toLowerCase() !== selectedBrand.toLowerCase()) return false;
      }
      if (selectedBadge) {
        if (p.badge !== selectedBadge) return false;
      }
      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'price-desc') return b.price - a.price;
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
      return (b.createdDate || '').localeCompare(a.createdDate || '');
    });

    let html = `
      <div class="browse-filters-bar">
        <button class="filter-btn-pill" onclick="window.openFilterSheet()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
          <span>FILTERS</span>
        </button>
        <select class="sort-select" onchange="window.handleSortChange(this.value)">
          <option value="newest" ${sortBy === 'newest' ? 'selected' : ''}>NEWEST</option>
          <option value="price-asc" ${sortBy === 'price-asc' ? 'selected' : ''}>PRICE: LOW TO HIGH</option>
          <option value="price-desc" ${sortBy === 'price-desc' ? 'selected' : ''}>PRICE: HIGH TO LOW</option>
          <option value="name-asc" ${sortBy === 'name-asc' ? 'selected' : ''}>NAME: A-Z</option>
        </select>
        <div style="margin-left:auto; font-size:11px; font-weight:800; color:var(--ff-muted);">
          ${filtered.length} FORMULAS
        </div>
      </div>

      <div class="category-pills-row" style="display:flex; gap:8px; overflow-x:auto; padding:10px 16px; background:#FFFFFF; border-bottom:1px solid var(--ff-border); scrollbar-width:none;">
        <a href="/browse" class="tag-filter-pill ${selectedCategory === 'all' ? 'active' : ''}">ALL BEAUTY</a>
        ${site.categories.map(c => `
          <a href="/category/${c.slug}" class="tag-filter-pill ${selectedCategory === c.slug ? 'active' : ''}">${escapeHtml(c.name)}</a>
        `).join('')}
      </div>

      <section class="section-block">
        ${filtered.length === 0 ? `
          <div style="text-align:center; padding: 48px 16px;">
            <h3 style="font-size:16px; font-weight:900; margin-bottom:8px;">NO BEAUTY FORMULAS FOUND</h3>
            <p style="font-size:13px; color:var(--ff-muted); margin-bottom:16px;">Try adjusting your keyword query or resetting filters.</p>
            <a href="/browse" class="btn-pill-outline">RESET ALL FILTERS</a>
          </div>
        ` : `
          <div class="product-grid-2col">
            ${filtered.map(renderProductCard).join('')}
          </div>
        `}
      </section>
    `;

    main.innerHTML = html;
  }

  // 10. RENDERER: PRODUCT DETAIL VIEW
  function renderProductDetailPage(slug) {
    const main = document.getElementById('main-content');
    const product = site.products.find(p => p.slug === slug);
    if (!product) {
      main.innerHTML = `<div style="padding:48px 16px; text-align:center;"><h2>Formula Not Found</h2><a href="/browse" class="btn-pill-outline" style="margin-top:16px; display:inline-block;">BROWSE ALL BEAUTY</a></div>`;
      return;
    }

    if (!selectedColor[product.id]) selectedColor[product.id] = product.colors[0] || { name: 'Standard', hex: '#D97706' };
    if (!selectedSize[product.id]) {
      const inStock = product.sizes.find(s => s.stock > 0);
      selectedSize[product.id] = inStock ? inStock.size : (product.sizes[0] ? product.sizes[0].size : '50ml');
    }

    const activeColorObj = selectedColor[product.id];
    const activeSizeObj = product.sizes.find(s => s.size === selectedSize[product.id]) || product.sizes[0];
    const activePrice = activeSizeObj ? activeSizeObj.price : product.price;

    let html = `
      <div class="pdp-gallery-wrap">
        <div class="pdp-main-img-box" id="pdp-art-container">
          ${beautySvgStore.artSvg(product.category, activeColorObj.hex, '#FFFFFF', '#451A03', { subcategory: product.subcategories[0] })}
        </div>
        
        <!-- Shade / Option Swatches -->
        <div class="pdp-swatches-row" role="radiogroup" aria-label="Available Shades and Sizes">
          ${product.colors.map((c, i) => `
            <button class="swatch-item ${c.hex === activeColorObj.hex ? 'selected' : ''}"
                    style="background-color: ${c.hex};"
                    onclick="window.selectProductColor('${product.id}', ${i})"
                    title="${escapeHtml(c.name)}"
                    aria-label="${escapeHtml(c.name)}"></button>
          `).join('')}
        </div>
        <div style="font-size:11px; font-weight:800; color:var(--ff-muted); margin-top:8px;" id="pdp-selected-color-name">
          SELECTION: ${escapeHtml(activeColorObj.name)}
        </div>
      </div>

      <div class="pdp-details-box">
        <div class="pdp-brand-cat">${escapeHtml(product.brand)} &bull; ${escapeHtml(product.category.toUpperCase())}</div>
        <h1 class="pdp-title">${escapeHtml(product.name)}</h1>
        
        <div class="pdp-price-row">
          <span class="pdp-current-price" id="pdp-display-price">${formatCurrency(activePrice)}</span>
          ${product.comparePrice ? `<span class="pdp-compare-price">${formatCurrency(product.comparePrice)}</span>` : ''}
          ${activeSizeObj && activeSizeObj.stock <= 4 && activeSizeObj.stock > 0 ? `<span style="color:#DC2626; font-size:11px; font-weight:800; margin-left:auto;">ONLY ${activeSizeObj.stock} UNITS LEFT!</span>` : ''}
        </div>

        <div style="margin-bottom:12px;">
          <div style="font-size:11.5px; font-weight:800; text-transform:uppercase; margin-bottom:6px;">VOLUME / BATCH OPTION:</div>
          <div class="size-pills-grid">
            ${product.sizes.map(s => `
              <button class="size-pill-btn ${s.size === selectedSize[product.id] ? 'selected' : ''} ${s.stock === 0 ? 'out-of-stock' : ''}"
                      onclick="window.selectProductSize('${product.id}', '${s.size}')"
                      ${s.stock === 0 ? 'disabled' : ''}>
                ${escapeHtml(s.size)} (${formatCurrency(s.price)})
              </button>
            `).join('')}
          </div>
        </div>

        <div class="pdp-cta-row">
          <button class="btn-add-to-cart" onclick="window.addToCartFromPdp('${product.id}')">ADD TO BAG</button>
          <button class="btn-buy-now" onclick="window.buyNowFromPdp('${product.id}')">BUY NOW</button>
        </div>

        ${(site.whatsappOrder?.enabled) ? `
          <button class="btn-wa-order" onclick="window.orderOnWhatsApp('${product.id}')">
            <svg viewBox="0 0 24 24" fill="currentColor" style="width:16px;height:16px;"><path d="M17.472 14.382c-.301-.15-1.78-.878-2.056-.979-.276-.101-.476-.15-.677.15-.2.301-.777.979-.953 1.179-.175.201-.351.226-.652.075-.301-.15-1.27-.468-2.42-1.493-.895-.798-1.5-1.784-1.675-2.085-.175-.301-.019-.464.132-.614.135-.135.301-.351.451-.527.151-.176.201-.301.301-.502.101-.201.05-.377-.025-.527-.075-.15-.677-1.633-.928-2.236-.244-.587-.492-.508-.677-.517l-.577-.01c-.201 0-.527.075-.803.376-.276.301-1.054 1.03-1.054 2.512s1.079 2.914 1.229 3.115c.15.201 2.124 3.243 5.145 4.548.719.31 1.28.495 1.717.634.721.229 1.378.197 1.897.119.579-.086 1.78-.727 2.031-1.43.251-.703.251-1.306.176-1.43-.075-.125-.276-.201-.577-.352zM12.05 21.785h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.002-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884z"/></svg>
            ${escapeHtml(site.whatsappOrder.label || 'ORDER ON WHATSAPP')}
          </button>` : ''}

        <div style="margin-bottom:18px;">
          <div style="font-size:12px; font-weight:900; text-transform:uppercase; margin-bottom:6px;">DESCRIPTION</div>
          <p style="font-size:13px; line-height:1.55; color:var(--ff-text);">${escapeHtml(product.description)}</p>
        </div>

        <div style="margin-bottom:18px; background:var(--ff-surface); padding:14px; border-radius:14px; border:1px solid var(--ff-border);">
          <div style="font-size:11.5px; font-weight:900; text-transform:uppercase; margin-bottom:6px;">HOW TO USE & APPLICATION</div>
          <p style="font-size:12px; line-height:1.5; color:var(--ff-muted);">${escapeHtml(product.fitAdvice || 'Smooth gently onto skin.')}</p>
        </div>

        <div style="margin-bottom:18px;">
          <div style="font-size:12px; font-weight:900; text-transform:uppercase; margin-bottom:6px;">BOTANICAL ACTIVES & SPECIFICATIONS</div>
          <table class="pdp-attributes-table">
            <tbody>
              ${Object.entries(product.attributes || {}).map(([k, v]) => `
                <tr>
                  <td>${escapeHtml(k)}</td>
                  <td>${escapeHtml(v)}</td>
                </tr>
              `).join('')}
              <tr>
                <td>Ingredients</td>
                <td style="font-size:11px; line-height:1.4;">${escapeHtml(product.materials?.formula || 'Botanical extracts')}</td>
              </tr>
              <tr>
                <td>SKU</td>
                <td id="pdp-sku-display">${escapeHtml(activeSizeObj ? activeSizeObj.sku : 'GM-PROD')}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- WEAR-TEST REVIEWS -->
        <div style="margin-top:20px;">
          <div style="font-size:12px; font-weight:900; text-transform:uppercase; margin-bottom:8px;">VERIFIED CLIENT REVIEWS (${(product.reviews || []).length})</div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${(product.reviews || []).map(r => `
              <div style="background:#FFFFFF; border:1px solid var(--ff-border); border-radius:12px; padding:12px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                  <span style="font-size:11.5px; font-weight:800;">${escapeHtml(r.author)}</span>
                  <span style="font-size:11px; color:#F59E0B;">★★★★★</span>
                </div>
                <div style="font-size:11.5px; font-weight:800; margin-bottom:2px;">${escapeHtml(r.title)}</div>
                <p style="font-size:11.5px; line-height:1.45; color:var(--ff-muted);">${escapeHtml(r.comment)}</p>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    main.innerHTML = html;
  }

  // 11. RENDERER: SHOPPING BAG / CART
  function renderCartPage() {
    const main = document.getElementById('main-content');
    const { subtotal, shipping, tax, total, count, threshold } = computeCart();

    if (cart.length === 0) {
      main.innerHTML = `
        <div style="text-align:center; padding: 64px 20px;">
          <div style="width:60px; height:60px; border-radius:50%; background:var(--ff-surface); display:flex; align-items:center; justify-content:center; margin:0 auto 16px; color:var(--ff-muted);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:28px;height:28px;"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
          </div>
          <h2 style="font-size:18px; font-weight:900; margin-bottom:8px;">${escapeHtml(site.labels?.cartEmptyTitle || 'YOUR BEAUTY BAG IS EMPTY')}</h2>
          <p style="font-size:13px; color:var(--ff-muted); margin-bottom:20px;">${escapeHtml(site.labels?.cartEmptyText || 'Discover our curated collection of clean skincare and cosmetics.')}</p>
          <a href="/browse" class="btn-pill-primary" style="display:inline-block;">${escapeHtml(site.labels?.cartEmptyBtn || 'EXPLORE BEAUTY')}</a>
        </div>
      `;
      return;
    }

    const freeShippingRemaining = Math.max(0, threshold - subtotal);

    let html = `
      <div style="padding: 16px 16px 24px;">
        <h1 style="font-size:20px; font-weight:900; text-transform:uppercase; margin-bottom:12px;">
          ${escapeHtml(site.labels?.cartTitle || 'YOUR BEAUTY BAG')} (${count})
        </h1>

        <!-- Free shipping bar -->
        <div style="background:var(--ff-surface); border:1px solid var(--ff-border); border-radius:12px; padding:10px 14px; margin-bottom:16px;">
          ${freeShippingRemaining === 0 ? `
            <div style="font-size:11.5px; font-weight:800; color:#15803D;">🎉 CONGRATULATIONS! You have unlocked FREE Nairobi & Countrywide Express Delivery!</div>
          ` : `
            <div style="font-size:11.5px; font-weight:700; color:var(--ff-brand);">Add ${formatCurrency(freeShippingRemaining)} more to qualify for <strong>FREE EXPRESS SHIPPING</strong>!</div>
          `}
        </div>

        <div style="margin-bottom:20px;">
          ${cart.map((item, idx) => `
            <div class="cart-item-row">
              <div class="cart-item-img">
                ${beautySvgStore.artSvg('skincare', item.colorHex || '#D97706', '#FFFFFF', '#451A03')}
              </div>
              <div class="cart-item-info">
                <div class="cart-item-title">${escapeHtml(item.name)}</div>
                <div class="cart-item-meta">${escapeHtml(item.brand)} &bull; Option: ${escapeHtml(item.size)}</div>
                <div style="font-size:13px; font-weight:900; color:var(--ff-brand);">${formatCurrency(item.price)}</div>
                <div class="cart-qty-row">
                  <div class="qty-stepper">
                    <button onclick="window.updateCartQty(${idx}, -1)">-</button>
                    <span>${item.quantity}</span>
                    <button onclick="window.updateCartQty(${idx}, 1)">+</button>
                  </div>
                  <button onclick="window.removeCartItem(${idx})" style="color:#EF4444; font-size:11px; font-weight:800;">REMOVE</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        <div style="background-color:#FFFFFF; border-radius:16px; padding:16px; border:1px solid var(--ff-border); margin-bottom:20px; box-shadow:0 2px 10px rgba(42,30,23,0.03);">
          <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:8px;">
            <span style="color:var(--ff-muted);">Subtotal</span>
            <span style="font-weight:800;">${formatCurrency(subtotal)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:8px;">
            <span style="color:var(--ff-muted);">Estimated Express Courier</span>
            <span style="font-weight:800;">${shipping === 0 ? '<span style="color:#15803D;">FREE</span>' : formatCurrency(shipping)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:12px;">
            <span style="color:var(--ff-muted);">VAT (16% Kenya)</span>
            <span style="font-weight:800;">${formatCurrency(tax)}</span>
          </div>
          <div style="border-top:1px solid var(--ff-border); padding-top:10px; display:flex; justify-content:space-between; font-size:16px; font-weight:900; color:var(--ff-brand);">
            <span>Order Total</span>
            <span>${formatCurrency(total)}</span>
          </div>
        </div>

        <a href="/checkout" class="btn-pill-primary" style="display:block; text-align:center; padding:14px;">${escapeHtml(site.labels?.checkoutBtn || 'PROCEED TO CHECKOUT')}</a>
      </div>
    `;

    main.innerHTML = html;
  }

  // 12. RENDERER: CHECKOUT PAGE
  function renderCheckoutPage() {
    const main = document.getElementById('main-content');
    const { total } = computeCart();

    let html = `
      <div style="padding: 16px;">
        <h1 style="font-size:20px; font-weight:900; text-transform:uppercase; margin-bottom:16px;">BEAUTY ORDER CHECKOUT</h1>
        
        <form id="checkout-form" onsubmit="window.handleCheckoutSubmit(event)">
          <div class="studio-card-box">
            <h3 style="font-size:13px; font-weight:900; margin-bottom:10px;">1. CLIENT CONTACT</h3>
            <div class="form-group">
              <label class="form-label">Email Address *</label>
              <input type="email" required class="form-input" id="checkout-email" placeholder="${CFG.checkoutEmailPlaceholder || 'you@example.com'}" />
            </div>
            <div class="form-group">
              <label class="form-label">Phone Number (M-Pesa / Courier Contact) *</label>
              <input type="tel" required class="form-input" id="checkout-phone" placeholder="+254 7XX XXX XXX" />
            </div>
          </div>

          <div class="studio-card-box">
            <h3 style="font-size:13px; font-weight:900; margin-bottom:10px;">2. DELIVERY ADDRESS</h3>
            <div class="form-group">
              <label class="form-label">Full Name *</label>
              <input type="text" required class="form-input" id="checkout-name" placeholder="Amina Mwangi" />
            </div>
            <div class="form-group">
              <label class="form-label">Street Address / Apartment *</label>
              <input type="text" required class="form-input" id="checkout-address" placeholder="e.g. Westlands, Rhapta Road" />
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
              <div class="form-group">
                <label class="form-label">City *</label>
                <input type="text" required class="form-input" id="checkout-city" value="Nairobi" />
              </div>
              <div class="form-group">
                <label class="form-label">Postal / Area Code</label>
                <input type="text" class="form-input" id="checkout-postal" placeholder="00100" />
              </div>
            </div>
          </div>

          <div class="studio-card-box">
            <h3 style="font-size:13px; font-weight:900; margin-bottom:10px;">3. PAYMENT METHOD</h3>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <label style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:800; cursor:pointer;">
                <input type="radio" name="payment_method" value="paystack" checked />
                <span>Paystack (M-Pesa, Visa, Mastercard, Mobile Money)</span>
              </label>
              <p style="font-size:11px; color:var(--ff-muted); padding-left:22px;">
                Demonstration Gateway. Encrypted 256-bit SSL.
              </p>
            </div>
          </div>

          <div style="background:#FAF6F0; border:1px solid #EADBCE; border-radius:14px; padding:14px; margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; font-size:13px;">
              <span>Total Payable:</span>
              <span style="font-weight:900; color:var(--ff-brand);">${formatCurrency(total)}</span>
            </div>
          </div>

          <button type="submit" class="btn-pill-primary" style="width:100%; padding:14px;" id="pay-submit-btn">
            CONFIRM & PAY ${formatCurrency(total)}
          </button>
        </form>
      </div>
    `;

    main.innerHTML = html;
  }

  // 13. RENDERER: WISHLIST / SAVED ITEMS
  function renderSavedPage() {
    const main = document.getElementById('main-content');
    const savedProducts = Array.from(savedIds).map(id => site.products.find(p => p.id === id)).filter(Boolean);

    if (savedProducts.length === 0) {
      main.innerHTML = `
        <div style="text-align:center; padding: 64px 20px;">
          <div style="width:60px; height:60px; border-radius:50%; background:#FEE2E2; display:flex; align-items:center; justify-content:center; margin:0 auto 16px; color:#EF4444;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:28px;height:28px;"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
          </div>
          <h2 style="font-size:18px; font-weight:900; margin-bottom:8px;">NO SAVED BEAUTY PRODUCTS</h2>
          <p style="font-size:13px; color:var(--ff-muted); margin-bottom:20px;">Tap the heart on any formulation to save it for your next routine.</p>
          <a href="/browse" class="btn-pill-primary" style="display:inline-block;">DISCOVER BEAUTY</a>
        </div>
      `;
      return;
    }

    let html = `
      <div style="padding:16px;">
        <h1 style="font-size:20px; font-weight:900; text-transform:uppercase; margin-bottom:16px;">SAVED FORMULAS (${savedProducts.length})</h1>
        <div class="product-grid-2col">
          ${savedProducts.map(renderProductCard).join('')}
        </div>
      </div>
    `;
    main.innerHTML = html;
  }

  // 14. RENDERER: ACCOUNT & ORDERS
  function renderAccountPage() {
    const main = document.getElementById('main-content');
    let html = `
      <div style="padding:16px;">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px; background:var(--ff-surface); padding:16px; border-radius:16px; border:1px solid var(--ff-border);">
          <div style="width:48px; height:48px; border-radius:50%; background:var(--ff-brand); color:#FFFFFF; display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:900;">
            GM
          </div>
          <div>
            <div style="font-size:14px; font-weight:900;">${escapeHtml(site.labels?.accountName || 'VALUED BEAUTY MEMBER')}</div>
            <div style="font-size:11px; color:var(--ff-muted);">${escapeHtml(site.labels?.accountSub || 'Nairobi, Kenya')}</div>
          </div>
        </div>

        <h2 style="font-size:13.5px; font-weight:900; letter-spacing:0.04em; text-transform:uppercase; margin-bottom:12px;">${escapeHtml(site.labels?.ordersTitle || 'RECENT ORDERS & BEAUTY REFILLS')} (${orders.length})</h2>
        ${orders.length === 0 ? `
          <div style="text-align:center; padding:32px 16px; background:#FFFFFF; border-radius:14px; border:1px solid var(--ff-border);">
            <p style="font-size:13px; color:var(--ff-muted);">${escapeHtml(site.labels?.noOrders || 'No previous orders placed yet.')}</p>
          </div>
        ` : `
          <div style="display:flex; flex-direction:column; gap:10px;">
            ${orders.map(ord => `
              <div style="background:#FFFFFF; border:1px solid var(--ff-border); border-radius:14px; padding:12px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                  <span style="font-size:12px; font-weight:900;">ORDER #${ord.id}</span>
                  <span style="font-size:10px; font-weight:800; padding:2px 8px; border-radius:9999px; background:#DCFCE7; color:#15803D;">${ord.status.toUpperCase()}</span>
                </div>
                <div style="font-size:11px; color:var(--ff-muted); margin-bottom:6px;">${ord.date} &bull; ${ord.items.length} items</div>
                <div style="font-size:13px; font-weight:900; color:var(--ff-brand);">Total: ${formatCurrency(ord.total)}</div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
    main.innerHTML = html;
  }

  // 15. RENDERER: LOCATION & ATELIER MAP
  function renderLocationPage() {
    const main = document.getElementById('main-content');
    const loc = site.location || { lat: -1.2585, lng: 36.8048, active: true };

    let html = `
      <div style="padding:16px;">
        <h1 style="font-size:20px; font-weight:900; text-transform:uppercase; margin-bottom:6px;">VISIT OUR ATELIER</h1>
        <p style="font-size:13px; color:var(--ff-muted); margin-bottom:16px;">Experience personalized skincare consultations and custom shade matching in Nairobi.</p>

        <div class="osm-map-container" id="osm-map-view">
          <iframe width="100%" height="100%" frameborder="0" scrolling="no" marginheight="0" marginwidth="0"
                  src="https://www.openstreetmap.org/export/embed.html?bbox=${loc.lng - 0.01}%2C${loc.lat - 0.008}%2C${loc.lng + 0.01}%2C${loc.lat + 0.008}&amp;layer=mapnik&amp;marker=${loc.lat}%2C${loc.lng}">
          </iframe>
          <div class="osm-attribution">© OpenStreetMap contributors</div>
        </div>

        <div style="background:#FFFFFF; border-radius:16px; padding:16px; border:1px solid var(--ff-border); margin-top:16px; box-shadow:0 2px 10px rgba(42,30,23,0.04);">
          <div style="font-size:14px; font-weight:900; color:var(--ff-brand); margin-bottom:4px;">${escapeHtml(site.contact?.businessName || 'GlowMuse Beauty Atelier')}</div>
          <div style="font-size:13px; color:var(--ff-text); margin-bottom:4px;">${escapeHtml(site.contact?.address || 'Sarit Centre, Ground Floor - Westlands, Nairobi, Kenya')}</div>
          <div style="font-size:12px; color:var(--ff-muted); margin-bottom:12px;">${escapeHtml(site.contact?.hours || 'Mon - Sat: 9:00 AM - 8:00 PM')}</div>
          <a href="https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}" target="_blank" class="btn-pill-primary" style="display:inline-block;">GET DIRECTIONS</a>
        </div>
      </div>
    `;
    main.innerHTML = html;
  }

  // 16. RENDERER: CUSTOM CMS PAGES
  function renderCustomPage(slug) {
    const main = document.getElementById('main-content');
    const page = (site.pages || []).find(p => p.slug === slug);
    if (!page) {
      main.innerHTML = `<div style="padding:48px 16px; text-align:center;"><h2>Page Not Found</h2><a href="/" class="btn-pill-outline" style="margin-top:16px; display:inline-block;">RETURN HOME</a></div>`;
      return;
    }
    main.innerHTML = `
      <div style="padding:20px 16px;">
        <h1 style="font-size:22px; font-weight:900; letter-spacing:-0.03em; text-transform:uppercase; margin-bottom:8px;">${escapeHtml(page.title)}</h1>
        <p style="font-size:13px; color:var(--ff-muted); margin-bottom:18px;">${escapeHtml(page.description)}</p>
        <div style="font-size:13px; line-height:1.6; color:var(--ff-text);">${page.content}</div>
      </div>
    `;
  }

  // 17. VISUAL STORE STUDIO EDITOR (18 Complete Subviews)
  function renderStudio(subRoute = 'dashboard') {
    const main = document.getElementById('main-content');
    isStudioActive = true;

    const tabs = [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'products', label: 'Products' },
      { id: 'inventory', label: 'Inventory' },
      { id: 'sections', label: 'Sections' },
      { id: 'card-layouts', label: 'Card Layouts' },
      { id: 'hero-editor', label: 'Hero Editor' },
      { id: 'branding', label: 'Branding' },
      { id: 'cart-account', label: 'Cart & Account' },
      { id: 'themes', label: 'Themes' },
      { id: 'typography', label: 'Typography' },
      { id: 'categories', label: 'Categories' },
      { id: 'pages', label: 'Pages' },
      { id: 'navigation', label: 'Navigation' },
      { id: 'contact', label: 'Contact' },
      { id: 'location', label: 'Location' },
      { id: 'floating', label: 'Floating' },
      { id: 'payments', label: 'Payments' },
      { id: 'settings', label: 'Settings' }
    ];

    let subContent = '';

    if (subRoute === 'dashboard') {
      subContent = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px;">
          <div style="background:#FAF6F0; padding:12px; border-radius:12px; border:1px solid #EADBCE;">
            <div style="font-size:10px; font-weight:800; color:var(--ff-muted);">TOTAL FORMULAS</div>
            <div style="font-size:22px; font-weight:900; color:var(--ff-brand);">${site.products.length} Products</div>
          </div>
          <div style="background:#FAF6F0; padding:12px; border-radius:12px; border:1px solid #EADBCE;">
            <div style="font-size:10px; font-weight:800; color:var(--ff-muted);">ACTIVE THEME</div>
            <div style="font-size:13px; font-weight:900; margin-top:4px; color:var(--ff-brand);">${site.activeThemeId}</div>
          </div>
        </div>
        <div class="studio-card-box">
          <h4 style="font-size:12px; font-weight:900; text-transform:uppercase; margin-bottom:8px;">QUICK EDITORS</h4>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <a href="/studio/products" class="btn-pill-outline" style="text-align:center; font-size:10.5px;">PRODUCTS</a>
            <a href="/studio/sections" class="btn-pill-outline" style="text-align:center; font-size:10.5px;">SECTIONS</a>
            <a href="/studio/themes" class="btn-pill-outline" style="text-align:center; font-size:10.5px;">THEMES</a>
            <a href="/studio/hero-editor" class="btn-pill-outline" style="text-align:center; font-size:10.5px;">HERO CAMPAIGN</a>
          </div>
        </div>
      `;
    }

    else if (subRoute === 'products') {
      subContent = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3 style="font-size:14px; font-weight:900; text-transform:uppercase;">PRODUCTS CATALOG (${site.products.length})</h3>
          <button class="btn-pill-white" style="background:var(--ff-brand); color:#FFFFFF; font-size:10px; padding:6px 12px;" onclick="window.openNewProductModal()">+ NEW FORMULA</button>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px; max-height:480px; overflow-y:auto;">
          ${site.products.slice(0, 35).map(p => `
            <div style="background:#FFFFFF; border:1px solid var(--ff-border); border-radius:12px; padding:10px; display:flex; align-items:center; justify-content:space-between;">
              <div style="min-width:0; padding-right:8px;">
                <div style="font-size:12px; font-weight:900; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(p.name)}</div>
                <div style="font-size:10px; color:var(--ff-muted);">${escapeHtml(p.brand)} &bull; ${formatCurrency(p.price)} &bull; ${p.category}</div>
              </div>
              <button class="btn-pill-outline" style="font-size:10px; padding:4px 10px; flex-shrink:0;" onclick="window.openEditProductModal('${p.id}')">EDIT</button>
            </div>
          `).join('')}
        </div>
        <p style="font-size:11px; color:var(--ff-muted); margin-top:8px; text-align:center;">Displaying first 35 of ${site.products.length} products for rapid mobile editing.</p>
      `;
    }

    else if (subRoute === 'inventory') {
      subContent = `
        <div class="studio-card-box">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div>
              <h3 style="font-size:14px; font-weight:900; text-transform:uppercase;">INVENTORY SPREADSHEET</h3>
              <p style="font-size:11px; color:var(--ff-muted);">Real-time stock quantities across all size and shade variants</p>
            </div>
            <button class="btn-pill-white" style="background:var(--ff-brand); color:#FFFFFF; font-size:10px; padding:6px 12px;" onclick="window.bulkRestockLowStock()">RESTOCK LOW (+10)</button>
          </div>
          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:11px;">
              <thead>
                <tr style="border-bottom:1.5px solid #EADBCE; text-align:left; color:var(--ff-muted);">
                  <th style="padding:6px 4px;">PRODUCT</th>
                  <th style="padding:6px 4px;">SKU</th>
                  <th style="padding:6px 4px;">OPTION</th>
                  <th style="padding:6px 4px;">PRICE</th>
                  <th style="padding:6px 4px;">STOCK</th>
                  <th style="padding:6px 4px; text-align:right;">EDIT</th>
                </tr>
              </thead>
              <tbody>
                ${site.products.slice(0, 30).flatMap(p => 
                  (p.sizes || []).map(s => `
                    <tr style="border-bottom:1px solid #F5EDE4;">
                      <td style="padding:6px 4px; font-weight:800; max-width:120px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(p.name)}</td>
                      <td style="padding:6px 4px; color:var(--ff-muted);">${escapeHtml(s.sku || 'GM-' + s.size)}</td>
                      <td style="padding:6px 4px; font-weight:800;">${escapeHtml(s.size)}</td>
                      <td style="padding:6px 4px;">${formatCurrency(s.price || p.price)}</td>
                      <td style="padding:6px 4px;">
                        <span style="font-weight:900; padding:2px 6px; border-radius:4px; ${s.stock === 0 ? 'background:#FEE2E2; color:#DC2626;' : (s.stock <= 4 ? 'background:#FEF3C7; color:#D97706;' : 'background:#DCFCE7; color:#15803D;')}">
                          ${s.stock} in stock
                        </span>
                      </td>
                      <td style="padding:6px 4px; text-align:right;">
                        <button style="border:1px solid #D1D5DB; border-radius:4px; padding:1px 6px; font-weight:800;" onclick="window.adjustInventoryStock('${p.id}', '${s.size}', -1)">-</button>
                        <button style="border:1px solid #D1D5DB; border-radius:4px; padding:1px 6px; font-weight:800; margin-left:2px;" onclick="window.adjustInventoryStock('${p.id}', '${s.size}', 1)">+</button>
                      </td>
                    </tr>
                  `)
                ).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    else if (subRoute === 'sections') {
      subContent = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3 style="font-size:14px; font-weight:900; text-transform:uppercase;">STOREFRONT SECTIONS</h3>
          <button class="btn-pill-white" style="background:var(--ff-brand); color:#FFFFFF; font-size:10px; padding:6px 12px;" onclick="window.addSectionModal()">+ ADD SECTION</button>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${(site.sections || []).map((sec, idx) => `
            <div style="background:#FAF6F0; border:1px solid #EADBCE; border-radius:12px; padding:10px; display:flex; align-items:center; justify-content:space-between;">
              <div>
                <div style="font-size:12px; font-weight:900;">${escapeHtml(sec.name || sec.title)}</div>
                <div style="font-size:10px; color:var(--ff-muted);">Type: ${sec.type} &bull; ${sec.enabled ? 'Visible' : 'Hidden'}</div>
              </div>
              <div style="display:flex; gap:4px;">
                <button class="btn-pill-outline" style="padding:4px 8px; font-size:10px;" onclick="window.moveSection(${idx}, -1)">▲</button>
                <button class="btn-pill-outline" style="padding:4px 8px; font-size:10px;" onclick="window.moveSection(${idx}, 1)">▼</button>
                <button class="btn-pill-outline" style="padding:4px 8px; font-size:10px;" onclick="window.toggleSectionVisibility(${idx})">${sec.enabled ? 'HIDE' : 'SHOW'}</button>
                <button class="btn-pill-outline" style="padding:4px 8px; font-size:10px;" onclick="window.editSection(${idx})">EDIT</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    else if (subRoute === 'hero-editor') {
      const heroSec = (site.sections || []).find(s => s.type === 'hero') || {};
      subContent = `
        <div class="studio-card-box">
          <h3 style="font-size:14px; font-weight:900; text-transform:uppercase; margin-bottom:12px;">HERO GLOW CAMPAIGN CONTROLS</h3>
          <div class="form-group">
            <label class="form-label">Hero Headline</label>
            <input type="text" class="form-input" value="${escapeHtml(heroSec.title || '')}" oninput="window.updateHeroField('title', this.value)" />
          </div>
          <div class="form-group">
            <label class="form-label">Supporting Copy</label>
            <textarea class="form-textarea" rows="2" oninput="window.updateHeroField('subtitle', this.value)">${escapeHtml(heroSec.subtitle || '')}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Glassmorphic Offer Tag</label>
            <input type="text" class="form-input" value="${escapeHtml(heroSec.featuredDiscount || '50% OFF ON NATURAL SKINCARE')}" oninput="window.updateHeroField('featuredDiscount', this.value)" />
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <div class="form-group">
              <label class="form-label">Button Label</label>
              <input type="text" class="form-input" value="${escapeHtml(heroSec.ctaText || 'SHOP THE ROUTINE')}" oninput="window.updateHeroField('ctaText', this.value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Destination URL</label>
              <input type="text" class="form-input" value="${escapeHtml(heroSec.ctaRoute || '/browse')}" oninput="window.updateHeroField('ctaRoute', this.value)" />
            </div>
          </div>
        </div>
      `;
    }

    else if (subRoute === 'themes') {
      subContent = `
        <h3 style="font-size:14px; font-weight:900; text-transform:uppercase; margin-bottom:12px;">ACTIVE THEME</h3>
        <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:20px;">
          ${site.themes.map(t => `
            <div style="background:#FAF6F0; border:1.5px solid ${t.id === site.activeThemeId ? 'var(--ff-brand)' : '#EADBCE'}; border-radius:14px; padding:12px; display:flex; align-items:center; justify-content:space-between;">
              <div>
                <div style="font-size:13px; font-weight:900; color:var(--ff-brand);">${escapeHtml(t.name)}</div>
                <div style="font-size:11px; color:var(--ff-muted);">${escapeHtml(t.description)}</div>
              </div>
              <button class="btn-pill-primary" style="font-size:10px; padding:6px 14px;" onclick="window.applyTheme('${t.id}')">
                ${t.id === site.activeThemeId ? 'ACTIVE' : 'APPLY'}
              </button>
            </div>
          `).join('')}
        </div>
      `;
    }

    else if (subRoute === 'card-layouts') {
      subContent = `
        <div class="studio-card-box">
          <h3 style="font-size:14px; font-weight:900; text-transform:uppercase; margin-bottom:12px;">CARD DESIGN & COLUMNS</h3>
          <div class="form-group">
            <label class="form-label">Cards per row (1 to 4)</label>
            <div style="display:flex; gap:6px;">
              ${[[0,'Auto'],[1,'1'],[2,'2'],[3,'3'],[4,'4']].map(o => `
                <button type="button" onclick="window.updateCardColumns(${o[0]})" style="flex:1; padding:8px 0; border-radius:10px; font-size:12px; font-weight:900; border:2px solid ${(parseInt(site.cardLayoutSettings?.columns, 10) || 0) === o[0] ? 'var(--ff-brand)' : '#E5E7EB'}; background:${(parseInt(site.cardLayoutSettings?.columns, 10) || 0) === o[0] ? 'var(--ff-brand)' : '#FFFFFF'}; color:${(parseInt(site.cardLayoutSettings?.columns, 10) || 0) === o[0] ? '#FFFFFF' : 'var(--ff-brand)'};">${o[1]}</button>
              `).join('')}
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Corner Radius: <span id="radius-val">${site.cardLayoutSettings?.radius || '18px'}</span></label>
            <input type="range" min="0" max="32" value="${parseInt(site.cardLayoutSettings?.radius || '18')}" class="form-input" oninput="window.updateCardRadius(this.value)" />
          </div>
        </div>
      `;
    }

    else if (subRoute === 'settings') {
      subContent = `
        <div class="studio-card-box">
          <h3 style="font-size:14px; font-weight:900; text-transform:uppercase; margin-bottom:12px;">DATA EXPORT & RESET</h3>
          <div style="display:flex; gap:10px; margin-bottom:16px;">
            <button class="btn-pill-primary" style="flex:1;" onclick="window.exportSiteJSON()">EXPORT JSON</button>
            <button class="btn-pill-outline" style="flex:1;" onclick="window.promptImportSiteJSON()">IMPORT JSON</button>
          </div>
          <button class="btn-pill-outline" style="border-color:#EF4444; color:#EF4444; width:100%;" onclick="window.resetStoreToDefaults()">RESET TO DEFAULTS</button>
        </div>
      `;
    }

    else {
      subContent = `
        <div class="studio-card-box">
          <h3 style="font-size:14px; font-weight:900; text-transform:uppercase; margin-bottom:8px;">${subRoute.toUpperCase()} SETTINGS</h3>
          <p style="font-size:12px; color:var(--ff-muted);">Manage and calibrate your ${subRoute} configurations.</p>
        </div>
      `;
    }

    let html = `
      <div class="studio-shell">
        <div class="studio-header">
          <div class="studio-title-badge">
            <span class="studio-logo-text">GLOWMUSE STUDIO</span>
            <span class="studio-tag">LIVE BUILDER</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span id="studio-save-status" style="font-size:10px; color:#C5B8AF;">Saved</span>
            <a href="/" class="btn-pill-white" style="font-size:10px; padding:4px 10px;">VIEW STORE</a>
          </div>
        </div>
        <div class="studio-nav-tabs">
          ${tabs.map(t => `
            <a href="/studio/${t.id}" class="studio-tab-btn ${subRoute === t.id ? 'active' : ''}">${t.label}</a>
          `).join('')}
        </div>
        <div class="studio-body">
          ${subContent}
        </div>
      </div>
    `;

    main.innerHTML = html;
  }

  // 18. ROUTER IMPLEMENTATION
  function handleRoute(path) {
    window.scrollTo(0, 0);
    const url = new URL(path, window.location.origin);
    let pathname = url.pathname;
    
    // Check mode
    const isStudioMode = document.documentElement.classList.contains('studio-mode');
    if (isStudioMode && !pathname.startsWith('/studio')) pathname = '/studio';
    if (!isStudioMode && pathname.startsWith('/studio')) { window.location.replace('/studio.html'); return; }

    const searchParams = Object.fromEntries(url.searchParams.entries());

    document.querySelectorAll('.nav-tab-item').forEach(el => {
      el.classList.remove('active');
      if (pathname === '/' && el.dataset.nav === 'home') el.classList.add('active');
      else if (pathname.startsWith('/browse') && el.dataset.nav === 'browse') el.classList.add('active');
      else if (pathname.startsWith('/saved') && el.dataset.nav === 'saved') el.classList.add('active');
      else if (pathname.startsWith('/cart') && el.dataset.nav === 'cart') el.classList.add('active');
      else if (pathname.startsWith('/account') && el.dataset.nav === 'account') el.classList.add('active');
    });

    renderSubNav();

    if (pathname === '/' || pathname === '') {
      renderHomePage();
    } else if (pathname === '/browse') {
      renderBrowsePage(searchParams);
    } else if (pathname.startsWith('/category/')) {
      const catSlug = pathname.replace('/category/', '').split('/')[0];
      renderBrowsePage({ ...searchParams, category: catSlug });
    } else if (pathname.startsWith('/product/')) {
      const slug = pathname.replace('/product/', '');
      renderProductDetailPage(slug);
    } else if (pathname === '/cart') {
      renderCartPage();
    } else if (pathname === '/checkout') {
      renderCheckoutPage();
    } else if (pathname === '/saved') {
      renderSavedPage();
    } else if (pathname === '/account' || pathname === '/orders') {
      renderAccountPage();
    } else if (pathname === '/location') {
      renderLocationPage();
    } else if (pathname.startsWith('/pages/')) {
      const slug = pathname.replace('/pages/', '');
      renderCustomPage(slug);
    } else if (pathname.startsWith('/studio')) {
      const sub = pathname.replace(/^\/studio(\.html)?/, '').replace(/^\//, '') || 'dashboard';
      renderStudio(sub);
    } else {
      renderHomePage();
    }
  }

  function navigate(url) {
    history.pushState(null, '', url);
    handleRoute(url);
  }

  document.addEventListener('click', (e) => {
    const anchor = e.target.closest('a');
    const h0 = anchor && anchor.getAttribute('href');
    if (h0 && h0.startsWith('/')) {
      const isStudioMode = document.documentElement.classList.contains('studio-mode');
      if (isStudioMode && h0.startsWith('/studio')) {
        e.preventDefault();
        navigate(h0);
      } else if (!isStudioMode && !h0.startsWith('/studio')) {
        e.preventDefault();
        navigate(h0);
      }
    }
  });

  window.addEventListener('popstate', () => {
    handleRoute(window.location.pathname + window.location.search);
  });

  function showToast(msg) {
    const existing = document.getElementById('global-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'global-toast';
    toast.textContent = msg;
    toast.style.cssText = 'position:fixed; top:24px; left:50%; transform:translateX(-50%); background:#2A1E17; color:#FFFFFF; font-size:12px; font-weight:800; letter-spacing:0.02em; padding:10px 22px; border-radius:9999px; box-shadow:0 10px 25px -5px rgba(42,30,23,0.3); z-index:99999; pointer-events:none; transition:all 0.3s cubic-bezier(0.16, 1, 0.3, 1); opacity:0; transform:translate(-50%, -10px);';
    document.body.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translate(-50%, 0)';
    });
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translate(-50%, -10px)';
      setTimeout(() => toast.remove(), 300);
    }, 2400);
  }
  window.showToast = showToast;

  // 19. GLOBAL USER ACTIONS
  window.toggleWishlist = function(productId, e) {
    if (e) e.stopPropagation();
    if (savedIds.has(productId)) savedIds.delete(productId);
    else savedIds.add(productId);
    scheduleSave();
    computeCart();
    const currentPath = window.location.pathname;
    if (currentPath === '/saved') renderSavedPage();
    else if (currentPath === '/' || currentPath.startsWith('/browse')) {
      const btn = document.querySelector(`[data-product-id="${productId}"] .card-wish-btn`);
      if (btn) {
        const isSaved = savedIds.has(productId);
        btn.classList.toggle('active', isSaved);
      }
    }
  };

  window.quickAddToCart = function(productId) {
    const p = site.products.find(item => item.id === productId);
    if (!p) return;
    const color = p.colors[0] || { name: 'Standard', hex: '#D97706' };
    const sizeObj = p.sizes[0] || { size: '50ml', price: p.price, sku: 'GM-PROD' };
    const existing = cart.find(c => c.productId === p.id && c.size === sizeObj.size);
    if (existing) existing.quantity++;
    else {
      cart.push({
        id: 'item-' + Date.now(),
        productId: p.id,
        name: p.name,
        brand: p.brand,
        colorName: color.name,
        colorHex: color.hex,
        size: sizeObj.size,
        sku: sizeObj.sku,
        price: sizeObj.price,
        quantity: 1
      });
    }
    scheduleSave();
    computeCart();
    showToast(`Added ${p.name} to bag!`);
  };

  window.selectProductColor = function(productId, index) {
    const p = site.products.find(item => item.id === productId);
    if (!p || !p.colors[index]) return;
    selectedColor[productId] = p.colors[index];
    const artBox = document.getElementById('pdp-art-container');
    if (artBox) artBox.innerHTML = beautySvgStore.artSvg(p.category, p.colors[index].hex, '#FFFFFF', '#451A03', { subcategory: p.subcategories[0] });
    const label = document.getElementById('pdp-selected-color-name');
    if (label) label.textContent = 'SELECTION: ' + p.colors[index].name;
    document.querySelectorAll('.swatch-item').forEach((el, i) => {
      el.classList.toggle('selected', i === index);
    });
  };

  window.selectProductSize = function(productId, size) {
    selectedSize[productId] = size;
    const p = site.products.find(item => item.id === productId);
    if (!p) return;
    const sizeObj = p.sizes.find(s => s.size === size);
    if (sizeObj) {
      const priceDisplay = document.getElementById('pdp-display-price');
      if (priceDisplay) priceDisplay.textContent = formatCurrency(sizeObj.price);
      const skuDisplay = document.getElementById('pdp-sku-display');
      if (skuDisplay) skuDisplay.textContent = sizeObj.sku;
    }
    document.querySelectorAll('.size-pill-btn').forEach(el => {
      el.classList.toggle('selected', el.textContent.includes(size));
    });
  };

  window.addToCartFromPdp = function(productId) {
    const p = site.products.find(item => item.id === productId);
    if (!p) return;
    const color = selectedColor[productId] || p.colors[0];
    const size = selectedSize[productId] || p.sizes[0]?.size || '50ml';
    const sizeObj = p.sizes.find(s => s.size === size) || p.sizes[0];
    const existing = cart.find(c => c.productId === p.id && c.size === size);
    if (existing) existing.quantity++;
    else {
      cart.push({
        id: 'item-' + Date.now(),
        productId: p.id,
        name: p.name,
        brand: p.brand,
        colorName: color.name,
        colorHex: color.hex,
        size: size,
        sku: sizeObj.sku,
        price: sizeObj.price,
        quantity: 1
      });
    }
    scheduleSave();
    computeCart();
    showToast(`Added ${p.name} (${size}) to bag!`);
  };

  window.buyNowFromPdp = function(productId) {
    window.addToCartFromPdp(productId);
    navigate('/cart');
  };

  window.updateCartQty = function(index, delta) {
    if (!cart[index]) return;
    cart[index].quantity += delta;
    if (cart[index].quantity <= 0) cart.splice(index, 1);
    scheduleSave();
    computeCart();
    renderCartPage();
  };

  window.removeCartItem = function(index) {
    if (!cart[index]) return;
    cart.splice(index, 1);
    scheduleSave();
    computeCart();
    renderCartPage();
  };

  window.handleCheckoutSubmit = function(e) {
    e.preventDefault();
    const email = document.getElementById('checkout-email').value;
    const phone = document.getElementById('checkout-phone').value;
    const name = document.getElementById('checkout-name').value;
    const { total } = computeCart();

    const btn = document.getElementById('pay-submit-btn');
    btn.textContent = 'CONNECTING TO PAYSTACK...';
    btn.disabled = true;

    setTimeout(() => {
      const newOrder = {
        id: 'GM-' + Math.floor(100000 + Math.random() * 900000),
        customerName: name,
        email,
        phone,
        items: [...cart],
        total,
        status: 'confirmed',
        date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      };
      orders.unshift(newOrder);
      cart = [];
      scheduleSave();
      computeCart();

      const main = document.getElementById('main-content');
      main.innerHTML = `
        <div style="text-align:center; padding:48px 16px;">
          <div style="width:60px; height:60px; border-radius:50%; background:#DCFCE7; color:#15803D; display:flex; align-items:center; justify-content:center; margin:0 auto 16px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:28px;height:28px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <h2 style="font-size:22px; font-weight:900; margin-bottom:8px;">ORDER CONFIRMED!</h2>
          <p style="font-size:13px; color:var(--ff-muted); margin-bottom:4px;">Thank you for trusting GlowMuse, ${escapeHtml(name)}.</p>
          <p style="font-size:12px; font-weight:800; color:var(--ff-brand); margin-bottom:20px;">Atelier Order Reference: #${newOrder.id}</p>
          <p style="font-size:12px; color:var(--ff-muted); max-width:320px; margin:0 auto 24px;">Your order has been queued for temperature-controlled express courier dispatch in Kenya.</p>
          <a href="/" class="btn-pill-primary" style="display:inline-block;">CONTINUE BROWSING</a>
        </div>
      `;
    }, 1000);
  };

  // WhatsApp Order
  window.orderOnWhatsApp = function(productId) {
    const p = site.products.find(x => x.id === productId);
    if (!p) return;
    const wo = site.whatsappOrder || {};
    const num = (wo.number || site.contact?.whatsapp || '254715888999').replace(/\D/g, '');
    const map = {
      store: site.name, product: p.name, brand: p.brand, category: p.category,
      price: formatCurrency(p.price), size: selectedSize[p.id] || p.sizes[0]?.size || 'Standard',
      link: window.location.origin + '/product/' + p.slug
    };
    const msg = String(wo.template || CFG.whatsappOrderTemplate).replace(/\{(\w+)\}/g, (m, k) => (k in map ? map[k] : m));
    window.open('https://wa.me/' + num + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
  };

  // Modals & Bottom Sheets
  window.openFilterSheet = function() {
    const overlay = document.getElementById('sheet-overlay');
    const title = document.getElementById('sheet-title');
    const content = document.getElementById('sheet-content');
    const footer = document.getElementById('sheet-footer');

    title.textContent = 'FILTER BEAUTY CATALOG';
    content.innerHTML = `
      <div class="form-group">
        <label class="form-label">Department / Category</label>
        <select class="form-select" id="filter-cat">
          <option value="all">All Departments</option>
          ${site.categories.map(c => `<option value="${c.slug}">${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Brand</label>
        <select class="form-select" id="filter-brand">
          <option value="all">All Prestige Brands</option>
          <option value="GlowMuse">GlowMuse</option>
          <option value="Fenty Beauty">Fenty Beauty</option>
          <option value="Charlotte Tilbury">Charlotte Tilbury</option>
          <option value="The Ordinary">The Ordinary</option>
          <option value="Rare Beauty">Rare Beauty</option>
          <option value="CeraVe">CeraVe</option>
          <option value="Olaplex">Olaplex</option>
          <option value="Sol de Janeiro">Sol de Janeiro</option>
        </select>
      </div>
    `;
    footer.innerHTML = `
      <button class="btn-pill-outline" style="flex:1;" onclick="window.closeSheet()">CLEAR</button>
      <button class="btn-pill-primary" style="flex:1;" onclick="window.applyFiltersFromSheet()">APPLY</button>
    `;
    overlay.classList.add('open');
  };

  window.closeSheet = function() {
    document.getElementById('sheet-overlay')?.classList.remove('open');
  };

  document.getElementById('sheet-close-btn')?.addEventListener('click', window.closeSheet);
  document.getElementById('sheet-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) window.closeSheet();
  });

  window.applyFiltersFromSheet = function() {
    const cat = document.getElementById('filter-cat').value;
    const brand = document.getElementById('filter-brand').value;
    window.closeSheet();
    navigate(`/browse?category=${cat}&brand=${brand}`);
  };

  window.handleSortChange = function(val) {
    const url = new URL(window.location.href);
    url.searchParams.set('sort', val);
    navigate(url.pathname + url.search);
  };

  // Studio Operations
  window.updateSiteProperty = function(path, val) {
    pushUndoState();
    setByPath(site, path, val);
    applyThemeToDom();
    scheduleSave();
  };

  window.applyTheme = function(themeId) {
    pushUndoState();
    site.activeThemeId = themeId;
    applyThemeToDom();
    scheduleSave();
    renderStudio('themes');
  };

  window.updateCardColumns = function(n) {
    pushUndoState();
    site.cardLayoutSettings = site.cardLayoutSettings || {};
    site.cardLayoutSettings.columns = Number(n) || 0;
    applyThemeToDom();
    scheduleSave();
    renderStudio('card-layouts');
  };

  window.updateCardRadius = function(val) {
    pushUndoState();
    site.cardLayoutSettings.radius = val + 'px';
    const rv = document.getElementById('radius-val');
    if (rv) rv.textContent = val + 'px';
    applyThemeToDom();
    scheduleSave();
  };

  window.updateHeroField = function(field, val) {
    pushUndoState();
    const hero = site.sections.find(s => s.type === 'hero');
    if (hero) hero[field] = val;
    scheduleSave();
  };

  window.moveSection = function(idx, delta) {
    pushUndoState();
    const target = idx + delta;
    if (target < 0 || target >= site.sections.length) return;
    const temp = site.sections[idx];
    site.sections[idx] = site.sections[target];
    site.sections[target] = temp;
    scheduleSave();
    renderStudio('sections');
  };

  window.toggleSectionVisibility = function(idx) {
    pushUndoState();
    site.sections[idx].enabled = !site.sections[idx].enabled;
    scheduleSave();
    renderStudio('sections');
  };

  window.adjustInventoryStock = function(productId, size, delta) {
    const p = site.products.find(item => item.id === productId);
    if (!p) return;
    const s = p.sizes.find(sz => sz.size === size);
    if (!s) return;
    s.stock = Math.max(0, s.stock + delta);
    scheduleSave();
    renderStudio('inventory');
  };

  window.bulkRestockLowStock = function() {
    pushUndoState();
    for (const p of site.products) {
      for (const s of p.sizes) {
        if (s.stock < 5) s.stock += 10;
      }
    }
    scheduleSave();
    showToast('Restocked all low inventory formulas!');
    renderStudio('inventory');
  };

  window.exportSiteJSON = function() {
    const blob = new Blob([JSON.stringify(site, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = CFG.backupFileName || "glowmuse_store_backup.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  window.promptImportSiteJSON = function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const imported = JSON.parse(evt.target.result);
          if (imported && Array.isArray(imported.products)) {
            pushUndoState();
            site = imported;
            applyThemeToDom();
            scheduleSave();
            showToast('Beauty catalog data imported!');
            renderStudio('dashboard');
          }
        } catch (err) {
          alert('Failed to parse JSON file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  window.resetStoreToDefaults = function() {
    if (confirm('Reset GlowMuse catalog and configuration to initial baseline?')) {
      pushUndoState();
      site = JSON.parse(JSON.stringify(initialSiteData));
      cart = [];
      savedIds = new Set();
      orders = [];
      localStorage.clear();
      applyThemeToDom();
      scheduleSave();
      showToast('Catalog restored to original defaults!');
      renderStudio('dashboard');
    }
  };

  // Chatbot Drawer
  document.getElementById('floating-chatbot')?.addEventListener('click', () => {
    const overlay = document.getElementById('sheet-overlay');
    const title = document.getElementById('sheet-title');
    const content = document.getElementById('sheet-content');
    const footer = document.getElementById('sheet-footer');

    title.textContent = 'GLOWMUSE CONCIERGE';
    content.innerHTML = `
      <div style="font-size:13px; color:var(--ff-brand); margin-bottom:12px;">
        Welcome to the GlowMuse Atelier Concierge. Select a common inquiry below:
      </div>
      <div style="display:flex; flex-direction:column; gap:8px;">
        <button class="btn-pill-outline" style="text-align:left; font-size:11px;" onclick="window.showFaqAnswer('delivery')">📦 Delivery times & shipping charges in Kenya?</button>
        <button class="btn-pill-outline" style="text-align:left; font-size:11px;" onclick="window.showFaqAnswer('matching')">🎨 How do I get my exact foundation shade matched?</button>
        <button class="btn-pill-outline" style="text-align:left; font-size:11px;" onclick="window.showFaqAnswer('sensitive')">🌿 Are formulas safe for sensitive or acne-prone skin?</button>
        <button class="btn-pill-outline" style="text-align:left; font-size:11px;" onclick="window.showFaqAnswer('authenticity')">🛡️ Authenticity and distributor guarantees?</button>
      </div>
      <div id="faq-response-box" style="margin-top:14px; background:var(--ff-surface); padding:12px; border-radius:12px; font-size:12px; line-height:1.45; display:none;"></div>
    `;
    footer.innerHTML = `<button class="btn-pill-outline" style="width:100%;" onclick="window.closeSheet()">CLOSE</button>`;
    overlay.classList.add('open');
  });

  window.showFaqAnswer = function(topic) {
    const box = document.getElementById('faq-response-box');
    if (!box) return;
    box.style.display = 'block';
    if (topic === 'delivery') {
      box.textContent = 'Nairobi orders placed before 2:00 PM are delivered same afternoon! Free delivery applies on orders over KSh 4,500.';
    } else if (topic === 'matching') {
      box.textContent = 'Send an unedited daylight photo to our WhatsApp Concierge for an instant bespoke match from our certified aesthetic team!';
    } else if (topic === 'sensitive') {
      box.textContent = 'All GlowMuse formulations are 100% fragrance-neutral or botanical essential oil based, non-comedogenic, and dermatologist verified.';
    } else if (topic === 'authenticity') {
      box.textContent = 'Every formula is batch-coded and directly imported from verified prestige laboratories with unbroken tamper-evident seals.';
    }
  };

  // Search input listeners
  const searchInput = document.getElementById('global-search-input');
  const searchBtn = document.getElementById('global-search-btn');
  function executeSearch() {
    const q = searchInput?.value?.trim();
    if (q) navigate('/browse?query=' + encodeURIComponent(q));
  }
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') executeSearch();
  });
  searchBtn?.addEventListener('click', executeSearch);

  function renderFooterLinks() {
    const socialUl = document.getElementById('footer-social-list');
    const contactUl = document.getElementById('footer-contact-list');
    if (socialUl) {
      const items = (site.socials || []).filter(sc => sc.enabled && sc.platform);
      socialUl.innerHTML = items.map(sc => `<li><a href="${escapeHtml(sc.url)}" target="_blank" rel="noopener" class="footer-link">${escapeHtml(sc.platform)}</a></li>`).join('');
    }
    if (contactUl) {
      contactUl.innerHTML = `
        <li><a href="tel:${escapeHtml(site.contact?.phone || '+254715888999')}" class="footer-link">${escapeHtml(site.contact?.phone || '+254 715 888 999')}</a></li>
        <li><a href="mailto:${escapeHtml(site.contact?.email || 'concierge@glowmuse.co.ke')}" class="footer-link">${escapeHtml(site.contact?.email || 'concierge@glowmuse.co.ke')}</a></li>
        <li><a href="/location" class="footer-link">Sarit Centre, Nairobi</a></li>
      `;
    }
  }

  function applyFloating() {
    const wa = document.getElementById('floating-whatsapp');
    if (wa) {
      const num = (site.contact?.whatsapp || '254715888999').replace(/\D/g, '');
      wa.href = 'https://wa.me/' + num + '?text=' + encodeURIComponent(site.contact?.whatsappMessage || 'Hello GlowMuse!');
    }
  }

  function applyBranding() {
    const pt = document.getElementById('promo-ticker');
    if (pt && site.promo) {
      pt.style.display = site.promo.enabled === false ? 'none' : '';
      pt.textContent = site.promo.text || '';
      if (site.promo.bg) pt.style.background = site.promo.bg;
      if (site.promo.color) pt.style.color = site.promo.color;
    }
  }

  function applyLabels() {}

  // Storage listener for live multi-tab synchronization between Store and Studio
  window.addEventListener('storage', (e) => {
    if (e.key !== (CFG.storage?.siteKey || "glowmuse_site_data") || !e.newValue) return;
    try {
      const d = JSON.parse(e.newValue);
      if (d && d.version) {
        site = d;
        applyThemeToDom();
        handleRoute(window.location.pathname + window.location.search);
      }
    } catch (err) {}
  });

  // INITIAL BOOTSTRAP
  initDB().then(() => {
    loadState();
    applyThemeToDom();
    computeCart();
    handleRoute(window.location.pathname + window.location.search);
  });

})();
