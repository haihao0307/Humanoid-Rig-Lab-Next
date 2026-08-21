export const CLOTHING_CATALOG = Object.freeze({
  top: Object.freeze([
    Object.freeze({ id: 'top_classic', label: 'Classic Top', type: 'top', color: '#526d9e' }),
    Object.freeze({ id: 'top_sport', label: 'Sport Top', type: 'top', color: '#356f8f' }),
  ]),
  pants: Object.freeze([
    Object.freeze({ id: 'pants_classic', label: 'Classic Pants', type: 'pants', color: '#28364f' }),
    Object.freeze({ id: 'pants_light', label: 'Light Pants', type: 'pants', color: '#596778' }),
  ]),
  shoes: Object.freeze([
    Object.freeze({ id: 'shoes_classic', label: 'Classic Shoes', type: 'shoes', color: '#20242d' }),
    Object.freeze({ id: 'shoes_light', label: 'Light Shoes', type: 'shoes', color: '#7a8794' }),
  ]),
});

export const HAIR_CATALOG = Object.freeze([
  Object.freeze({ id: 'hair_short_001', label: 'Short', style: 'short' }),
  Object.freeze({ id: 'hair_long_001', label: 'Long', style: 'long' }),
  Object.freeze({ id: 'hair_ponytail_001', label: 'Ponytail', style: 'ponytail' }),
]);

export const ACCESSORY_CATALOG = Object.freeze([
  Object.freeze({ id: 'accessory_hat_001', label: 'Hat', type: 'hat' }),
  Object.freeze({ id: 'accessory_glasses_001', label: 'Glasses', type: 'glasses' }),
  Object.freeze({ id: 'accessory_ornament_001', label: 'Ornament', type: 'ornament' }),
]);

export function findClothingCatalogItem(clothingId) {
  return Object.values(CLOTHING_CATALOG).flat().find((item) => item.id === clothingId) || null;
}

export function findHairCatalogItem(styleOrId) {
  return HAIR_CATALOG.find((item) => item.style === styleOrId || item.id === styleOrId) || null;
}

export function findAccessoryCatalogItem(typeOrId) {
  return ACCESSORY_CATALOG.find((item) => item.type === typeOrId || item.id === typeOrId) || null;
}
