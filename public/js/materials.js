// Catalog materials (catalog.json → materials) on furniture. Pure helpers.
// material = { id, name{ru,uz,en}, kind: one of MAT_KINDS, color, priceRate (sum / m²) }
// item.materials = { body?, facade? } — material ids; the facade falls back to the body.

// Luxe kinds are the collection materials (textures3d furnitureMat: photo set or procedural look).
export const UPHOLSTERY = ['fabric', 'boucle', 'velvet', 'linen', 'leatherQuilt', 'leatherCream', 'leatherBlack', 'leatherTan'];
export const MAT_KINDS = ['wood', 'solid', 'gloss', 'veneer', 'burl', 'oak', 'lacquer', 'marble', 'marbleNero', 'travertine', ...UPHOLSTERY];
// Boards (carcass, fronts, tops) or upholstery: a chosen material replaces only the parts of its family.
export const familyOf = kind => UPHOLSTERY.includes(kind) ? 'fabric' : 'board';

export const matById = (materials, id) => (id && materials.find(m => m.id === id)) || null;

export function itemLook(item, materials = []) {
  const body = matById(materials, item.materials?.body);
  return { body, facade: matById(materials, item.materials?.facade) || body };
}

// Types with doors / drawer fronts get a separate facade material.
export const hasFacade = (item, catalog = []) => !!catalog.find(c => c.type === item.type)?.facade;

// Pick a material for a part; the body material also becomes the plan colour.
export function setItemMaterial(item, role, mat) {
  const next = { ...item.materials };
  if (mat) next[role] = mat.id; else delete next[role];
  if (Object.keys(next).length) item.materials = next; else delete item.materials;
  if (role === 'body' && mat) item.color = mat.color;
}

// Own colour: the body material is dropped (the facade one stays); the style's materials take this colour.
export function setItemColor(item, color) {
  item.color = color;
  item.ownColor = true;
  if (item.materials?.body) setItemMaterial(item, 'body', null);
}

/** A new furniture style for the room: the items lose their materials and own colours, the style gives the look. */
export function resetToStyle(items) {
  let n = 0;
  for (const it of items) {
    if (it.materials || it.ownColor) n++;
    delete it.materials;
    delete it.ownColor;
  }
  return n;
}
