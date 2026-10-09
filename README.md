# Furniture Super Planner 3D

**[English](#english) · [O‘zbekcha](#ozbekcha) · [Русский](#русский)**

---

## English

A web app for custom furniture: the client enters the room size and the furniture dimensions, checks what fits and where on a 2D plan, walks through the room in 3D and sends an order.

### Features
- **Room:** length, width, height (cm); the plan is rebuilt instantly.
- **Furniture:** wardrobe, table, sofa, nightstand, bed, chair — width (X), depth (Y), height (Z).
- **2D plan (Canvas, top view):** auto scale, 10/50 cm grid, plinth inset (2 cm by default), distances to walls.
- **Drag & drop** with snapping (5 cm) and magnet to walls/neighbours; rotation 0/90/180/270° (`R`) with a front-side marker.
- **Validation:** an item turns **red** if it crosses a wall (incl. plinth), overlaps another item (AABB), is closer than the minimum gap (3 cm) or taller than the ceiling. The banner shows the exact reason.
- **"Find a spot":** searches free positions (walls first, back to the wall, 4 rotations). Found → green highlight; not found → a precise message, e.g. *"Does not fit: 15 cm short in width along the south wall"*.
- **3D scene (Three.js):** room with window, door and plinths, procedural furniture models, lamp and daylight with shadows.
  - **Overview** — orbit camera, near walls are cut away.
  - **Walk** — first person, collisions with walls and furniture.
  - **Simple / Photo** textures (procedural or CC0 photo textures).
  - Fullscreen mode, touch joystick on mobile.
- **Order** — form (name, phone, comment) is saved to `order.json`.
- **Languages:** EN / UZ / RU. The plan is kept in `localStorage`.

### Tech stack
Node.js + Express (static files + 2 API routes), plain HTML/CSS/JS (ES modules, no build step), Canvas 2D, Three.js (npm + importmap).

### Getting started
```bash
npm install
npm start
```
Open http://localhost:3000 (Node.js 18+).

### Controls
| Where | Action | How |
|---|---|---|
| 2D | Move | drag with mouse / finger |
| 2D | Rotate / delete / nudge | `R` / `Del` / arrows (`Shift` ×10) |
| 3D Overview | Rotate / zoom / pan | left mouse / wheel / right mouse |
| 3D Walk | Move | `W A S D` / arrows, `Shift` — faster |
| 3D Walk | Look | mouse (after click), or drag with the mouse if pointer lock is unavailable |
| 3D Walk | Exit | `Esc` |
| Mobile | Move / look | joystick / swipe |

### Project structure
```
server.js            Express: static, GET /api/catalog, POST /api/order
catalog.json         furniture catalogue (types, default sizes, names in 3 languages)
order.json           saved orders
public/index.html    layout
public/css/          styles
public/js/           2D: state, geometry, validate, renderer, interaction, autoplace, ui, i18n, storage, order
public/js/3d/        3D: scene3d, room3d, models3d, textures3d, lights3d, controls3d, touch3d
public/textures/     CC0 photo textures (ambientCG)
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
- **Mebel:** shkaf, stol, divan, tumba, karavot, stul — kenglik (X), chuqurlik (Y), balandlik (Z).
- **2D reja (Canvas, yuqoridan ko‘rinish):** avtomatik masshtab, 10/50 sm setka, plintus chekinishi (standart 2 sm), devorlargacha masofalar.
- **Sudrab olib borish** setkaga (5 sm) bog‘lanish va devor/qo‘shni buyumlarga yopishish bilan; 0/90/180/270° burish (`R`), old tomon belgisi bilan.
- **Tekshiruv:** buyum **qizil** rangga bo‘yaladi, agar u devordan (plintus bilan) chiqib ketsa, boshqa buyum bilan kesishsa (AABB), minimal oraliqdan (3 sm) yaqin bo‘lsa yoki shiftdan baland bo‘lsa. Banner aniq sababni ko‘rsatadi.
- **«Joy topish»:** bo‘sh joyni qidiradi (avval devorlar bo‘ylab, orqasi devorga, 4 burilish). Topilsa — yashil rang; topilmasa — aniq xabar, masalan: *«Sig‘maydi: janubiy devor bo‘ylab kenglik bo‘yicha 15 sm yetmaydi»*.
- **3D sahna (Three.js):** deraza, eshik va plintusli xona, protsedural mebel modellari, chiroq va kunduzgi yorug‘lik, soyalar bilan.
  - **Ko‘rinish** — kamera xona atrofida aylanadi, yaqin devorlar yashiriladi.
  - **Sayr** — birinchi shaxsdan, devor va mebel bilan to‘qnashuvlar.
  - **Oddiy / Foto** teksturalar (protsedural yoki CC0 foto-teksturalar).
  - To‘liq ekran rejimi, mobil qurilmalarda joystik.
- **Buyurtma** — forma (ism, telefon, izoh) `order.json` fayliga saqlanadi.
- **Tillar:** EN / UZ / RU. Reja `localStorage`da saqlanadi.

### Texnologiyalar
Node.js + Express (statik fayllar + 2 ta API), oddiy HTML/CSS/JS (ES modullar, yig‘ishsiz), Canvas 2D, Three.js (npm + importmap).

### Ishga tushirish
```bash
npm install
npm start
```
http://localhost:3000 manzilini oching (Node.js 18+).

### Boshqaruv
| Qayerda | Amal | Qanday |
|---|---|---|
| 2D | Siljitish | sichqoncha / barmoq bilan sudrash |
| 2D | Burish / o‘chirish / siljitish | `R` / `Del` / strelkalar (`Shift` ×10) |
| 3D Ko‘rinish | Aylantirish / masshtab / surish | chap tugma / g‘ildirak / o‘ng tugma |
| 3D Sayr | Yurish | `W A S D` / strelkalar, `Shift` — tezroq |
| 3D Sayr | Qarash | sichqoncha (bosgandan keyin) yoki kursor qulflanmasa — sichqonchani bosib surish |
| 3D Sayr | Chiqish | `Esc` |
| Mobil | Yurish / qarash | joystik / ekranni surish |

### Loyiha tuzilmasi
```
server.js            Express: statik, GET /api/catalog, POST /api/order
catalog.json         mebel katalogi (turlar, standart o‘lchamlar, 3 tildagi nomlar)
order.json           saqlangan buyurtmalar
public/index.html    sahifa tuzilmasi
public/css/          uslublar
public/js/           2D: state, geometry, validate, renderer, interaction, autoplace, ui, i18n, storage, order
public/js/3d/        3D: scene3d, room3d, models3d, textures3d, lights3d, controls3d, touch3d
public/textures/     CC0 foto-teksturalar (ambientCG)
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
- **Мебель:** шкаф, стол, диван, тумба, кровать, стул — ширина (X), глубина (Y), высота (Z).
- **2D-план (Canvas, вид сверху):** автомасштаб, сетка 10/50 см, отступ плинтуса (по умолчанию 2 см), расстояния до стен.
- **Drag & drop** с привязкой к сетке (5 см) и «магнитом» к стенам и соседям; поворот 0/90/180/270° (`R`) с маркером лицевой стороны.
- **Валидация:** предмет подсвечивается **красным**, если выходит за стену (с учётом плинтуса), пересекается с другим предметом (AABB), стоит ближе минимального зазора (3 см) или выше потолка. Плашка показывает точную причину.
- **«Найти место»:** перебор свободных позиций (сначала вдоль стен, спинкой к стене, 4 поворота). Найдено — зелёная подсветка; не найдено — точное сообщение, например: *«Не помещается: не хватает 15 см по ширине вдоль южной стены»*.
- **3D-сцена (Three.js):** комната с окном, дверью и плинтусами, процедурные модели мебели, лампа и дневной свет с тенями.
  - **Обзор** — камера вокруг комнаты, ближние стены скрываются.
  - **Прогулка** — от первого лица, столкновения со стенами и мебелью.
  - Текстуры **Простые / Фото** (процедурные или фото-текстуры CC0).
  - Полноэкранный режим, джойстик на мобильных.
- **Заявка** — форма (имя, телефон, комментарий) сохраняется в `order.json`.
- **Языки:** EN / UZ / RU. План хранится в `localStorage`.

### Стек
Node.js + Express (статика + 2 API-маршрута), чистый HTML/CSS/JS (ES-модули, без сборки), Canvas 2D, Three.js (npm + importmap).

### Запуск
```bash
npm install
npm start
```
Откройте http://localhost:3000 (Node.js 18+).

### Управление
| Где | Действие | Как |
|---|---|---|
| 2D | Перемещение | перетаскивание мышью / пальцем |
| 2D | Поворот / удаление / сдвиг | `R` / `Del` / стрелки (`Shift` ×10) |
| 3D Обзор | Вращение / масштаб / сдвиг | левая кнопка / колесо / правая кнопка |
| 3D Прогулка | Ходьба | `W A S D` / стрелки, `Shift` — быстрее |
| 3D Прогулка | Взгляд | мышь (после клика) или, если захват курсора недоступен, зажать кнопку мыши и вести |
| 3D Прогулка | Выход | `Esc` |
| Мобильные | Ходьба / взгляд | джойстик / свайп |

### Структура проекта
```
server.js            Express: статика, GET /api/catalog, POST /api/order
catalog.json         каталог мебели (типы, размеры по умолчанию, названия на 3 языках)
order.json           сохранённые заявки
public/index.html    разметка
public/css/          стили
public/js/           2D: state, geometry, validate, renderer, interaction, autoplace, ui, i18n, storage, order
public/js/3d/        3D: scene3d, room3d, models3d, textures3d, lights3d, controls3d, touch3d
public/textures/     фото-текстуры CC0 (ambientCG)
```

### Правила
- Все размеры в сантиметрах; шаг привязки 3–5 см.
- Мебель на плане — прямоугольник; коллизии считаются по габариту (AABB).
- Мебель не должна выходить за границы комнаты с учётом плинтуса и пересекаться с другими предметами.

### Лицензии
Фото-текстуры: [ambientCG](https://ambientcg.com) — CC0. Three.js — MIT.
