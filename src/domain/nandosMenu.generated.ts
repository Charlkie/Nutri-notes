// Generated from Nando's Australia official nutritional-information pages by scripts/import-nandos.mjs.
// Values are per published serving. Each row retains its item-specific official source path.
export type NandosMenuDatum = readonly [name: string, category: string, servingGrams: number, kilojoules: number, calories: number, protein: number, carbohydrates: number, fat: number, sourcePath: string];

export const nandosMenuIndexUrl = "https://www.nandos.com.au/menu-item";

export const nandosMenu: readonly NandosMenuDatum[] = [
  ["4 PERi-PERi Grilled Tenders","Chicken For One",160,922,220,39.6,0.7,6.5,"menu-item/tenders"],
  ["Avo Goodness","Burgers, Wraps & Pitas",333,2380,568,38.4,52.4,21.5,"menu-item/avo-goodness-nutritional-information"],
  ["Avo Parmesan Crunch","Salads & Bowls",204,1080,259,10.5,7.1,20.6,"menu-item/avo-parmesan-crunch"],
  ["BBQ Chicken Ribs","Chicken For One",128,1240,297,29.6,4.4,18,"menu-item/ribs"],
  ["Double Cheese & Bacon","Burgers, Wraps & Pitas",327,2790,667,47.2,48.4,31.4,"menu-item/double-cheese-and-bacon"],
  ["Grain Salad","Sides",220,925,221,7.5,19.1,6.3,"menu-item/grain-salad"],
  ["Half PERi-PERi Chicken","Chicken For One",460,2990,715,108,1.1,30.8,"menu-item/half-chicken"],
  ["Halloumi Sticks & Dip","Sides",127,1510,360,17.6,14.7,25.5,"menu-item/halloumi-sticks-and-dip"],
  ["Mediterranean Salad","Salads & Bowls",365,1740,415,8.1,14.8,30.2,"menu-item/mediterranean-salad"],
  ["Mediterranean Salad with Chicken","Salads & Bowls",485,2430,581,37.8,15.3,35,"menu-item/mediterranean-salad-with-chicken"],
  ["Paella","Salads & Bowls",395,2330,557,31,81.9,10,"menu-item/paella"],
  ["PERi-Harvest Bowl","Salads & Bowls",382,1760,421,9.9,26.7,22.6,"menu-item/peri-harvest-bowl"],
  ["PERi-PERi Chips — Large PERi-PERi Chips","Sides",230,2230,533,8.9,73.3,21.2,"menu-item/peri-peri-chips"],
  ["PERi-PERi Chips — Regular PERi-PERi Chips","Sides",140,1360,326,5.4,44.7,13,"menu-item/peri-peri-chips"],
  ["PERi-PERi Chips — Seriously Large PERi-PERi Chips","Sides",400,3880,928,15.5,128,37,"menu-item/peri-peri-chips"],
  ["PERinaise Classic","Burgers, Wraps & Pitas",259,2070,496,41,42.5,16.9,"menu-item/perinaise-classic"],
  ["Roasted Broccoli with PERi-Crackle","Sides",175,1420,339,11.4,3.2,30.3,"menu-item/roasted-broccoli-peri-crackle"],
  ["Supremo","Burgers, Wraps & Pitas",332,2710,648,41.9,52.5,28.9,"menu-item/supremo"],
  ["The Great Pretender Protein","Burgers, Wraps & Pitas",120,1240,297,17.4,9.5,4.6,"menu-item/the-great-pretender-protein"],
  ["The Halloumi","Burgers, Wraps & Pitas",283,2510,599,40.1,53.9,24.7,"menu-item/halloumi"],
  ["Whole PERi-PERi Chicken","Chicken To Share",889,5780,1380,208,2.2,59.7,"menu-item/whole-chicken"],
] as const;
