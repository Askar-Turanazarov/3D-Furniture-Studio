// Furniture kits for "🎲 Furnish": what goes into a room of each purpose and where. Data only.
// kit = { id, purpose, min: [short side, long side] (cm), max? (compact kits), items: [spec] }; anchors come first, dependents after.
// spec = {
//   type, key?          — catalog type; key names it for relations of later items
//   w?: n | [min, max]  — width (a range: the seed picks one, smaller ones are tried when it does not fit)
//   at: [rule]          — tried in order, then "find a spot" unless fallback: false
//   optional?: p        — included with probability p (never reported when it does not fit)
//   oneOf?: [partial]   — the seed picks one alternative (merged into the spec)
//   count?: n | [a, b]  — several items on the slots of a relation (chairs around a table)
// }
// rule = { wall: [category], align?: 'center'|'corner'|'window' }   categories: long, short, window, blank (no window,
//          no door), noWindow, door, opposite (facing a window), any
//      | { rel: 'left'|'right'|'both'|'front'|'toward'|'above'|'under'|'facing'|'flank'|'around', to: key, gap?, turn? }
//      | { free: true }                       — anywhere, the middle of the room first
//      | { window: true }                     — on every window, as wide as the window plus margins (curtains)

const wall = (cats, align) => ({ wall: cats, ...(align && { align }) });
const rel = (r, to, o = {}) => ({ rel: r, to, ...o });
const FREE = { free: true };
const WINDOW = { window: true };
const curtains = { type: 'curtains', at: [WINDOW], optional: 0.9 };

