// catalog.json: v2 = { version, items, materials, pricing }; v1 was a plain array of items.
// Optional item fields: elev (cm above the floor), mount ('floor' | 'wall'), open (opening zone, phase 4).
export function parseCatalog(data) {
  if (Array.isArray(data)) return { items: data, materials: [], pricing: {} };
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    materials: Array.isArray(data?.materials) ? data.materials : [],
    pricing: data?.pricing && typeof data.pricing === 'object' ? data.pricing : {}
  };
}
