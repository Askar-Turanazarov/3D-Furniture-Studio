// RU / UZ / EN dictionaries. t('key', {param}) substitutes {param}.
const dict = {
  ru: {
    'ruler.title': 'Линейка (M): клик — начало, клик — конец, Shift — строго по горизонтали/вертикали, Esc — выход', 'ruler.clear': 'Очистить измерения', 'ruler.on': 'Линейка: кликните две точки. Точки притягиваются к стенам и краям мебели',
    'zoom.in': 'Приблизить (колесо мыши)', 'zoom.out': 'Отдалить', 'zoom.fit': 'Вписать план (сбросить масштаб). Перемещение: протяжка по пустому месту, пробел+протяжка или средняя кнопка',
    'sel.many': 'Выбрано предметов: {n}', 'align.title': 'Выровнять', 'align.left': 'По левому краю', 'align.cx': 'По центру (гориз.)', 'align.right': 'По правому краю', 'align.top': 'По верхнему краю', 'align.cy': 'По центру (верт.)', 'align.bottom': 'По нижнему краю', 'align.distX': 'Распределить по горизонтали', 'align.distY': 'Распределить по вертикали', 'sel.multiHint': 'Shift/Ctrl+клик — добавить или убрать, Shift+протяжка — рамка, Ctrl+A — все',
    'sel.duplicate': 'Дублировать', 'dup.done': 'Копия «{name}» добавлена', 'dup.shifted': 'Рядом нет места — копия сдвинута, найдите ей место',
    'hist.undo': 'Отменить (Ctrl+Z)', 'hist.redo': 'Повторить (Ctrl+Y)', 'hist.undone': 'Отменено', 'hist.redone': 'Повторено',
    'v3d.height': 'Рост', 'v3d.child': 'ребёнок', 'v3d.woman': 'женщина', 'v3d.man': 'мужчина',
    'v3d.distItem': 'До «{name}»: {m} м', 'v3d.distWall': 'До стены ({wall}): {m} м', 'wallShort.north': 'северная', 'wallShort.south': 'южная', 'wallShort.west': 'левая', 'wallShort.east': 'правая', 'v3d.distTouch': 'вплотную', 'v3d.fromFeet': 'от ног, по полу',
    'op.title': 'Окна и двери', 'op.addWindow': '+ Окно', 'op.addDoor': '+ Дверь', 'op.lock': '🔓 Заблокировать', 'op.unlock': '🔒 Заблокировано',
    'op.lockShort': '🔓 Проёмы', 'op.unlockShort': '🔒 Проёмы', 'op.locked': '🔒 Окна и двери заблокированы — их нельзя сдвинуть случайно',
    'op.window': 'Окно', 'op.door': 'Дверь', 'op.wall': 'Стена', 'op.offset': 'Отступ, см', 'op.width': 'Ширина, см', 'op.height': 'Высота, см',
    'op.sill': 'Подоконник, см', 'op.flip': '⇄ Петли', 'op.delete': '✕ Удалить',
    'op.hint': 'Окна и двери перетаскиваются вдоль стены (можно перенести на другую). Замок защищает их от случайного сдвига при расстановке мебели.',
    'wallName.north': 'Северная (верх)', 'wallName.south': 'Южная (низ)', 'wallName.west': 'Левая', 'wallName.east': 'Правая',
    'err.door': 'Мешает открыванию двери', 'warn.window': 'Закрывает окно (выше подоконника {n} см)', 'legend.warn': 'Предупреждение',
    'notes.empty': 'Выберите предмет на плане — здесь появятся проверки и подсказки', 'notes.all': 'Все проблемы на плане', 'notes.allOk': 'Ошибок размещения нет',
    'tex.title': 'Фото-текстуры (3D)', 'tex.apply': 'Применить готовые', 'tex.pack': 'Скачать набор (ZIP)',
    'tex.floor': 'Пол', 'tex.wall': 'Стены', 'tex.wood': 'Дерево мебели', 'tex.fabric': 'Обивка',
    'tex.builtin': 'готовая CC0', 'tex.custom': 'своя', 'tex.download': 'Скачать готовую текстуру',
    'tex.upload': 'Загрузить своё фото', 'tex.reset': 'Вернуть готовую',
    'tex.hint': 'Готовые CC0-текстуры (ambientCG) можно сразу применить в 3D или скачать. Своё фото (JPG/PNG) заменит выбранную поверхность.',
    'tex.applied': 'Фото-текстуры применены', 'tex.uploaded': 'Текстура «{name}» загружена',
    'tex.resetDone': 'Возвращена готовая текстура', 'tex.fail': 'Не удалось загрузить изображение',
    'v3d.dragHint': 'WASD / стрелки — ходьба · зажмите мышь и ведите — взгляд · Esc — выход',
    'view.plan': 'план', 'view.scene': 'сцена', 'view.fullscreen': 'Весь экран',
    'v3d.orbit': 'Обзор', 'v3d.walk': 'Прогулка', 'v3d.simple': 'Простые', 'v3d.photo': 'Фото-текстуры',
    'v3d.clickToWalk': 'Нажмите, чтобы войти в комнату',
    'v3d.walkKeys': 'WASD / стрелки — ходьба · мышь — взгляд · Shift — быстрее · Esc — выход',
    'v3d.orbitHint': 'Мышь: вращение · колесо: масштаб · правая кнопка: сдвиг',
    'v3d.walkHint': 'WASD — ходьба · мышь — взгляд · Esc — отпустить курсор',
    'v3d.touchHint': 'Джойстик — ходьба · проведите по экрану — взгляд',
    'v3d.noWebgl': 'WebGL недоступен в этом браузере',
    'v3d.photoFail': 'Фото-текстуры не найдены — используются простые',
    'unit.cm': 'см',
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
    'ruler.title': 'Chizg‘ich (M): bosish — boshlanish, bosish — oxiri, Shift — faqat gorizontal/vertikal, Esc — chiqish', 'ruler.clear': 'O‘lchovlarni tozalash', 'ruler.on': 'Chizg‘ich: ikki nuqtani bosing. Nuqtalar devorlar va mebel chetlariga yopishadi',
    'zoom.in': 'Yaqinlashtirish (sichqoncha g‘ildiragi)', 'zoom.out': 'Uzoqlashtirish', 'zoom.fit': 'Rejani sig‘dirish (masshtabni tiklash). Siljitish: bo‘sh joyda tortish, probel+tortish yoki o‘rta tugma',
    'sel.many': 'Tanlangan buyumlar: {n}', 'align.title': 'Tekislash', 'align.left': 'Chap chekka bo‘yicha', 'align.cx': 'Markaz bo‘yicha (gorizontal)', 'align.right': 'O‘ng chekka bo‘yicha', 'align.top': 'Yuqori chekka bo‘yicha', 'align.cy': 'Markaz bo‘yicha (vertikal)', 'align.bottom': 'Pastki chekka bo‘yicha', 'align.distX': 'Gorizontal teng taqsimlash', 'align.distY': 'Vertikal teng taqsimlash', 'sel.multiHint': 'Shift/Ctrl+bosish — qo‘shish yoki olib tashlash, Shift+tortish — ramka, Ctrl+A — hammasi',
    'sel.duplicate': 'Nusxalash', 'dup.done': '«{name}» nusxasi qo‘shildi', 'dup.shifted': 'Yonida joy yo‘q — nusxa surildi, unga joy toping',
    'hist.undo': 'Bekor qilish (Ctrl+Z)', 'hist.redo': 'Qaytarish (Ctrl+Y)', 'hist.undone': 'Bekor qilindi', 'hist.redone': 'Qaytarildi',
    'v3d.height': 'Bo‘y', 'v3d.child': 'bola', 'v3d.woman': 'ayol', 'v3d.man': 'erkak',
    'v3d.distItem': '«{name}»gacha: {m} m', 'v3d.distWall': 'Devorgacha ({wall}): {m} m', 'wallShort.north': 'shimoliy', 'wallShort.south': 'janubiy', 'wallShort.west': 'chap', 'wallShort.east': 'o‘ng', 'v3d.distTouch': 'yonma-yon', 'v3d.fromFeet': 'oyoqdan, pol bo‘ylab',
    'op.title': 'Derazalar va eshiklar', 'op.addWindow': '+ Deraza', 'op.addDoor': '+ Eshik', 'op.lock': '🔓 Qulflash', 'op.unlock': '🔒 Qulflangan',
    'op.lockShort': '🔓 Teshiklar', 'op.unlockShort': '🔒 Teshiklar', 'op.locked': '🔒 Derazalar va eshiklar qulflangan — ularni tasodifan surib bo‘lmaydi',
    'op.window': 'Deraza', 'op.door': 'Eshik', 'op.wall': 'Devor', 'op.offset': 'Chekinish, sm', 'op.width': 'Kengligi, sm', 'op.height': 'Balandligi, sm',
    'op.sill': 'Deraza tokchasi, sm', 'op.flip': '⇄ Oshiq-moshiq', 'op.delete': '✕ O‘chirish',
    'op.hint': 'Deraza va eshiklarni devor bo‘ylab suring (boshqa devorga ham o‘tkazish mumkin). Qulf ularni mebel joylashtirishda tasodifiy siljishdan himoya qiladi.',
    'wallName.north': 'Shimoliy (yuqori)', 'wallName.south': 'Janubiy (past)', 'wallName.west': 'Chap', 'wallName.east': 'O‘ng',
    'err.door': 'Eshik ochilishiga xalaqit beradi', 'warn.window': 'Derazani to‘sadi (tokchadan {n} sm baland)', 'legend.warn': 'Ogohlantirish',
    'notes.empty': 'Rejada buyumni tanlang — tekshiruvlar va maslahatlar shu yerda chiqadi', 'notes.all': 'Rejadagi barcha muammolar', 'notes.allOk': 'Joylashtirish xatolari yo‘q',
    'tex.title': 'Foto-teksturalar (3D)', 'tex.apply': 'Tayyorlarini qo‘llash', 'tex.pack': 'To‘plamni yuklab olish (ZIP)',
    'tex.floor': 'Pol', 'tex.wall': 'Devorlar', 'tex.wood': 'Mebel yog‘ochi', 'tex.fabric': 'Qoplama',
    'tex.builtin': 'tayyor CC0', 'tex.custom': 'o‘zingizniki', 'tex.download': 'Tayyor teksturani yuklab olish',
    'tex.upload': 'O‘z rasmingizni yuklash', 'tex.reset': 'Tayyoriga qaytarish',
    'tex.hint': 'Tayyor CC0 teksturalarni (ambientCG) darhol 3D’da qo‘llash yoki yuklab olish mumkin. O‘z rasmingiz (JPG/PNG) tanlangan sirtni almashtiradi.',
    'tex.applied': 'Foto-teksturalar qo‘llandi', 'tex.uploaded': '«{name}» teksturasi yuklandi',
    'tex.resetDone': 'Tayyor tekstura qaytarildi', 'tex.fail': 'Rasmni yuklab bo‘lmadi',
    'v3d.dragHint': 'WASD / strelkalar — yurish · sichqonchani bosib suring — qarash · Esc — chiqish',
    'view.plan': 'reja', 'view.scene': 'sahna', 'view.fullscreen': 'To‘liq ekran',
    'v3d.orbit': 'Ko‘rinish', 'v3d.walk': 'Sayr', 'v3d.simple': 'Oddiy', 'v3d.photo': 'Foto-teksturalar',
    'v3d.clickToWalk': 'Xonaga kirish uchun bosing',
    'v3d.walkKeys': 'WASD / strelkalar — yurish · sichqoncha — qarash · Shift — tezroq · Esc — chiqish',
    'v3d.orbitHint': 'Sichqoncha: aylantirish · g‘ildirak: masshtab · o‘ng tugma: siljitish',
    'v3d.walkHint': 'WASD — yurish · sichqoncha — qarash · Esc — kursorni qo‘yib yuborish',
    'v3d.touchHint': 'Joystik — yurish · ekranni suring — qarash',
    'v3d.noWebgl': 'Bu brauzerda WebGL mavjud emas',
    'v3d.photoFail': 'Foto-teksturalar topilmadi — oddiylari ishlatiladi',
    'unit.cm': 'sm',
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
    'ruler.title': 'Ruler (M): click — start, click — end, Shift — straight horizontal/vertical, Esc — exit', 'ruler.clear': 'Clear measurements', 'ruler.on': 'Ruler: click two points. Points snap to walls and furniture edges',
    'zoom.in': 'Zoom in (mouse wheel)', 'zoom.out': 'Zoom out', 'zoom.fit': 'Fit plan (reset zoom). Pan: drag empty floor, Space+drag or middle button',
    'sel.many': 'Items selected: {n}', 'align.title': 'Align', 'align.left': 'Align left edges', 'align.cx': 'Align horizontal centres', 'align.right': 'Align right edges', 'align.top': 'Align top edges', 'align.cy': 'Align vertical centres', 'align.bottom': 'Align bottom edges', 'align.distX': 'Distribute horizontally', 'align.distY': 'Distribute vertically', 'sel.multiHint': 'Shift/Ctrl+click — add or remove, Shift+drag — box select, Ctrl+A — all',
    'sel.duplicate': 'Duplicate', 'dup.done': 'Copy of “{name}” added', 'dup.shifted': 'No room next to it — the copy was shifted, find it a spot',
    'hist.undo': 'Undo (Ctrl+Z)', 'hist.redo': 'Redo (Ctrl+Y)', 'hist.undone': 'Undone', 'hist.redone': 'Redone',
    'v3d.height': 'Height', 'v3d.child': 'child', 'v3d.woman': 'woman', 'v3d.man': 'man',
    'v3d.distItem': 'To “{name}”: {m} m', 'v3d.distWall': 'To the wall ({wall}): {m} m', 'wallShort.north': 'north', 'wallShort.south': 'south', 'wallShort.west': 'left', 'wallShort.east': 'right', 'v3d.distTouch': 'touching', 'v3d.fromFeet': 'from the feet, along the floor',
    'op.title': 'Windows & doors', 'op.addWindow': '+ Window', 'op.addDoor': '+ Door', 'op.lock': '🔓 Lock', 'op.unlock': '🔒 Locked',
    'op.lockShort': '🔓 Openings', 'op.unlockShort': '🔒 Openings', 'op.locked': '🔒 Windows and doors are locked — they cannot be moved by accident',
    'op.window': 'Window', 'op.door': 'Door', 'op.wall': 'Wall', 'op.offset': 'Offset, cm', 'op.width': 'Width, cm', 'op.height': 'Height, cm',
    'op.sill': 'Sill, cm', 'op.flip': '⇄ Hinges', 'op.delete': '✕ Delete',
    'op.hint': 'Drag windows and doors along the wall (or onto another wall). The lock keeps them from moving by accident while you arrange furniture.',
    'wallName.north': 'North (top)', 'wallName.south': 'South (bottom)', 'wallName.west': 'Left', 'wallName.east': 'Right',
    'err.door': 'Blocks the door swing', 'warn.window': 'Covers the window (taller than the {n} cm sill)', 'legend.warn': 'Warning',
    'notes.empty': 'Select an item on the plan — checks and hints will appear here', 'notes.all': 'All problems on the plan', 'notes.allOk': 'No placement errors',
    'tex.title': 'Photo textures (3D)', 'tex.apply': 'Apply built-in', 'tex.pack': 'Download set (ZIP)',
    'tex.floor': 'Floor', 'tex.wall': 'Walls', 'tex.wood': 'Furniture wood', 'tex.fabric': 'Upholstery',
    'tex.builtin': 'built-in CC0', 'tex.custom': 'custom', 'tex.download': 'Download built-in texture',
    'tex.upload': 'Upload your photo', 'tex.reset': 'Back to built-in',
    'tex.hint': 'Built-in CC0 textures (ambientCG) can be applied in 3D right away or downloaded. Your own photo (JPG/PNG) replaces the chosen surface.',
    'tex.applied': 'Photo textures applied', 'tex.uploaded': 'Texture “{name}” uploaded',
    'tex.resetDone': 'Built-in texture restored', 'tex.fail': 'Could not upload the image',
    'v3d.dragHint': 'WASD / arrows — move · drag with the mouse — look · Esc — exit',
    'view.plan': 'plan', 'view.scene': 'scene', 'view.fullscreen': 'Fullscreen',
    'v3d.orbit': 'Overview', 'v3d.walk': 'Walk', 'v3d.simple': 'Simple', 'v3d.photo': 'Photo textures',
    'v3d.clickToWalk': 'Click to enter the room',
    'v3d.walkKeys': 'WASD / arrows — move · mouse — look · Shift — faster · Esc — exit',
    'v3d.orbitHint': 'Mouse: rotate · wheel: zoom · right button: pan',
    'v3d.walkHint': 'WASD — move · mouse — look · Esc — release cursor',
    'v3d.touchHint': 'Joystick — move · swipe the screen — look',
    'v3d.noWebgl': 'WebGL is not available in this browser',
    'v3d.photoFail': 'Photo textures not found — using simple ones',
    'unit.cm': 'cm',
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
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  document.querySelectorAll('.lang button').forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
}

export function initLangSwitcher() {
  document.querySelectorAll('.lang button').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
  applyStatic();
}