export const KITS = [
  // ---- living room ----
  { id: 'living-tv', purpose: 'living', min: [300, 320], items: [
    { key: 'sofa', type: 'sofa', w: [180, 240], at: [wall(['blank', 'noWindow', 'any'], 'center')] },
    { key: 'ct', type: 'coffeetable', at: [rel('front', 'sofa', { gap: 40 })] },
    { key: 'tvs', type: 'tvstand', w: [120, 180], at: [rel('facing', 'sofa'), wall(['noWindow', 'any'], 'center')] },
    { type: 'tv', at: [rel('above', 'tvs')], fallback: false, optional: 0.85 },
    { type: 'armchair', at: [rel('flank', 'ct', { gap: 30 })], fallback: false, optional: 0.6 },
    { type: 'rug', at: [rel('under', 'ct')], fallback: false, optional: 0.7 },
    { type: 'painting', at: [rel('above', 'sofa')], fallback: false, optional: 0.6 },
    { type: 'floorlamp', at: [rel('right', 'sofa', { gap: 10 }), rel('left', 'sofa', { gap: 10 })], fallback: false, optional: 0.5 },
    { type: 'bookshelf', at: [wall(['blank', 'any'], 'corner')], optional: 0.5 },
    { type: 'plant', at: [wall(['window', 'any'], 'corner')], fallback: false, optional: 0.5 },
    curtains
  ] },
  { id: 'living-corner', purpose: 'living', min: [330, 400], items: [
    { key: 'sofa', type: 'cornersofa', at: [wall(['blank', 'noWindow', 'any'], 'corner')] },
    { key: 'ct', type: 'coffeetable', at: [rel('front', 'sofa', { gap: 40 })] },
    { key: 'tvp', type: 'tvpanel', w: [140, 180], at: [rel('facing', 'sofa'), wall(['noWindow', 'any'], 'center')] },
    { type: 'tv', at: [rel('above', 'tvp')], fallback: false, optional: 0.9 },
    { type: 'rug', at: [rel('under', 'ct')], fallback: false, optional: 0.7 },
    { type: 'sideboard', w: [120, 160], at: [wall(['blank', 'any'], 'center')], optional: 0.6 },
    { type: 'plant', at: [wall(['window', 'any'], 'corner')], fallback: false, optional: 0.6 },
    curtains
  ] },
  { id: 'living-library', purpose: 'living', min: [300, 340], items: [
    { key: 'sofa', type: 'sofa', w: [180, 220], at: [wall(['noWindow', 'any'], 'center')] },
    { key: 'ct', type: 'coffeetable', at: [rel('front', 'sofa', { gap: 40 })] },
    { key: 'bs', type: 'bookshelf', at: [wall(['blank', 'noWindow', 'any'], 'corner')] },
    { type: 'bookshelf', at: [rel('right', 'bs', { gap: 5 }), rel('left', 'bs', { gap: 5 })], fallback: false, optional: 0.8 },
    { type: 'armchair', count: 2, at: [rel('flank', 'ct', { gap: 30 })], fallback: false, optional: 0.8 },
    { type: 'floorlamp', at: [rel('left', 'sofa', { gap: 10 }), rel('right', 'sofa', { gap: 10 })], fallback: false, optional: 0.7 },
    { type: 'vitrine', at: [wall(['any'], 'corner')], optional: 0.5 },
    { type: 'rug', at: [rel('under', 'ct')], fallback: false, optional: 0.6 },
    curtains
  ] },
  { id: 'living-guest', purpose: 'living', min: [320, 380], items: [
    { key: 'sofa', type: 'sofa', w: [200, 240], at: [wall(['blank', 'noWindow', 'any'], 'center')] },
    { key: 'ct', type: 'coffeetable', at: [rel('front', 'sofa', { gap: 40 })] },
    { key: 'tvs', type: 'tvstand', w: [140, 180], at: [rel('facing', 'sofa'), wall(['noWindow', 'any'], 'center')] },
    { type: 'tv', at: [rel('above', 'tvs')], fallback: false, optional: 0.8 },
    { key: 'sb', type: 'sideboard', w: [120, 160], at: [wall(['any'], 'corner')], optional: 0.7 },
    { type: 'vitrine', at: [rel('right', 'sb', { gap: 5 }), rel('left', 'sb', { gap: 5 }), wall(['any'], 'corner')], optional: 0.6 },
    { type: 'painting', at: [rel('above', 'sofa')], fallback: false, optional: 0.7 },
    { type: 'pouf', at: [rel('flank', 'ct', { gap: 30 })], fallback: false, optional: 0.5 },
    curtains
  ] },

  // ---- bedroom ----
  { id: 'bedroom-classic', purpose: 'bedroom', min: [300, 320], items: [
    { key: 'bed', type: 'bed', w: [140, 180], at: [wall(['blank', 'noWindow', 'any'], 'center')] },
    { type: 'nightstand', at: [rel('both', 'bed', { gap: 5 })], fallback: false },
    { type: 'wardrobe', w: [100, 200], at: [wall(['door', 'blank', 'any'], 'corner')] },
    { key: 'dr', type: 'dresser', at: [wall(['any'], 'center')], optional: 0.7 },
    { type: 'tv', at: [rel('above', 'dr')], fallback: false, optional: 0.4 },
    { type: 'painting', at: [rel('above', 'bed')], fallback: false, optional: 0.6 },
    { type: 'rug', at: [rel('front', 'bed', { gap: -60, turn: 90 })], fallback: false, optional: 0.4 },
    curtains
  ] },
  { id: 'bedroom-vanity', purpose: 'bedroom', min: [290, 320], items: [
    { key: 'bed', type: 'bed', w: [140, 180], at: [wall(['blank', 'noWindow', 'any'], 'center')] },
    { type: 'nightstand', at: [rel('both', 'bed', { gap: 5 })], fallback: false },
    { type: 'wardrobe', w: [120, 200], at: [wall(['door', 'blank', 'any'], 'corner')] },
    { key: 'vn', type: 'vanity', at: [wall(['window', 'any'], 'corner')], optional: 0.9 },
    { type: 'pouf', at: [rel('toward', 'vn', { gap: 5 })], fallback: false, optional: 0.8 },
    { type: 'mirror', at: [rel('above', 'vn')], fallback: false, optional: 0.8 },
    { type: 'sconce', at: [rel('both', 'bed', { gap: 5 })], fallback: false, optional: 0.4 },
    curtains
  ] },
  { id: 'bedroom-tv', purpose: 'bedroom', min: [320, 350], items: [
    { key: 'bed', type: 'bed', w: [160, 180], at: [wall(['blank', 'noWindow', 'any'], 'center')] },
    { type: 'nightstand', at: [rel('both', 'bed', { gap: 5 })], fallback: false },
    { key: 'tvs', type: 'tvstand', w: [120, 160], at: [rel('facing', 'bed'), wall(['noWindow', 'any'], 'center')] },
    { type: 'tv', at: [rel('above', 'tvs')], fallback: false, optional: 0.9 },
    { type: 'wardrobe', w: [100, 180], at: [wall(['door', 'blank', 'any'], 'corner')] },
    { type: 'floorlamp', at: [wall(['window', 'any'], 'corner')], fallback: false, optional: 0.5 },
    curtains
  ] },
  { id: 'bedroom-compact', purpose: 'bedroom', min: [240, 270], max: [300, 360], items: [
    { key: 'bed', type: 'bed', w: [120, 140], at: [wall(['blank', 'noWindow', 'any'], 'corner')] },
    { key: 'ns', type: 'nightstand', at: [rel('right', 'bed', { gap: 5 }), rel('left', 'bed', { gap: 5 })], fallback: false },
    { type: 'wallshelf', w: [60, 80], at: [rel('above', 'ns')], fallback: false, optional: 0.5 },
    { type: 'wardrobe', w: [80, 140], at: [wall(['door', 'blank', 'any'], 'corner')] },
    { type: 'dresser', w: [80, 100], at: [wall(['any'], 'corner')], optional: 0.4 },
    curtains
  ] },

  // ---- kids' room ----
  { id: 'kids-study', purpose: 'kids', min: [250, 280], items: [
    { key: 'bed', type: 'bed1', at: [wall(['blank', 'noWindow', 'any'], 'corner')] },
    { key: 'desk', type: 'desk', w: [100, 120], at: [wall(['window', 'any'], 'window')] },
    { type: 'chair', at: [rel('toward', 'desk', { gap: 5 })] },
    { type: 'wardrobe', w: [80, 120], at: [wall(['door', 'blank', 'any'], 'corner')] },
    { type: 'wallshelf', at: [rel('above', 'desk')], fallback: false, optional: 0.6 },
    { type: 'bookshelf', at: [wall(['any'], 'corner')], optional: 0.6 },
    { type: 'rug', at: [FREE], fallback: false, optional: 0.5 },
    curtains
  ] },
  { id: 'kids-bunk', purpose: 'kids', min: [260, 300], items: [
    { key: 'bed', type: 'bunkbed', at: [wall(['blank', 'noWindow', 'any'], 'corner')] },
    { key: 'desk', type: 'desk', w: [120, 140], at: [wall(['window', 'any'], 'window')] },
    { type: 'chair', count: [1, 2], at: [rel('around', 'desk', { gap: 5, sides: 'front' })] },
    { type: 'wardrobe', w: [80, 120], at: [wall(['door', 'blank', 'any'], 'corner')] },
    { type: 'dresser', w: [80, 100], at: [wall(['any'], 'corner')], optional: 0.5 },
    curtains
  ] },
  { id: 'kids-nursery', purpose: 'kids', min: [250, 270], items: [
    { key: 'cot', type: 'cot', at: [wall(['blank', 'noWindow', 'any'], 'center')] },
    { type: 'dresser', w: [80, 100], at: [wall(['any'], 'corner')] },
    { type: 'wardrobe', w: [80, 120], at: [wall(['door', 'blank', 'any'], 'corner')] },
    { type: 'armchair', at: [wall(['window', 'any'], 'corner')], optional: 0.7 },
    { type: 'rug', at: [FREE], fallback: false, optional: 0.6 },
    curtains
  ] },

  // ---- study ----
  { id: 'study-books', purpose: 'study', min: [230, 260], items: [
    { key: 'desk', type: 'desk', w: [120, 160], at: [wall(['window', 'any'], 'window')] },
    { type: 'chair', at: [rel('toward', 'desk', { gap: 5 })] },
    { key: 'bs', type: 'bookshelf', at: [wall(['blank', 'noWindow', 'any'], 'corner')] },
    { type: 'bookshelf', at: [rel('right', 'bs', { gap: 5 }), rel('left', 'bs', { gap: 5 })], fallback: false, optional: 0.6 },
    { type: 'wallshelf', at: [rel('above', 'desk')], fallback: false, optional: 0.4 },
    { type: 'plant', at: [wall(['any'], 'corner')], fallback: false, optional: 0.4 },
    curtains
  ] },
  { id: 'study-lounge', purpose: 'study', min: [260, 300], items: [
    { key: 'desk', type: 'desk', w: [120, 140], at: [wall(['window', 'any'], 'window')] },
    { type: 'chair', at: [rel('toward', 'desk', { gap: 5 })] },
    { key: 'ac', type: 'armchair', at: [wall(['blank', 'any'], 'corner')], optional: 0.8 },
    { type: 'floorlamp', at: [rel('right', 'ac', { gap: 5 }), rel('left', 'ac', { gap: 5 })], fallback: false, optional: 0.7 },
    { type: 'bookshelf', at: [wall(['noWindow', 'any'], 'corner')] },
    curtains
  ] },
  { id: 'study-guest', purpose: 'study', min: [270, 320], items: [
    { key: 'desk', type: 'desk', w: [120, 140], at: [wall(['window', 'any'], 'window')] },
    { type: 'chair', at: [rel('toward', 'desk', { gap: 5 })] },
    { key: 'sofa', type: 'sofa', w: [160, 200], at: [wall(['blank', 'noWindow', 'any'], 'center')], optional: 0.8 },
    { type: 'wardrobe', w: [80, 120], at: [wall(['door', 'any'], 'corner')], optional: 0.7 },
    { type: 'painting', at: [rel('above', 'sofa')], fallback: false, optional: 0.5 },
    curtains
  ] },

  // ---- hallway ----
  { id: 'hall-wardrobe', purpose: 'hall', min: [140, 180], items: [
    { key: 'hw', type: 'hallwardrobe', w: [80, 140], at: [wall(['door', 'long', 'any'], 'corner')] },
    { key: 'sr', type: 'shoerack', w: [60, 80], at: [rel('right', 'hw', { gap: 5 }), rel('left', 'hw', { gap: 5 }), wall(['any'], 'corner')], optional: 0.7 },
    { type: 'mirror', at: [rel('above', 'sr'), wall(['long', 'any'], 'center')], fallback: false, optional: 0.8 },
    { type: 'keyholder', at: [wall(['door', 'any'], 'center')], fallback: false, optional: 0.6 }
  ] },
  { id: 'hall-open', purpose: 'hall', min: [130, 160], items: [
    { key: 'sr', type: 'shoerack', w: [60, 100], at: [wall(['door', 'long', 'any'], 'corner')] },
    { type: 'mirror', at: [rel('above', 'sr')], fallback: false, optional: 0.8 },
    { type: 'hanger', at: [rel('right', 'sr', { gap: 5 }), rel('left', 'sr', { gap: 5 }), wall(['long', 'any'], 'corner')], optional: 0.8 },
    { type: 'bench', w: [80, 100], at: [wall(['long', 'any'], 'center')], optional: 0.5 },
    { type: 'keyholder', at: [wall(['door', 'any'], 'center')], fallback: false, optional: 0.5 }
  ] },
  { id: 'hall-closet', purpose: 'hall', min: [150, 200], items: [
    { key: 'wr', type: 'wardrobe', w: [100, 180], at: [wall(['long', 'any'], 'corner')] },
    { key: 'sr', type: 'shoerack', w: [60, 80], at: [wall(['door', 'any'], 'corner')], optional: 0.7 },
    { type: 'mirror', at: [rel('above', 'sr'), wall(['any'], 'center')], fallback: false, optional: 0.7 },
    { type: 'bench', w: [60, 80], at: [wall(['any'], 'center')], optional: 0.3 }
  ] },

  // ---- kitchen ----
  { id: 'kitchen-block', purpose: 'kitchen', min: [240, 280], items: [
    { key: 'k', type: 'kitchen', w: [180, 300], at: [wall(['blank', 'noWindow', 'any'], 'corner')] },
    { type: 'fridge', at: [rel('right', 'k', { gap: 5 }), rel('left', 'k', { gap: 5 }), wall(['any'], 'corner')] },
    { key: 't', type: 'table', w: [80, 120], at: [FREE, wall(['window', 'any'], 'center')] },
    { type: 'chair', count: [2, 4], at: [rel('around', 't', { gap: 5 })], fallback: false },
    curtains
  ] },
  { id: 'kitchen-modules', purpose: 'kitchen', min: [250, 300], items: [
    { key: 'sink', type: 'sinkunit', at: [wall(['window', 'any'], 'window')] },
    { key: 'b1', type: 'basecab', at: [rel('right', 'sink', { gap: 3 }), rel('left', 'sink', { gap: 3 })], fallback: false, optional: 0.9 },
    { key: 'st', type: 'stove', at: [rel('right', 'b1', { gap: 3 }), rel('left', 'b1', { gap: 3 }), rel('left', 'sink', { gap: 3 }), rel('right', 'sink', { gap: 3 })] },
    { type: 'dishwasher', at: [rel('left', 'sink', { gap: 3 }), rel('right', 'sink', { gap: 3 })], fallback: false, optional: 0.5 },
    { type: 'wallcabinet', at: [rel('above', 'st')], fallback: false, optional: 0.8 },
    { type: 'wallcabinet', at: [rel('above', 'b1')], fallback: false, optional: 0.8 },
    { type: 'fridge', at: [wall(['noWindow', 'any'], 'corner')] },
    { key: 't', type: 'roundtable', w: [80, 100], at: [FREE, wall(['any'], 'center')], optional: 0.9 },
    { type: 'chair', count: [2, 3], at: [rel('around', 't', { gap: 5 })], fallback: false },
    curtains
  ] },
  { id: 'kitchen-compact', purpose: 'kitchen', min: [220, 260], max: [270, 340], items: [
    { key: 'k', type: 'kitchen', w: [150, 200], at: [wall(['blank', 'noWindow', 'any'], 'corner')] },
    { type: 'fridge', at: [rel('right', 'k', { gap: 5 }), rel('left', 'k', { gap: 5 }), wall(['any'], 'corner')] },
    { key: 't', type: 'table', w: [80, 100], d: 60, at: [wall(['window', 'any'], 'center'), FREE] },
    { type: 'chair', count: 2, at: [rel('around', 't', { gap: 5 })], fallback: false },
    { type: 'washer', at: [wall(['any'], 'corner')], optional: 0.3 },
    curtains
  ] },

  // ---- kitchen-living room ----
  { id: 'kl-dining', purpose: 'kitchenLiving', min: [380, 450], items: [
    { key: 'k', type: 'kitchen', w: [240, 300], at: [wall(['blank', 'noWindow', 'any'], 'corner')] },
    { type: 'fridge', at: [rel('right', 'k', { gap: 5 }), rel('left', 'k', { gap: 5 }), wall(['any'], 'corner')] },
    { key: 'sofa', type: 'sofa', w: [180, 220], at: [wall(['noWindow', 'any'], 'center')] },
    { key: 'tvs', type: 'tvstand', w: [120, 160], at: [rel('facing', 'sofa'), wall(['any'], 'center')], optional: 0.8 },
    { type: 'tv', at: [rel('above', 'tvs')], fallback: false, optional: 0.9 },
    { key: 't', type: 'table', w: [100, 140], at: [FREE] },
    { type: 'chair', count: [4, 6], at: [rel('around', 't', { gap: 5 })], fallback: false },
    curtains
  ] },
  { id: 'kl-island', purpose: 'kitchenLiving', min: [420, 500], items: [
    { key: 'k', type: 'kitchen', w: [240, 300], at: [wall(['blank', 'noWindow', 'any'], 'center')] },
    { type: 'fridge', at: [rel('right', 'k', { gap: 5 }), rel('left', 'k', { gap: 5 }), wall(['any'], 'corner')] },
    { key: 'is', type: 'island', w: [120, 160], at: [rel('front', 'k', { gap: 100, turn: 180 }), FREE], fallback: false, optional: 0.9 },
    { type: 'barstool', count: [2, 3], at: [rel('around', 'is', { gap: 5, sides: 'back' })], fallback: false },
    { key: 'sofa', type: 'sofa', w: [180, 220], at: [wall(['noWindow', 'any'], 'center')] },
    { key: 'tvp', type: 'tvpanel', w: [140, 160], at: [rel('facing', 'sofa')], fallback: false, optional: 0.8 },
    { type: 'tv', at: [rel('above', 'tvp')], fallback: false, optional: 0.9 },
    curtains
  ] },
  { id: 'kl-lounge', purpose: 'kitchenLiving', min: [380, 450], items: [
    { key: 'k', type: 'kitchen', w: [200, 280], at: [wall(['blank', 'noWindow', 'any'], 'corner')] },
    { type: 'fridge', at: [rel('right', 'k', { gap: 5 }), rel('left', 'k', { gap: 5 }), wall(['any'], 'corner')] },
    { key: 't', type: 'roundtable', at: [FREE] },
    { type: 'chair', count: [3, 4], at: [rel('around', 't', { gap: 5 })], fallback: false },
    { key: 'sofa', type: 'sofa', w: [180, 220], at: [wall(['noWindow', 'any'], 'center')] },
    { type: 'coffeetable', at: [rel('front', 'sofa', { gap: 40 })], fallback: false, optional: 0.6 },
    { type: 'sideboard', w: [120, 160], at: [wall(['any'], 'center')], optional: 0.5 },
    curtains
  ] },

  // ---- bathroom ----
  { id: 'bath-tub', purpose: 'bathroom', min: [180, 220], items: [
    { key: 'tub', type: 'bathtub', at: [wall(['long', 'any'], 'corner')] },
    { key: 'bs', type: 'basin', at: [wall(['any'], 'corner')] },
    { type: 'mirrorcab', at: [rel('above', 'bs')], fallback: false, optional: 0.9 },
    { type: 'toilet', at: [wall(['any'], 'corner')] },
    { type: 'washer', at: [wall(['any'], 'corner')], optional: 0.7 },
    { type: 'towelrail', at: [wall(['any'], 'center')], fallback: false, optional: 0.7 }
  ] },
  { id: 'bath-shower', purpose: 'bathroom', min: [170, 200], items: [
    { key: 'sh', type: 'shower', at: [wall(['any'], 'corner')] },
    { key: 'bs', type: 'basin', at: [wall(['any'], 'corner')] },
    { type: 'mirror', at: [rel('above', 'bs')], fallback: false, optional: 0.9 },
    { type: 'toilet', at: [wall(['any'], 'corner')] },
    { type: 'washer', at: [wall(['any'], 'corner')], optional: 0.8 },
    { type: 'towelrail', at: [wall(['any'], 'center')], fallback: false, optional: 0.6 }
  ] },
  { id: 'bath-laundry', purpose: 'bathroom', min: [180, 230], items: [
    { key: 'tub', type: 'bathtub', at: [wall(['long', 'any'], 'corner')] },
    { key: 'w', type: 'washer', at: [wall(['any'], 'corner')] },
    { key: 'bs', type: 'basin', at: [rel('right', 'w', { gap: 5 }), rel('left', 'w', { gap: 5 }), wall(['any'], 'corner')] },
    { type: 'mirrorcab', at: [rel('above', 'bs')], fallback: false, optional: 0.8 },
    { type: 'boiler', at: [rel('above', 'w')], fallback: false, optional: 0.4 }
  ] }
];

// Colours: the seed picks one palette for the room; a role picks the material.
// wood — cases, tables, beds; fabric — upholstery; facade — doors and fronts; kitchen — kitchen fronts.
export const PALETTES = [
  { id: 'scandi', wood: 'ash-white', facade: 'white-matte', fabric: 'fabric-grey', kitchen: 'gloss-white' },
  { id: 'warm', wood: 'oak-sonoma', facade: 'white-matte', fabric: 'fabric-beige', kitchen: 'gloss-beige' },
  { id: 'dark', wood: 'walnut', facade: 'graphite', fabric: 'velour-blue', kitchen: 'graphite' },
  { id: 'sage', wood: 'oak-sonoma', facade: 'sage', fabric: 'fabric-grey', kitchen: 'sage' }
];
