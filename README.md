# Furniture Super Planner 3D

**[English](#english) · [O‘zbekcha](#ozbekcha) · [Русский](#русский)**

---

## English

A web app for custom furniture: the client enters the room size and the furniture dimensions, checks what fits and where on a 2D plan, walks through the room in 3D and sends an order.

### Features
- **Room:** length, width, height (cm); the plan is rebuilt instantly.
- **Furniture (15 types):** wardrobe, bed, sofa, armchair, table, desk, coffee table, chair, nightstand, dresser, TV stand, bookshelf, shoe cabinet, kitchen set, fridge — width (X), depth (Y), height (Z).
- **2D plan (Canvas, top view):** auto scale, 10/50 cm grid, plinth inset (2 cm by default). The scale stays fixed: messages go to a separate column on the right.
- **Distances** from the selected item to the walls and to furniture in between: if a neighbour covers the whole side, only the distance to it is shown; if it covers part of the side, both (to the neighbour and to the wall).
- **Drag & drop** with snapping (5 cm) and magnet to walls/neighbours; rotation 0/90/180/270° (`R`) with a front-side marker.
- **Validation:** an item turns **red** if it crosses a wall (incl. plinth), overlaps another item (AABB), is closer than the minimum gap (3 cm), taller than the ceiling or blocks a door swing. Tall furniture in front of a window gets a yellow warning. The notes column shows the exact reasons for every item.
- **Windows & doors:** any number on any wall; drawn on the plan (glass, door leaf and swing arc), dragged along the wall or onto another one, edited in the sidebar (offset, width, height, sill, hinge side). The 🔒 lock keeps them from moving by accident while arranging furniture. Openings are synced to 3D and saved in the order.
- **"Find a spot":** searches free positions (walls first, back to the wall, 4 rotations). Found → green highlight; not found → a precise message, e.g. *"Does not fit: 15 cm short in width along the south wall"*.
- **3D scene (Three.js):** room with window, door and plinths, procedural furniture models, lamp and daylight with shadows.
  - **Overview** — orbit camera, near walls are cut away.
  - **Walk** — first person, collisions with walls and furniture; person height 120–200 cm; the bottom HUD shows the floor distance from the feet to the item or wall you are looking at.
  - **Simple / Photo** textures (procedural or CC0 photo textures).
- **Photo textures panel:** apply the built-in CC0 set in one click, download it (per surface or the whole set as ZIP), or upload your own photo for the floor, walls, furniture wood or upholstery (reset back to built-in anytime).
  - Fullscreen mode, touch joystick on mobile.
- **Plan editing:** undo / redo (↶ ↷, `Ctrl+Z` / `Ctrl+Y`; a whole drag is one step), duplicate (`Ctrl+D`), multi-select (`Shift`/`Ctrl`+click, `Shift`+drag box, `Ctrl+A`) with group move and an **Align / distribute** panel.
- **Zoom & pan:** wheel zooms around the cursor (50–800 %), − / 100 % / + buttons (100 % = fit); pan by dragging the empty floor, `Space`+drag or the middle button; pinch on touch screens. The view is not saved.
- **Ruler** (📏 / `M`): click two points; points snap to walls, plinth and furniture edges, `Shift` keeps the line straight. Shows the length and Δx / Δy; ⌫ clears all measurements.
- **Structure:** in the "Windows, doors & structure" panel add a column, duct (riser), ceiling duct, wall ledge, radiator (centred under a window) or a **niche** (two ledges on both sides of a wall part). They are hatched grey on the plan with the height label, dragged with snapping to walls, edited in the form and protected by the same 🔒 lock. Furniture must not overlap structure at its height (`err.obstacle`, plus the min gap); structure in a door swing or in front of a window gets a warning. In 3D structure is drawn in wall material, the radiator is sectional; it blocks the walk unless it is above the head.
- **Wall-mounted furniture:** every item has "Above floor" (`elev`, cm). Collisions work on three axes: a shelf above a desk is fine, a wardrobe under a ceiling duct is checked against its bottom, a shelf in a door swing is an error only below the door top. On the plan wall items are drawn over the floor ones (translucent, dashed, "↑140"); a click picks the upper item, a second click on the same spot picks the one below. New catalogue types: wall cabinet, wall shelf, mezzanine, floating TV console, wall mirror.
- **Opening zones:** wardrobes, dressers, kitchens, fridges and wall cabinets know how they open (hinged doors, sliding, drawers, pull-out; can be changed per item, with the number of doors). If a door or drawer hits a wall, furniture or structure at its height — an error with the shortfall: "Door/drawer will not open: “Bed” is in the way (20 cm short)". Two zones over the same floor or a zone in the room door swing give a warning. **⌓ Zones** (key `Z`) cycles: selected only → all → hidden; checks run in every mode, a selected item with a zone error always shows its zone. Auto-placement first looks for a spot with a free zone.
- **Passages:** gaps between furniture, structure and walls narrower than the norm (setting "Passage from", 60 cm by default; gaps under 20 cm are slits, not passages) are warned: "Narrow passage 48 cm (should be 60+)". **↔ Passages** (key `P`) shows / hides the yellow bands on the plan, the badge shows how many there are; the notes column has a collapsible "Passages (N)" group, a click flashes the passage on the plan.
- **Projects and rooms:** a project holds several rooms shown as tabs above the plan (+ Room: name, purpose, size; ⋯ — rename, duplicate as a version "variant B", delete). Each room keeps its own undo history. 📁 **Projects** — cards with a plan preview: open, new, rename, duplicate, delete, **export / import** a `.fsp3d.json` file (backup or moving to another device). The old single-room plan is migrated automatically into "My project".
- **Room templates:** + Room → **From a template**: a *Soviet-era building* set (panel / brick 1960–90s, ceiling ≈ 2.8 m) or a *New build* set (monolithic frame 2015+, ceiling ≈ 3.0 m) — bedroom, kids room, kitchen-living room, master bedroom, living room (the Soviet one is walk-through with two doors), large bedroom, study, kitchen. Each card shows a mini plan and "12 m² · 4×3 m". A template brings windows with radiators under them, doors, structure (risers, a ledge, a column) and furniture placed without errors; afterwards everything can be changed. 📁 Projects → **New project from an apartment template**: "2-room (Soviet)" = living room + bedroom + kitchen, "3-room (new build)" = kitchen-living room + master bedroom + kids room, one tab per room. Sizes are typical for Tashkent housing; templates live in `templates.json` (`GET /api/templates`).
- **Order** — form (name, phone, comment) is saved to `order.json` with the project and room names; the "send all rooms" checkbox sends every room of the project (each one must be free of errors).
- **Languages:** EN / UZ / RU. Projects are kept in `localStorage`.

### Tech stack
Node.js + Express (static files + small JSON API), plain HTML/CSS/JS (ES modules, no build step), Canvas 2D, Three.js (npm + importmap).

### Getting started
```bash
npm install
npm start
```
Open http://localhost:3000 (Node.js 18+). Tests: `npm test`.

### Controls
| Where | Action | How |
|---|---|---|
| 2D | Move | drag with mouse / finger |
| 2D | Rotate / delete / nudge | `R` / `Del` / arrows (`Shift` ×10) |
| 2D | Window / door | drag along the wall; `Del` / arrows when selected; 🔒 — lock |
| 2D | Undo / redo | `Ctrl+Z` / `Ctrl+Y` (`Ctrl+Shift+Z`) |
| 2D | Duplicate / select all | `Ctrl+D` / `Ctrl+A` |
| 2D | Multi-select | `Shift`/`Ctrl`+click, `Shift`+drag on the empty floor |
| 2D | Zoom / pan | wheel, pinch / drag the empty floor, `Space`+drag, middle button |
| 2D | Ruler | `M` or 📏; `Shift` — straight line; `Esc` — exit |
| 3D Overview | Rotate / zoom / pan | left mouse / wheel / right mouse |
| 3D Walk | Move | `W A S D` / arrows, `Shift` — faster |
| 3D Walk | Look | mouse (after click), or drag with the mouse if pointer lock is unavailable |
| 3D Walk | Exit | `Esc` |
| Mobile | Move / look | joystick / swipe |

### Project structure
```
server.js            Express: static, catalog, templates, orders, textures (list / upload / reset / ZIP)
catalog.json         furniture catalogue (types, default sizes, names in 3 languages)
templates.json       room templates (Soviet-era / new build) and apartment sets
order.json           saved orders
public/index.html    layout
public/css/          styles
public/js/           2D: state, geometry, openings, validate, renderer, interaction, autoplace, ui, i18n, storage, order,
                     history (undo), align, ruler, projects (rooms, tabs), projectsDialog, obstacles, catalog, zones, passages, templates
public/js/3d/        3D: scene3d, room3d, models3d, textures3d, lights3d, controls3d, touch3d, obstacles3d
public/textures/     CC0 photo textures (ambientCG); custom/ — uploaded photos (not in git)
test/                unit tests (node:test): npm test
```

### Rules
- All sizes are in centimetres; snap step 3–5 cm.
- Furniture is a rectangle on the plan; collisions use the footprint (AABB).
- Furniture must stay inside the room minus the plinth and must not overlap other items.

### Licences
Photo textures: [ambientCG](https://ambientcg.com) — CC0. Three.js — MIT.

---

## O‘zbekcha

Buyurtma asosida mebel uchun veb-ilova: mijoz xona va mebel o‘lchamlarini kiritadi, 2D rejada nima va qayerga sig‘ishini tekshiradi, xona bo‘ylab 3D’da sayr qiladi va buyurtma yuboradi.

### Imkoniyatlar
- **Xona:** uzunlik, kenglik, balandlik (sm); reja darhol qayta chiziladi.
- **Mebel (15 tur):** shkaf, karavot, divan, kreslo, stol, yozuv stoli, jurnal stolchasi, stul, tumba, komod, TV tumba, kitob javoni, poyabzal javoni, oshxona garnituri, muzlatgich — kenglik (X), chuqurlik (Y), balandlik (Z).
- **2D reja (Canvas, yuqoridan ko‘rinish):** avtomatik masshtab, 10/50 sm setka, plintus chekinishi (standart 2 sm). Masshtab o‘zgarmaydi: xabarlar o‘ng tomondagi alohida ustunda.
- **Masofalar** tanlangan buyumdan devorlargacha va oradagi mebelgacha: qo‘shni buyum tomonni to‘liq yopsa — faqat ungacha, qisman yopsa — ikkalasi (qo‘shnigacha va devorgacha).
- **Sudrab olib borish** setkaga (5 sm) bog‘lanish va devor/qo‘shni buyumlarga yopishish bilan; 0/90/180/270° burish (`R`), old tomon belgisi bilan.
- **Tekshiruv:** buyum **qizil** rangga bo‘yaladi, agar u devordan (plintus bilan) chiqib ketsa, boshqa buyum bilan kesishsa (AABB), minimal oraliqdan (3 sm) yaqin bo‘lsa, shiftdan baland bo‘lsa yoki eshik ochilishiga xalaqit bersa. Deraza oldidagi baland mebel — sariq ogohlantirish. Xabarlar ustuni har bir buyum uchun aniq sabablarni ko‘rsatadi.
- **Derazalar va eshiklar:** istalgan devorda istalgancha; rejada chiziladi (oyna, eshik tabaqasi va ochilish yoyi), devor bo‘ylab yoki boshqa devorga suriladi, yon panelda tahrirlanadi (chekinish, kenglik, balandlik, tokcha, oshiq-moshiq tomoni). 🔒 qulf ularni tasodifiy siljishdan himoya qiladi. 3D bilan sinxron va buyurtmada saqlanadi.
- **«Joy topish»:** bo‘sh joyni qidiradi (avval devorlar bo‘ylab, orqasi devorga, 4 burilish). Topilsa — yashil rang; topilmasa — aniq xabar, masalan: *«Sig‘maydi: janubiy devor bo‘ylab kenglik bo‘yicha 15 sm yetmaydi»*.
- **3D sahna (Three.js):** deraza, eshik va plintusli xona, protsedural mebel modellari, chiroq va kunduzgi yorug‘lik, soyalar bilan.
  - **Ko‘rinish** — kamera xona atrofida aylanadi, yaqin devorlar yashiriladi.
  - **Sayr** — birinchi shaxsdan, devor va mebel bilan to‘qnashuvlar; bo‘y 120–200 sm; pastdagi panel oyoqdan qaralayotgan buyum yoki devorgacha pol bo‘ylab masofani ko‘rsatadi.
  - **Oddiy / Foto** teksturalar (protsedural yoki CC0 foto-teksturalar).
- **Foto-teksturalar paneli:** tayyor CC0 to‘plamni bir bosishda qo‘llash, uni yuklab olish (har bir sirt alohida yoki butun to‘plam ZIP’da) yoki pol, devorlar, mebel yog‘ochi va qoplama uchun o‘z rasmingizni yuklash (istalgan vaqtda tayyoriga qaytarish mumkin).
  - To‘liq ekran rejimi, mobil qurilmalarda joystik.
- **Rejani tahrirlash:** bekor qilish / qaytarish (↶ ↷, `Ctrl+Z` / `Ctrl+Y`; butun sudrash — bitta qadam), nusxa olish (`Ctrl+D`), bir nechta tanlash (`Shift`/`Ctrl`+bosish, `Shift`+tortish — ramka, `Ctrl+A`), guruhni siljitish va **Tekislash / taqsimlash** paneli.
- **Masshtab va siljitish:** g‘ildirak kursor atrofida yaqinlashtiradi (50–800 %), − / 100 % / + tugmalari (100 % = sig‘dirish); bo‘sh polni tortish, `Probel`+tortish yoki o‘rta tugma bilan siljitish; sensorli ekranda ikki barmoq. Ko‘rinish saqlanmaydi.
- **Chizg‘ich** (📏 / `M`): ikki nuqtani bosing; nuqtalar devor, plintus va mebel chetlariga yopishadi, `Shift` chiziqni to‘g‘ri ushlaydi. Uzunlik va Δx / Δy ko‘rsatiladi; ⌫ — barcha o‘lchovlarni tozalash.
- **Konstruktiv:** «Derazalar, eshiklar va konstruktiv» panelida ustun, quti (stoyak), shift ostidagi quti, devor bo‘rtig‘i, radiator (deraza ostida markazda) yoki **tokcha** (devor qismining ikki yonidagi bo‘rtiqlar) qo‘shiladi. Rejada ular kulrang shtrixlangan va balandligi yozilgan, devorlarga yopishib suriladi, formada tahrirlanadi va o‘sha 🔒 qulf bilan himoyalanadi. Mebel o‘z balandligidagi konstruktiv bilan kesishmasligi kerak (`err.obstacle` va minimal oraliq); eshik ochilish zonasidagi yoki deraza oldidagi konstruktiv uchun ogohlantirish chiqadi. 3D da konstruktiv devor materialida, radiator seksiyali; boshdan baland bo‘lmasa, yurishga to‘sqinlik qiladi.
- **Osma mebel:** har bir buyumda «Poldan» (`elev`, sm) bor. To‘qnashuvlar uch o‘q bo‘yicha: stol ustidagi tokcha — xato emas, shift ostidagi quti ostidagi shkaf uning pastki qismi bo‘yicha tekshiriladi, eshik zonasidagi tokcha faqat eshik balandligidan past bo‘lsa xato. Rejada osma buyumlar pol buyumlari ustida chiziladi (shaffof, punktir, «↑140»); bosish yuqoridagini tanlaydi, xuddi shu joyga yana bosish — pastdagini. Katalogdagi yangi turlar: osma shkaf, devor tokchasi, antresol, osma TV konsol, devor oynasi.
- **Ochilish zonalari:** shkaf, komod, oshxona, muzlatgich va osma shkaflar qanday ochilishini biladi (ochiladigan eshiklar, kupe, tortmalar, yoyiladigan; buyumda eshiklar soni bilan o‘zgartirish mumkin). Eshik yoki tortma o‘z balandligidagi devor, mebel yoki konstruktivga tegsa — yetishmaydigan sm bilan xato: «Eshikcha/tortma ochilmaydi: «Karavot» xalaqit beradi (20 sm yetmaydi)». Bir joydagi ikki zona yoki xona eshigi zonasidagi zona — ogohlantirish. **⌓ Zonalar** (`Z` tugmasi) almashadi: faqat tanlangan → hammasi → yashirin; tekshiruv har doim ishlaydi, zona xatosi bor tanlangan buyum zonasi doim ko‘rinadi. Avtojoylashtirish avval zonasi bo‘sh joyni qidiradi.
- **O‘tish joylari:** mebel, konstruktiv va devorlar orasidagi me’yordan tor oraliqlar («O‘tish joyi» sozlamasi, standart 60 sm; 20 sm dan kichigi — tirqish) ogohlantiriladi: «Tor o‘tish joyi 48 sm (me’yor 60 dan)». **↔ O‘tishlar** (`P` tugmasi) rejadagi sariq chiziqlarni ko‘rsatadi / yashiradi, nishonda soni; xabarlar ustunida yig‘iladigan «O‘tish joylari (N)» guruhi, bosilganda o‘tish joyi rejada yonadi.
- **Loyihalar va xonalar:** loyihada bir nechta xona bor, ular reja ustida yorliqlar ko‘rinishida (+ Xona: nomi, vazifasi, o‘lchami; ⋯ — nomini o‘zgartirish, «variant B» versiyasi sifatida nusxalash, o‘chirish). Har bir xonaning o‘z bekor qilish tarixi bor. 📁 **Loyihalar** — reja rasmi bilan kartalar: ochish, yangi, nomini o‘zgartirish, nusxalash, o‘chirish, `.fsp3d.json` faylga **eksport / import** (zaxira yoki boshqa qurilmaga ko‘chirish). Eski bitta xonali reja avtomatik ravishda «Mening loyiham»ga ko‘chiriladi.
- **Xona shablonlari:** + Xona → **Shablondan**: *Sovet davri uyi* to‘plami (panel / g‘isht 1960–90-yillar, shift ≈ 2,8 m) yoki *Yangi bino* (monolit/karkas 2015+, shift ≈ 3,0 m) — yotoqxona, bolalar xonasi, oshxona-mehmonxona, asosiy yotoqxona, zal (sovet uyida ikki eshikli o‘tish xona), katta yotoqxona, ish xonasi, oshxona. Har bir kartada kichik reja va «12 m² · 4×3 m». Shablonda derazalar (tagida radiator), eshiklar, konstruktiv (stoyak, devor chiqig‘i, kolonna) va xatosiz joylashtirilgan mebel bor; keyin hammasini o‘zgartirish mumkin. 📁 Loyihalar → **Kvartira shablonidan yangi loyiha**: «2 xonali (sovet)» = zal + yotoqxona + oshxona, «3 xonali (yangi bino)» = oshxona-mehmonxona + asosiy yotoqxona + bolalar xonasi, har bir xona alohida yorliqda. O‘lchamlar Toshkent uylari uchun odatiy; shablonlar `templates.json` da (`GET /api/templates`).
- **Buyurtma** — forma (ism, telefon, izoh) loyiha va xona nomi bilan `order.json` fayliga saqlanadi; «barcha xonalarni yuborish» belgisi loyihaning hamma xonalarini yuboradi (har birida xato bo‘lmasligi kerak).
- **Tillar:** EN / UZ / RU. Loyihalar `localStorage`da saqlanadi.

### Texnologiyalar
Node.js + Express (statik fayllar + kichik JSON API), oddiy HTML/CSS/JS (ES modullar, yig‘ishsiz), Canvas 2D, Three.js (npm + importmap).

### Ishga tushirish
```bash
npm install
npm start
```
http://localhost:3000 manzilini oching (Node.js 18+). Testlar: `npm test`.

### Boshqaruv
| Qayerda | Amal | Qanday |
|---|---|---|
| 2D | Siljitish | sichqoncha / barmoq bilan sudrash |
| 2D | Burish / o‘chirish / siljitish | `R` / `Del` / strelkalar (`Shift` ×10) |
| 2D | Deraza / eshik | devor bo‘ylab sudrash; tanlanganda `Del` / strelkalar; 🔒 — qulf |
| 2D | Bekor qilish / qaytarish | `Ctrl+Z` / `Ctrl+Y` (`Ctrl+Shift+Z`) |
| 2D | Nusxa / hammasini tanlash | `Ctrl+D` / `Ctrl+A` |
| 2D | Bir nechta tanlash | `Shift`/`Ctrl`+bosish, bo‘sh polda `Shift`+tortish |
| 2D | Masshtab / siljitish | g‘ildirak, ikki barmoq / bo‘sh polni tortish, `Probel`+tortish, o‘rta tugma |
| 2D | Chizg‘ich | `M` yoki 📏; `Shift` — to‘g‘ri chiziq; `Esc` — chiqish |
| 3D Ko‘rinish | Aylantirish / masshtab / surish | chap tugma / g‘ildirak / o‘ng tugma |
| 3D Sayr | Yurish | `W A S D` / strelkalar, `Shift` — tezroq |
| 3D Sayr | Qarash | sichqoncha (bosgandan keyin) yoki kursor qulflanmasa — sichqonchani bosib surish |
| 3D Sayr | Chiqish | `Esc` |
| Mobil | Yurish / qarash | joystik / ekranni surish |

### Loyiha tuzilmasi
```
server.js            Express: statik, katalog, shablonlar, buyurtmalar, teksturalar (ro‘yxat / yuklash / tiklash / ZIP)
catalog.json         mebel katalogi (turlar, standart o‘lchamlar, 3 tildagi nomlar)
templates.json       xona shablonlari (sovet uyi / yangi bino) va kvartira to‘plamlari
order.json           saqlangan buyurtmalar
public/index.html    sahifa tuzilmasi
public/css/          uslublar
public/js/           2D: state, geometry, openings, validate, renderer, interaction, autoplace, ui, i18n, storage, order,
                     history (bekor qilish), align, ruler, projects (xonalar, yorliqlar), projectsDialog, obstacles, catalog, zones, passages, templates
public/js/3d/        3D: scene3d, room3d, models3d, textures3d, lights3d, controls3d, touch3d, obstacles3d
public/textures/     CC0 foto-teksturalar (ambientCG); custom/ — yuklangan rasmlar (git’da emas)
test/                unit testlar (node:test): npm test
```

### Qoidalar
- Barcha o‘lchamlar santimetrda; bog‘lanish qadami 3–5 sm.
- Mebel rejada to‘rtburchak; to‘qnashuvlar gabarit (AABB) bo‘yicha.
- Mebel plintusni hisobga olgan holda xonadan chiqmasligi va boshqa buyumlar bilan kesishmasligi kerak.

### Litsenziyalar
Foto-teksturalar: [ambientCG](https://ambientcg.com) — CC0. Three.js — MIT.

---

## Русский

Веб-приложение для мебели на заказ: клиент задаёт размеры комнаты и мебели, проверяет на 2D-плане, что поместится и где, гуляет по комнате в 3D и отправляет заявку.

### Возможности
- **Комната:** длина, ширина, высота (см); план перестраивается мгновенно.
- **Мебель (15 видов):** шкаф, кровать, диван, кресло, стол, письменный стол, журнальный столик, стул, тумба, комод, ТВ-тумба, стеллаж, обувница, кухонный гарнитур, холодильник — ширина (X), глубина (Y), высота (Z).
- **2D-план (Canvas, вид сверху):** автомасштаб, сетка 10/50 см, отступ плинтуса (по умолчанию 2 см). Масштаб не меняется: сообщения выводятся в отдельной колонке справа.
- **Расстояния** от выбранного предмета до стен и до мебели между ним и стеной: если сосед закрывает сторону целиком — только до него, если частично — оба (до соседа и до стены).
- **Drag & drop** с привязкой к сетке (5 см) и «магнитом» к стенам и соседям; поворот 0/90/180/270° (`R`) с маркером лицевой стороны.
- **Валидация:** предмет подсвечивается **красным**, если выходит за стену (с учётом плинтуса), пересекается с другим предметом (AABB), стоит ближе минимального зазора (3 см), выше потолка или мешает открыванию двери. Высокая мебель перед окном — жёлтое предупреждение. Колонка уведомлений показывает точные причины по каждому предмету.
- **Окна и двери:** любое количество на любой стене; видны на плане (стекло, полотно и дуга открывания), перетаскиваются вдоль стены или на другую, редактируются в боковой панели (отступ, ширина, высота, подоконник, сторона петель). Замок 🔒 защищает их от случайного сдвига при расстановке мебели. Синхронизированы с 3D и сохраняются в заявке.
- **«Найти место»:** перебор свободных позиций (сначала вдоль стен, спинкой к стене, 4 поворота). Найдено — зелёная подсветка; не найдено — точное сообщение, например: *«Не помещается: не хватает 15 см по ширине вдоль южной стены»*.
- **3D-сцена (Three.js):** комната с окном, дверью и плинтусами, процедурные модели мебели, лампа и дневной свет с тенями.
  - **Обзор** — камера вокруг комнаты, ближние стены скрываются.
  - **Прогулка** — от первого лица, столкновения со стенами и мебелью; рост человека 120–200 см; внизу — расстояние по полу от ног до предмета или стены, куда смотрит пользователь.
  - Текстуры **Простые / Фото** (процедурные или фото-текстуры CC0).
- **Панель «Фото-текстуры»:** готовый набор CC0 применяется в один клик, его можно скачать (по поверхностям или весь набор ZIP) или загрузить своё фото для пола, стен, дерева мебели или обивки (в любой момент можно вернуть готовую).
  - Полноэкранный режим, джойстик на мобильных.
- **Правка плана:** отмена / повтор (↶ ↷, `Ctrl+Z` / `Ctrl+Y`; всё перетаскивание — один шаг), дублирование (`Ctrl+D`), выделение нескольких (`Shift`/`Ctrl`+клик, `Shift`+протяжка — рамка, `Ctrl+A`), перемещение группы и панель **Выровнять / распределить**.
- **Масштаб и сдвиг:** колесо приближает относительно курсора (50–800 %), кнопки − / 100 % / + (100 % = вписать); сдвиг — протяжкой по пустому полу, `Пробел`+протяжка или средней кнопкой; на тач-экране — щипок. Вид не сохраняется.
- **Линейка** (📏 / `M`): клик по двум точкам; точки притягиваются к стенам, плинтусу и краям мебели, `Shift` держит линию ровной. Показывает длину и Δx / Δy; ⌫ — очистить все измерения.
- **Конструктив:** в панели «Окна, двери и конструктив» добавляются колонна, короб (стояк), короб под потолком, выступ стены, батарея (по центру под окном) или **ниша** (два выступа по бокам участка стены). На плане они заштрихованы серым с подписью высоты, перетаскиваются с прилипанием к стенам, редактируются в форме и защищены тем же замком 🔒. Мебель не должна пересекаться с конструктивом на своей высоте (`err.obstacle`, плюс минимальный зазор); конструктив в зоне двери или перед окном даёт предупреждение. В 3D конструктив в материале стены, батарея секционная; в прогулке мешает, если не выше головы.
- **Навесная мебель:** у каждого предмета есть «От пола» (`elev`, см). Коллизии по трём осям: полка над столом — не ошибка, шкаф под коробом под потолком проверяется по его низу, полка в зоне двери — ошибка, только если ниже верха двери. На плане навесные предметы рисуются поверх напольных (полупрозрачно, пунктир, «↑140»); клик выбирает верхний предмет, повторный клик в ту же точку — нижний. Новые типы каталога: навесной шкаф, настенная полка, антресоль, подвесная ТВ-консоль, настенное зеркало.
- **Зоны открывания:** шкафы, комоды, кухня, холодильник и навесные шкафы знают, как открываются (распашные двери, купе, ящики, раскладной; можно поменять у предмета, вместе с числом дверей). Если дверца или ящик упирается в стену, мебель или конструктив на своей высоте — ошибка с нехваткой: «Дверца/ящик не откроется: мешает «Кровать» (не хватает 20 см)». Две зоны на одном месте или зона в зоне двери комнаты — предупреждение. **⌓ Зоны** (клавиша `Z`) по кругу: только выбранный → все → скрыты; проверки работают в любом режиме, у выбранного предмета с ошибкой зона видна всегда. Автоподбор сначала ищет место со свободной зоной.
- **Проходы:** промежутки между мебелью, конструктивом и стенами уже нормы (настройка «Проход от», 60 см по умолчанию; меньше 20 см — щель, а не проход) дают предупреждение: «Узкий проход 48 см (норма от 60)». **↔ Проходы** (клавиша `P`) показывает / скрывает жёлтые полосы на плане, бейдж — их число; в колонке уведомлений сворачиваемая группа «Проходы (N)», клик подсвечивает проход на плане.
- **Проекты и комнаты:** в проекте несколько комнат — вкладки над планом (+ Комната: название, назначение, размеры; ⋯ — переименовать, дублировать как версию «вариант Б», удалить). У каждой комнаты своя история отмены. 📁 **Проекты** — карточки с превью плана: открыть, новый, переименовать, дублировать, удалить, **экспорт / импорт** файла `.fsp3d.json` (резервная копия или перенос на другое устройство). Старый план одной комнаты автоматически переносится в «Мой проект».
- **Шаблоны комнат:** + Комната → **Из шаблона**: набор *Советский дом* (панель / кирпич 1960–90-х, потолок ≈ 2,8 м) или *Новостройка* (монолит/каркас 2015+, потолок ≈ 3,0 м) — спальня, детская, кухня-гостиная, мастер-спальня, зал (в советском — проходной с двумя дверями), большая спальня, кабинет, кухня. На карточке мини-план и «12 м² · 4×3 м». В шаблоне окна с батареями под ними, двери, конструктив (стояки, выступ, колонна) и мебель, расставленная без ошибок; дальше всё можно менять. 📁 Проекты → **Новый проект из шаблона квартиры**: «2-комнатная (сов.)» = зал + спальня + кухня, «3-комнатная (новостройка)» = кухня-гостиная + мастер-спальня + детская, каждая комната — своей вкладкой. Размеры типичные для жилья Ташкента; шаблоны лежат в `templates.json` (`GET /api/templates`).
- **Заявка** — форма (имя, телефон, комментарий) сохраняется в `order.json` вместе с названием проекта и комнаты; галочка «Отправить все комнаты проекта» отправляет все комнаты (в каждой не должно быть ошибок).
- **Языки:** EN / UZ / RU. Проекты хранятся в `localStorage`.

### Стек
Node.js + Express (статика + небольшой JSON API), чистый HTML/CSS/JS (ES-модули, без сборки), Canvas 2D, Three.js (npm + importmap).

### Запуск
```bash
npm install
npm start
```
Откройте http://localhost:3000 (Node.js 18+). Тесты: `npm test`.

### Управление
| Где | Действие | Как |
|---|---|---|
| 2D | Перемещение | перетаскивание мышью / пальцем |
| 2D | Поворот / удаление / сдвиг | `R` / `Del` / стрелки (`Shift` ×10) |
| 2D | Окно / дверь | перетаскивание вдоль стены; `Del` / стрелки у выбранного; 🔒 — замок |
| 2D | Отмена / повтор | `Ctrl+Z` / `Ctrl+Y` (`Ctrl+Shift+Z`) |
| 2D | Дублировать / выделить всё | `Ctrl+D` / `Ctrl+A` |
| 2D | Выделение нескольких | `Shift`/`Ctrl`+клик, `Shift`+протяжка по пустому полу |
| 2D | Масштаб / сдвиг | колесо, щипок / протяжка по пустому полу, `Пробел`+протяжка, средняя кнопка |
| 2D | Линейка | `M` или 📏; `Shift` — ровная линия; `Esc` — выход |
| 3D Обзор | Вращение / масштаб / сдвиг | левая кнопка / колесо / правая кнопка |
| 3D Прогулка | Ходьба | `W A S D` / стрелки, `Shift` — быстрее |
| 3D Прогулка | Взгляд | мышь (после клика) или, если захват курсора недоступен, зажать кнопку мыши и вести |
| 3D Прогулка | Выход | `Esc` |
| Мобильные | Ходьба / взгляд | джойстик / свайп |

### Структура проекта
```
server.js            Express: статика, каталог, шаблоны, заявки, текстуры (список / загрузка / сброс / ZIP)
catalog.json         каталог мебели (типы, размеры по умолчанию, названия на 3 языках)
templates.json       шаблоны комнат (советский дом / новостройка) и наборы квартир
order.json           сохранённые заявки
public/index.html    разметка
public/css/          стили
public/js/           2D: state, geometry, openings, validate, renderer, interaction, autoplace, ui, i18n, storage, order,
                     history (отмена), align, ruler, projects (комнаты, вкладки), projectsDialog, obstacles, catalog, zones, passages, templates
public/js/3d/        3D: scene3d, room3d, models3d, textures3d, lights3d, controls3d, touch3d, obstacles3d
public/textures/     фото-текстуры CC0 (ambientCG); custom/ — загруженные фото (не в git)
test/                модульные тесты (node:test): npm test
```

### Правила
- Все размеры в сантиметрах; шаг привязки 3–5 см.
- Мебель на плане — прямоугольник; коллизии считаются по габариту (AABB).
- Мебель не должна выходить за границы комнаты с учётом плинтуса и пересекаться с другими предметами.

### Лицензии
Фото-текстуры: [ambientCG](https://ambientcg.com) — CC0. Three.js — MIT.
