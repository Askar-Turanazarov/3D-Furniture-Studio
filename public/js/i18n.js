// RU / UZ / EN dictionaries. t('key', {param}) substitutes {param}.
const dict = {
  ru: {
    'room.title': 'Комната', 'room.length': 'Длина', 'room.width': 'Ширина', 'room.height': 'Высота',
    'units': 'Все размеры в сантиметрах (см)',
    'add.title': 'Добавить мебель', 'add.type': 'Тип', 'add.btn': '+ Добавить на план',
    'dim.w': 'Ширина (X)', 'dim.d': 'Глубина (Y)', 'dim.h': 'Высота (Z)',
    'sel.title': 'Выбранный предмет', 'sel.rotate': 'Повернуть', 'sel.auto': 'Найти место', 'sel.delete': 'Удалить',
    'list.title': 'Мебель на плане', 'list.empty': 'Пока пусто — добавьте предмет',
    'set.title': 'Настройки', 'set.snap': 'Привязка, см', 'set.gap': 'Зазор, см', 'set.plinth': 'Плинтус, см',
    'set.grid': 'Сетка, см', 'set.clear': 'Очистить план', 'set.clearConfirm': 'Удалить всю мебель с плана?',
    'legend.ok': 'Норма', 'legend.bad': 'Ошибка', 'legend.found': 'Найдено место',
    'legend.keys': 'R — поворот · Del — удалить · стрелки — сдвиг',
    'order.open': 'Оформить заявку', 'order.title': 'Заявка на мебель', 'order.name': 'Имя',
    'order.phone': 'Телефон', 'order.comment': 'Комментарий', 'order.cancel': 'Отмена', 'order.send': 'Отправить',
    'order.summary': 'Комната {L}×{W}×{H} см, предметов: {n}',
    'order.ok': 'Заявка №{id} отправлена. Мы свяжемся с вами!', 'order.fail': 'Не удалось отправить заявку',
    'order.empty': 'Добавьте хотя бы один предмет', 'order.hasErrors': 'Сначала исправьте ошибки размещения',
    'wall.west': 'левую', 'wall.east': 'правую', 'wall.north': 'верхнюю (северную)', 'wall.south': 'нижнюю (южную)',
    'wallAlong.west': 'вдоль левой стены', 'wallAlong.east': 'вдоль правой стены',
    'wallAlong.north': 'вдоль северной стены', 'wallAlong.south': 'вдоль южной стены',
    'err.wall': 'Выход за {wall} стену на {n} см',
    'err.overlap': 'Пересечение с «{name}»',
    'err.gap': 'Слишком близко к «{name}»: {n} см (нужно ≥ {gap} см)',
    'err.height': 'Выше потолка на {n} см',
    'banner.problems': 'Проблемы размещения:',
    'banner.ok': '«{name}» размещён корректно',
    'auto.found': '«{name}»: место найдено',
    'auto.tooBigL': 'Не помещается: не хватает {n} см по длине комнаты',
    'auto.tooBigW': 'Не помещается: не хватает {n} см по ширине комнаты',
    'auto.tooTall': 'Не помещается: высота больше потолка на {n} см',
    'auto.deficit': 'Не помещается: не хватает {n} см по ширине {wall}',
    'auto.noSpace': 'Не помещается: нет свободного места нужного размера',
    'catalog.fail': 'Не удалось загрузить каталог'
  },
  uz: {
    'room.title': 'Xona', 'room.length': 'Uzunligi', 'room.width': 'Kengligi', 'room.height': 'Balandligi',
    'units': 'Barcha o‘lchamlar santimetrda (sm)',
    'add.title': 'Mebel qo‘shish', 'add.type': 'Turi', 'add.btn': '+ Rejaga qo‘shish',
    'dim.w': 'Kengligi (X)', 'dim.d': 'Chuqurligi (Y)', 'dim.h': 'Balandligi (Z)',
    'sel.title': 'Tanlangan buyum', 'sel.rotate': 'Burish', 'sel.auto': 'Joy topish', 'sel.delete': 'O‘chirish',
    'list.title': 'Rejadagi mebel', 'list.empty': 'Hozircha bo‘sh — buyum qo‘shing',
    'set.title': 'Sozlamalar', 'set.snap': 'Bog‘lanish, sm', 'set.gap': 'Oraliq, sm', 'set.plinth': 'Plintus, sm',
    'set.grid': 'Setka, sm', 'set.clear': 'Rejani tozalash', 'set.clearConfirm': 'Barcha mebel o‘chirilsinmi?',
    'legend.ok': 'Normal', 'legend.bad': 'Xato', 'legend.found': 'Joy topildi',
    'legend.keys': 'R — burish · Del — o‘chirish · strelkalar — siljitish',
    'order.open': 'Buyurtma berish', 'order.title': 'Mebelga buyurtma', 'order.name': 'Ism',
    'order.phone': 'Telefon', 'order.comment': 'Izoh', 'order.cancel': 'Bekor qilish', 'order.send': 'Yuborish',
    'order.summary': 'Xona {L}×{W}×{H} sm, buyumlar: {n}',
    'order.ok': '№{id} buyurtma yuborildi. Siz bilan bog‘lanamiz!', 'order.fail': 'Buyurtmani yuborib bo‘lmadi',
    'order.empty': 'Kamida bitta buyum qo‘shing', 'order.hasErrors': 'Avval joylashtirish xatolarini tuzating',
    'wall.west': 'chap', 'wall.east': 'o‘ng', 'wall.north': 'yuqori (shimoliy)', 'wall.south': 'pastki (janubiy)',
    'wallAlong.west': 'chap devor bo‘ylab', 'wallAlong.east': 'o‘ng devor bo‘ylab',
    'wallAlong.north': 'shimoliy devor bo‘ylab', 'wallAlong.south': 'janubiy devor bo‘ylab',
    'err.wall': '{wall} devordan {n} sm chiqib ketgan',
    'err.overlap': '«{name}» bilan kesishadi',
    'err.gap': '«{name}»ga juda yaqin: {n} sm (≥ {gap} sm kerak)',
    'err.height': 'Shiftdan {n} sm baland',
    'banner.problems': 'Joylashtirish muammolari:',
    'banner.ok': '«{name}» to‘g‘ri joylashtirilgan',
    'auto.found': '«{name}»: joy topildi',
    'auto.tooBigL': 'Sig‘maydi: xona uzunligi bo‘yicha {n} sm yetmaydi',
    'auto.tooBigW': 'Sig‘maydi: xona kengligi bo‘yicha {n} sm yetmaydi',
    'auto.tooTall': 'Sig‘maydi: balandligi shiftdan {n} sm ortiq',
    'auto.deficit': 'Sig‘maydi: {wall} kenglik bo‘yicha {n} sm yetmaydi',
    'auto.noSpace': 'Sig‘maydi: kerakli o‘lchamdagi bo‘sh joy yo‘q',
    'catalog.fail': 'Katalogni yuklab bo‘lmadi'
  },
  en: {
    'room.title': 'Room', 'room.length': 'Length', 'room.width': 'Width', 'room.height': 'Height',
    'units': 'All dimensions in centimetres (cm)',
    'add.title': 'Add furniture', 'add.type': 'Type', 'add.btn': '+ Add to plan',
    'dim.w': 'Width (X)', 'dim.d': 'Depth (Y)', 'dim.h': 'Height (Z)',
    'sel.title': 'Selected item', 'sel.rotate': 'Rotate', 'sel.auto': 'Find a spot', 'sel.delete': 'Delete',
    'list.title': 'Furniture on plan', 'list.empty': 'Empty so far — add an item',
    'set.title': 'Settings', 'set.snap': 'Snap, cm', 'set.gap': 'Gap, cm', 'set.plinth': 'Plinth, cm',
    'set.grid': 'Grid, cm', 'set.clear': 'Clear plan', 'set.clearConfirm': 'Remove all furniture from the plan?',
    'legend.ok': 'OK', 'legend.bad': 'Error', 'legend.found': 'Spot found',
    'legend.keys': 'R — rotate · Del — delete · arrows — nudge',
    'order.open': 'Place an order', 'order.title': 'Furniture order', 'order.name': 'Name',
    'order.phone': 'Phone', 'order.comment': 'Comment', 'order.cancel': 'Cancel', 'order.send': 'Send',
    'order.summary': 'Room {L}×{W}×{H} cm, items: {n}',
    'order.ok': 'Order #{id} sent. We will contact you!', 'order.fail': 'Failed to send the order',
    'order.empty': 'Add at least one item', 'order.hasErrors': 'Fix placement errors first',
    'wall.west': 'left', 'wall.east': 'right', 'wall.north': 'top (north)', 'wall.south': 'bottom (south)',
    'wallAlong.west': 'along the left wall', 'wallAlong.east': 'along the right wall',
    'wallAlong.north': 'along the north wall', 'wallAlong.south': 'along the south wall',
    'err.wall': 'Crosses the {wall} wall by {n} cm',
    'err.overlap': 'Overlaps “{name}”',
    'err.gap': 'Too close to “{name}”: {n} cm (need ≥ {gap} cm)',
    'err.height': 'Taller than the ceiling by {n} cm',
    'banner.problems': 'Placement problems:',
    'banner.ok': '“{name}” is placed correctly',
    'auto.found': '“{name}”: spot found',
    'auto.tooBigL': 'Does not fit: {n} cm short along the room length',
    'auto.tooBigW': 'Does not fit: {n} cm short along the room width',
    'auto.tooTall': 'Does not fit: {n} cm taller than the ceiling',
    'auto.deficit': 'Does not fit: {n} cm short in width {wall}',
    'auto.noSpace': 'Does not fit: no free space of the required size',
    'catalog.fail': 'Failed to load the catalog'
  }
};

const LANGS = ['ru', 'uz', 'en'];
let lang = 'ru';
try {
  const saved = localStorage.getItem('fsp3d.lang');
  if (LANGS.includes(saved)) lang = saved;
} catch { /* storage unavailable */ }

const listeners = new Set();

export function getLang() { return lang; }

export function t(key, params = {}) {
  const str = dict[lang][key] ?? dict.ru[key] ?? key;
  return str.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? `{${k}}`));
}

export function setLang(next) {
  if (!LANGS.includes(next)) return;
  lang = next;
  try { localStorage.setItem('fsp3d.lang', lang); } catch { /* ignore */ }
  applyStatic();
  listeners.forEach(fn => fn(lang));
}

export function onLangChange(fn) { listeners.add(fn); }

// Fill all elements marked with data-i18n.
export function applyStatic() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('.lang button').forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
}

export function initLangSwitcher() {
  document.querySelectorAll('.lang button').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
  applyStatic();
}
