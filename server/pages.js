// Pages with a language in the address (/ru, /uz, /en, /en/building): the same HTML with <html lang>, <title> and the
// Open Graph block (link previews in Telegram, WhatsApp, Facebook…) in that language. The static files carry the Russian
// block with production URLs, so "/" and "/building.html" (served by the CDN without the function) are the Russian pages.
const fs = require('fs');
const path = require('path');

const LANGS = ['ru', 'uz', 'en'];
const SITE = 'https://3d-furniture-studio-mcp.vercel.app';
const LOCALE = { ru: 'ru_RU', uz: 'uz_UZ', en: 'en_US' };
const PAGES = {
  planner: { file: 'index.html', path: '', image: 'planner' },
  building: { file: 'building.html', path: '/building', image: 'building' }
};
const TEXT = {
  planner: {
    ru: ['Furniture Super Planner 3D — планировщик квартиры и мебели на заказ',
      'Задайте размеры комнат и мебели, проверьте, что поместится, пройдитесь по квартире в 3D и оставьте заявку.'],
    uz: ['Furniture Super Planner 3D — kvartira va buyurtma mebel rejalashtiruvchisi',
      'Xona va mebel o‘lchamlarini kiriting, nima sig‘ishini tekshiring, kvartirani 3D’da aylanib chiqing va ariza qoldiring.'],
    en: ['Furniture Super Planner 3D — apartment and custom furniture planner',
      'Set room and furniture sizes, check what fits, walk through the apartment in 3D and send a request.']
  },
  building: {
    ru: ['ЖК «Новостройка-12» — квартиры с планировкой и прогулкой в 3D',
      'Подбор квартиры по комнатам, площади и цене, план этажа и прогулка от улицы до квартиры в 3D.'],
    uz: ['«Novostroyka-12» TJM — rejali va 3D sayrli kvartiralar',
      'Kvartirani xonalar, maydon va narx bo‘yicha tanlash, qavat rejasi va ko‘chadan kvartiragacha 3D sayr.'],
    en: ['Novostroyka-12 — apartments with floor plans and a 3D walk',
      'Pick an apartment by rooms, area and price, see the floor plan and walk from the street to the door in 3D.']
  }
};

const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// The <head> block between <!--og--> and <!--/og-->.
function ogBlock(page, lang, origin = SITE) {
  const p = PAGES[page];
  const [title, description] = TEXT[page][lang];
  const url = `${origin}/${lang}${p.path}`;
  const meta = (attr, key, value) => `  <meta ${attr}="${key}" content="${esc(value)}">`;
  return [
    '<!--og-->',
    meta('name', 'description', description),
    `  <link rel="canonical" href="${esc(url)}">`,
    ...LANGS.map(l => `  <link rel="alternate" hreflang="${l}" href="${esc(`${origin}/${l}${p.path}`)}">`),
    meta('property', 'og:type', 'website'),
    meta('property', 'og:site_name', 'Furniture Super Planner 3D'),
    meta('property', 'og:title', title),
    meta('property', 'og:description', description),
    meta('property', 'og:url', url),
    meta('property', 'og:image', `${origin}/og/${p.image}-${lang}.png`),
    meta('property', 'og:image:width', '1200'),
    meta('property', 'og:image:height', '630'),
    meta('property', 'og:locale', LOCALE[lang]),
    ...LANGS.filter(l => l !== lang).map(l => meta('property', 'og:locale:alternate', LOCALE[l])),
    meta('name', 'twitter:card', 'summary_large_image'),
    '  <!--/og-->'
  ].join('\n');
}

const cache = new Map();
function render(page, lang, origin = SITE, publicDir = path.join(__dirname, '..', 'public')) {
  const file = path.join(publicDir, PAGES[page].file);
  if (!cache.has(file)) cache.set(file, fs.readFileSync(file, 'utf8'));
  return cache.get(file)
    .replace(/<html lang="[a-z]+">/, `<html lang="${lang}">`)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(TEXT[page][lang][0])}</title>`)
    .replace(/<!--og-->[\s\S]*?<!--\/og-->/, ogBlock(page, lang, origin));
}

module.exports = { LANGS, SITE, PAGES, TEXT, ogBlock, render };
