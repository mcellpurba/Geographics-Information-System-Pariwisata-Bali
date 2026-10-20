/**
 * GIS PARIWISATA BALI - SEARCH HELPER
 * Provides intelligent search query matching for GIS destinations.
 * Ensures category/entity queries (e.g. "Pantai", "Pura", "Gunung", "Air Terjun", etc.)
 * strictly return destinations of that category/type without cross-contamination.
 */

function hasWord(text, word) {
  if (!text || !word) return false;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('\\b' + escaped + '\\b', 'i').test(text);
}

function detectCategoryIntent(query) {
  if (!query) return null;
  const q = query.toLowerCase().trim();
  if (/\b(pantai|beach|pasih|pesisir)\b/i.test(q)) return 'Pantai';
  if (/\b(pura|candi|budaya|temple)\b/i.test(q)) return 'Budaya & Pura';
  if (/\b(gunung|mountain|alam|nature|danau|lake|hutan)\b/i.test(q)) return 'Alam & Gunung';
  if (/\b(air\s*terjun|waterfall|curug|terjun)\b/i.test(q)) return 'Air Terjun';
  if (/\b(rekreasi|edukasi|wahana|safari|zoo|waterbom)\b/i.test(q)) return 'Rekreasi & Edukasi';
  if (/\b(kuliner|relaksasi|spa|air\s*panas|hot\s*spring)\b/i.test(q)) return 'Kuliner & Relaksasi';
  return null;
}

function matchSearchQuery(p, query) {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  if (!q) return true;

  const name = (p.name || '').toLowerCase();
  const category = (p.category || '').toLowerCase();
  const kabupaten = (p.kabupaten || '').toLowerCase();
  const address = (p.address || '').toLowerCase();
  const facilities = (p.facilities || '').toLowerCase();
  const description = (p.description || '').toLowerCase();

  // 1. EXACT CATEGORY / ENTITY TYPE KEYWORDS
  // Pantai / Beach
  if (/^(pantai|beach|pasih|pesisir|pantaii|pantai-pantai)$/i.test(q)) {
    return category === 'pantai' || name.includes('pantai') || name.includes('beach') || name.includes('pasih');
  }

  // Pura / Temple / Candi
  if (/^(pura|temple|candi|pura-pura)$/i.test(q)) {
    return hasWord(name, 'pura') || hasWord(name, 'candi') || hasWord(name, 'temple');
  }

  // Gunung / Mountain
  if (/^(gunung|mountain|gunung-gunung)$/i.test(q)) {
    return hasWord(name, 'gunung') || hasWord(name, 'mountain');
  }

  // Air Terjun / Waterfall / Curug
  if (/^(air\s*terjun|waterfall|curug|terjun)$/i.test(q)) {
    return category === 'air terjun' || name.includes('air terjun') || name.includes('waterfall') || name.includes('curug');
  }

  // Danau / Lake
  if (/^(danau|lake)$/i.test(q)) {
    return hasWord(name, 'danau') || hasWord(name, 'lake') || name.includes('danau');
  }

  // Alam / Nature
  if (/^(alam|nature)$/i.test(q)) {
    return category === 'alam & gunung';
  }

  // Budaya / Culture
  if (/^(budaya|culture)$/i.test(q)) {
    return category === 'budaya & pura';
  }

  // Rekreasi / Edukasi / Wahana
  if (/^(rekreasi|edukasi|wahana)$/i.test(q)) {
    return category === 'rekreasi & edukasi';
  }

  // Kuliner / Relaksasi / Spa / Air Panas
  if (/^(kuliner|relaksasi|spa|air\s*panas|hot\s*spring|pemandian)$/i.test(q)) {
    return category === 'kuliner & relaksasi' || name.includes('air panas') || name.includes('hot spring');
  }

  // 2. MULTI-WORD CATEGORY QUERIES (e.g. 'pantai kuta', 'pura besakih', 'gunung batur', 'air terjun sekumpul')
  const hasPantai = /\b(pantai|beach|pasih)\b/i.test(q);
  const hasPura = /\b(pura|candi|temple)\b/i.test(q);
  const hasGunung = /\b(gunung|mountain)\b/i.test(q);
  const hasAirTerjun = /\b(air\s*terjun|waterfall|curug)\b/i.test(q);

  if (hasPantai) {
    const isBeach = category === 'pantai' || name.includes('pantai') || name.includes('beach') || name.includes('pasih');
    if (!isBeach) return false;
    const rem = q.replace(/\b(pantai|beach|pasih)\b/gi, '').trim();
    if (!rem) return true;
    return name.includes(rem) || hasWord(address, rem) || hasWord(kabupaten, rem);
  }

  if (hasPura) {
    const isPura = hasWord(name, 'pura') || hasWord(name, 'candi') || hasWord(name, 'temple') || category === 'budaya & pura';
    if (!isPura) return false;
    const rem = q.replace(/\b(pura|candi|temple)\b/gi, '').trim();
    if (!rem) return true;
    return name.includes(rem) || hasWord(address, rem) || hasWord(kabupaten, rem);
  }

  if (hasGunung) {
    const isGunung = hasWord(name, 'gunung') || hasWord(name, 'mountain');
    if (!isGunung) return false;
    const rem = q.replace(/\b(gunung|mountain)\b/gi, '').trim();
    if (!rem) return true;
    return name.includes(rem) || hasWord(address, rem) || hasWord(kabupaten, rem);
  }

  if (hasAirTerjun) {
    const isWater = category === 'air terjun' || name.includes('air terjun') || name.includes('waterfall') || name.includes('curug');
    if (!isWater) return false;
    const rem = q.replace(/\b(air\s*terjun|waterfall|curug)\b/gi, '').trim();
    if (!rem) return true;
    return name.includes(rem) || hasWord(address, rem) || hasWord(kabupaten, rem);
  }

  // 3. GENERAL SEARCH (Name, Category, Kabupaten, Address, Facilities)
  const primaryMatch = name.includes(q) ||
    category.includes(q) ||
    kabupaten.includes(q) ||
    hasWord(address, q) ||
    (q.length >= 5 && address.includes(q)) ||
    facilities.includes(q);

  if (primaryMatch) return true;

  // Description fallback ONLY for specific activities / attractions (e.g. snorkeling, surfing, sunset, lumba-lumba)
  // NEVER allow category terms like pantai, pura, gunung to search narrative description
  const categoryTerms = ['pantai', 'pura', 'gunung', 'alam', 'candi', 'laut', 'danau', 'bukit', 'air', 'wisata', 'temple', 'beach'];
  if (!categoryTerms.some(term => q.includes(term))) {
    return description.includes(q);
  }

  return false;
}

module.exports = {
  hasWord,
  detectCategoryIntent,
  matchSearchQuery
};
