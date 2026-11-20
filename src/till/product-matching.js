// Pure matching helpers for the scanner: QR codes, product labels (OCR text) and photo embeddings.

export function classifyQrCode(value) {
  const content = String(value ?? '').trim().slice(0, 2000);
  if (/^(?:ESHOP-)?RECEIPT[:/]/i.test(content) || /^eshop:\/\/receipt\//i.test(content)) {
    return { type: 'receipt', label: 'Receipt reference', content };
  }
  try {
    const url = new URL(content);
    if (url.protocol === 'https:' || url.protocol === 'http:') {
      return { type: 'link', label: 'Store or web link', content: url.href };
    }
  } catch {}
  return { type: 'text', label: 'QR code text', content };
}
export function parseProductLabel(text) {
  const lines = String(text ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const fullText = lines.join('\n');
  const name = lines
    .filter((line) => /[a-z]/i.test(line) && !/\b(?:exp(?:iry)?|best before|use by|price|net wt|nutrition facts)\b/i.test(line))
    .sort((left, right) => right.length - left.length)[0] || '';
  const priceMatch = fullText.match(/(?:KES|KSh|USD|EUR|GBP|UGX|TZS|RWF|ZAR)\s*[:.]?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i)
    || fullText.match(/(?:^|\s)([0-9]+[.,][0-9]{2})(?=\s|$)/m);
  const price = priceMatch ? Number(priceMatch[1].replace(/,/g, '').replace(',', '.')) : null;
  const expiryMatch = fullText.match(/\b(?:EXP(?:IRY)?|BBE|BEST\s*BEFORE|USE\s*BY)\s*[:.]?\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i);
  let expiryDate = '';
  if (expiryMatch) {
    const [, dateText] = expiryMatch;
    let year, month, day;
    if (/^\d{4}/.test(dateText)) [year, month, day] = dateText.split(/[-/]/).map(Number);
    else {
      [day, month, year] = dateText.split(/[-/]/).map(Number);
      if (year < 100) year += year < 50 ? 2000 : 1900;
    }
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
      expiryDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return { name, price: Number.isFinite(price) ? price : null, expiryDate };
}
export function matchProductLabel(text, products) {
  const words = (value) => String(value ?? '').toLocaleLowerCase().match(/[a-z0-9]+/g) || [];
  const labelLines = String(text ?? '').split(/\r?\n/).map(words).filter((line) => line.length);
  const labelWords = labelLines.flat();
  if (!labelWords.length) return null;
  const matches = (products || []).filter((product) => {
    const nameWords = words(product.name);
    if (!nameWords.length) return false;
    return nameWords.length === 1
      ? labelLines.some((line) => line.length === 1 && line[0] === nameWords[0])
      : nameWords.length <= labelWords.length && labelWords.some((_, index) =>
        nameWords.every((word, offset) => labelWords[index + offset] === word));
  });
  if (!matches.length) return null;
  const specificity = (product) => words(product.name).length * 1000 + String(product.name).length;
  matches.sort((left, right) => specificity(right) - specificity(left));
  if (matches.length > 1 && specificity(matches[0]) === specificity(matches[1])) return null;
  return matches[0];
}
export const MIN_IMAGE_MATCH_SIMILARITY = 0.7;
export function suggestImageCategories(labels, categories) {
  const normalize = (value) => String(value ?? '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const aliases = {
    food: ['food', 'grocery', 'groceries', 'produce', 'fruit', 'vegetable', 'vegetables', 'snack', 'bread', 'dairy', 'meat', 'seafood'],
    drink: ['drink', 'drinks', 'beverage', 'beverages', 'water', 'juice', 'coffee', 'tea', 'soda', 'bottle', 'milk'],
    bakery: ['bakery', 'bread', 'cake', 'pastry', 'baked goods'],
    beauty: ['beauty', 'cosmetic', 'cosmetics', 'skincare', 'makeup', 'personal care'],
    household: ['household', 'cleaning', 'detergent', 'laundry', 'home'],
    electronics: ['electronics', 'electronic', 'device', 'phone', 'computer', 'appliance']
  };
  const normalizedLabels = (labels || []).map((label) => ({
    text: normalize(label.text),
    confidence: Number(label.confidence)
  })).filter((label) => label.text && Number.isFinite(label.confidence));
  return (categories || []).map((category) => {
    const name = normalize(category.name);
    if (!name) return null;
    let score = 0;
    let matchedLabel = '';
    for (const label of normalizedLabels) {
      let relevance = 0;
      if (label.text === name) relevance = 1;
      else if (label.text.includes(name) || name.includes(label.text)) relevance = 0.85;
      else {
        const categoryAliases = Object.entries(aliases).find(([, words]) => words.includes(name))?.[1] || [];
        const labelAliases = Object.entries(aliases).find(([, words]) => words.includes(label.text))?.[1] || [];
        if (categoryAliases.some((word) => labelAliases.includes(word))) relevance = 0.72;
      }
      const weighted = relevance * label.confidence;
      if (weighted > score) {
        score = weighted;
        matchedLabel = label.text;
      }
    }
    return score ? { categoryId: category.id, categoryName: category.name, label: matchedLabel, score } : null;
  }).filter(Boolean).sort((left, right) => right.score - left.score).slice(0, 3);
}
export function rankImageMatches(products, embedding, threshold = MIN_IMAGE_MATCH_SIMILARITY, limit = 3) {
  if (!(embedding instanceof Int8Array) || !embedding.length
    || !Number.isFinite(threshold) || threshold < -1 || threshold > 1
    || !Number.isSafeInteger(limit) || limit < 1) return [];
  const queryNorm = Math.sqrt(embedding.reduce((sum, value) => sum + value * value, 0));
  if (!queryNorm) return [];
  const matches = [];
  for (const product of products || []) {
    const hex = String(product.imageEmbeddingHex || '');
    let candidate = product.imageEmbedding;
    if (!(candidate instanceof Int8Array)) {
      if (!hex || hex.length !== embedding.length * 2 || !/^[\da-f]+$/i.test(hex)) continue;
      candidate = new Int8Array(embedding.length);
      for (let index = 0; index < candidate.length; index += 1) {
        const unsigned = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
        candidate[index] = unsigned > 127 ? unsigned - 256 : unsigned;
      }
    }
    if (candidate.length !== embedding.length) continue;
    let dot = 0, candidateNorm = 0;
    for (let index = 0; index < embedding.length; index += 1) {
      const value = candidate[index];
      dot += embedding[index] * value;
      candidateNorm += value * value;
    }
    if (!candidateNorm) continue;
    const similarity = dot / (queryNorm * Math.sqrt(candidateNorm));
    if (similarity >= threshold) matches.push({ product, similarity });
  }
  return matches.sort((left, right) => right.similarity - left.similarity).slice(0, limit);
}
