// Catalog materials (catalog.json → materials) on furniture. Pure helpers.
// material = { id, name{ru,uz,en}, kind: 'wood'|'solid'|'gloss'|'fabric', color, priceRate (sum / m²) }
// item.materials = { body?, facade? } — material ids; the facade falls back to the body.

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

// Own colour: the body material is dropped (the facade one stays).
export function setItemColor(item, color) {
  item.color = color;
  if (item.materials?.body) setItemMaterial(item, 'body', null);
}
