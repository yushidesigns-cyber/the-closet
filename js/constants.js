export const CATS = ['Sarees','Blouse','Lehenga','Suits','Dresses','Jumpsuit','Tops','Layering','Outerwear','Bottoms','Jewellery','Bags','Footwear'];

export const TINT = {
  Sarees:'#E3D7C6', Blouse:'#E8DFD3', Lehenga:'#DFD3D5', Suits:'#D9D8D1', Dresses:'#D8DBD4',
  Jumpsuit:'#D5D8DA', Tops:'#E2E0D8', Layering:'#DCD7CD', Outerwear:'#D4D1C8', Bottoms:'#D7D5CC',
  Jewellery:'#E9DFC6', Bags:'#DFD7CB', Footwear:'#D8D4CA'
};

export const JTYPES = ['Earrings','Rings','Necklace','Hair','Waist chain','Bangles','Watch'];
export const BASE_MOODS = ['Ethnic','Dressy','Casual','Work'];

export const SUBS = {
  Sarees:['Silk','Cotton','Organza','Party'], Blouse:['Sleeveless','Full sleeve','Halter','Designer'],
  Lehenga:['Raw silk','Tulle','Sequin'], Suits:['Tailored','Linen','Kurta set'],
  Dresses:['Slip','Shirt','Wrap','Column'], Jumpsuit:['Utility','Wide leg'],
  Tops:['Shirt','Tee','Knit','Cami'], Layering:['Cardigan','Waistcoat','Jacket'],
  Outerwear:['Trench','Wool','Quilted'], Bottoms:['Denim','Trousers','Skirt','Palazzo'],
  Jewellery:['Gold','Silver','Kundan','Pearl'], Bags:['Tote','Clutch','Crossbody'], Footwear:['Flats','Heels','Sneakers']
};

// Fashion IQ pairs a "side" (either a whole category, or 'Jewellery:<jtype>' for a
// specific piece like earrings vs necklace) against another side. Generated
// programmatically so every category and every jewellery subtype gets matched
// against every other wearable-with side — not just a hand-picked shortlist —
// which is what makes the mix-and-match feel endless instead of repetitive.
const MAINS = ['Sarees','Lehenga','Suits','Dresses','Jumpsuit'];
const LAYERS = ['Layering','Outerwear'];
const JEWEL_SIDES = JTYPES.map(jt => 'Jewellery:' + jt);
const ACCESSORIES = ['Bags','Footwear'].concat(JEWEL_SIDES);

function cross(as, bs) {
  const out = [];
  as.forEach(a => bs.forEach(b => { if (a !== b) out.push([a, b]); }));
  return out;
}
function jewelCombos(sides) {
  const out = [];
  sides.forEach((a, i) => sides.slice(i + 1).forEach(b => out.push([a, b])));
  return out;
}

export const PAIRS = [
  ['Sarees', 'Blouse'], ['Lehenga', 'Blouse'],
  ...cross(MAINS, ACCESSORIES),
  ...cross(['Blouse'], ACCESSORIES),
  ['Tops', 'Bottoms'],
  ...cross(['Tops', 'Bottoms'], ACCESSORIES),
  ...cross(LAYERS, MAINS.concat(['Tops', 'Bottoms'], ACCESSORIES)),
  ['Bags', 'Footwear'],
  ...jewelCombos(JEWEL_SIDES)
];

export const SLOTSETS = {
  saree:[['Saree',['Sarees'],null],['Blouse',['Blouse'],null],['Necklace',['Jewellery'],'Necklace'],['Earrings',['Jewellery'],'Earrings'],['Bangles',['Jewellery'],'Bangles'],['Bag',['Bags'],null],['Footwear',['Footwear'],null]],
  lehenga:[['Lehenga',['Lehenga'],null],['Blouse',['Blouse'],null],['Necklace',['Jewellery'],'Necklace'],['Earrings',['Jewellery'],'Earrings'],['Bangles',['Jewellery'],'Bangles'],['Footwear',['Footwear'],null]],
  dress:[['Main outfit',['Dresses'],null],['Layer',['Layering','Outerwear'],null],['Necklace',['Jewellery'],'Necklace'],['Earrings',['Jewellery'],'Earrings'],['Bag',['Bags'],null],['Footwear',['Footwear'],null]],
  suit:[['Main outfit',['Suits'],null],['Top',['Tops'],null],['Watch',['Jewellery'],'Watch'],['Earrings',['Jewellery'],'Earrings'],['Bag',['Bags'],null],['Footwear',['Footwear'],null]],
  separates:[['Top',['Tops'],null],['Bottom',['Bottoms'],null],['Layer',['Layering','Outerwear'],null],['Necklace',['Jewellery'],'Necklace'],['Earrings',['Jewellery'],'Earrings'],['Bag',['Bags'],null],['Footwear',['Footwear'],null]],
  jumpsuit:[['Main outfit',['Jumpsuit'],null],['Layer',['Layering','Outerwear'],null],['Earrings',['Jewellery'],'Earrings'],['Bag',['Bags'],null],['Footwear',['Footwear'],null]]
};

export const BASE_BY_MOOD = {Ethnic:['saree','lehenga','suit'], Dressy:['saree','dress','lehenga','jumpsuit'], Casual:['separates','dress','jumpsuit'], Work:['suit','separates','dress']};

export const NAV_ICONS = {
  closet:'M12 4.2a1.9 1.9 0 1 0 1.4 3.2L4.5 15.4V19h15v-3.6L12 9.4',
  put:'M4 4.8h6.5v6.5H4zM13.5 4.8H20v4h-6.5zM13.5 11.3H20V19h-6.5zM4 13.8h6.5V19H4z',
  iq:'M3.5 19h17M6 19V9.5M11 19V4.5M16 19v-6.5',
  planned:'M4.5 6.5h15V19h-15zM4.5 11h15M9 4v4M15 4v4',
  settings:'M4.5 7.5h15M4.5 12h15M4.5 16.5h15'
};

export const NAV = [
  {key:'closet', label:'Closet'},
  {key:'put', label:'Outfit'},
  {key:'iq', label:'IQ'},
  {key:'planned', label:'Planned'},
  {key:'settings', label:'Settings'}
];

// bumped on every deploy while testing, shown above the closet item count
// so it's obvious whether a fresh build actually loaded vs a cached one.
export const APP_VERSION = 'v14';

export const ACCENT = '#B8412A';
export const DEFAULT_CLOSET_VIEW = 'grid';
export const ASSEMBLE_PACE = 210;

// Real build ships with an empty wardrobe — no seeded placeholder pieces.
export const SEED = [];
