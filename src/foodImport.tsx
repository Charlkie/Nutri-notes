import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, ChevronLeft, ImagePlus, LoaderCircle, Plus, ScanBarcode, Search, ShieldCheck, Store, Wifi } from "lucide-react";
import type { Food, FoodCategory, FoodSourceKind, FoodUnit, MacroNutrient } from "./domain/types";
import { openFoodFactsProductToDraft, parseNutritionLabelText, reviewedFood, type FoodDraft } from "./domain/foodImport";
import { db } from "./data/db";
import { EnergyText } from "./energyDisplay";
import { EnergyInput } from "./energyInput";
import { restaurantFoods,restaurantNames,searchRestaurantFoods } from "./domain/restaurantFoods";
import { fetchRestaurantFood, fetchRestaurantMenu, fetchRestaurantNames, restaurantApiConfigured, type RestaurantProviderItem } from "./domain/restaurantApi";

type Mode = "home" | "barcode" | "branded" | "restaurant" | "label" | "review";
const blank = (): FoodDraft => ({ name: "", categoryId: "other", calculationMode: "per100", baseQuantity: 100, baseUnit: "g", calories: 0, protein: 0, carbohydrates: 0, fat: 0 });
let zxingLoad: Promise<void> | undefined;
function loadZxing() {
  if (window.ZXing) return Promise.resolve();
  zxingLoad ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = new URL("./vendor/zxing.min.js", document.baseURI).toString();
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Offline barcode scanner could not load"));
    document.head.append(script);
  });
  return zxingLoad;
}

export function FoodImportTools({ categories, onClose, onSaved }: { categories: FoodCategory[]; onClose: () => void; onSaved: (food: Food) => void }) {
  const [mode, setMode] = useState<Mode>("home");
  const [draft, setDraft] = useState<FoodDraft>(blank);
  const [error, setError] = useState("");
  const review = (next: FoodDraft) => { setDraft(next); setError(""); setMode("review"); };
  return <main className="screen import-food-screen">
    <header className="modal-header"><button className="icon-button close" onClick={mode === "home" ? onClose : () => setMode("home")} aria-label={mode === "home" ? "Close" : "Back"}><ChevronLeft /></button><h1>{mode === "home" ? "Add Food" : mode === "review" ? "Review Food" : mode === "barcode" ? "Scan Barcode" : mode === "branded" ? "Branded Search" : mode === "restaurant" ? "Australian Fast Food" : "Import Label"}</h1><span /></header>
    {mode === "home" && <section className="import-methods">
      <p>Choose a source. Imported nutrition is never saved until you review it.</p>
      <button onClick={() => setMode("barcode")}><ScanBarcode/><span><strong>Scan a barcode</strong><small>Use the camera or enter the number</small></span></button>
      <button onClick={() => setMode("branded")}><Wifi/><span><strong>Search branded foods</strong><small>Optional Open Food Facts lookup</small></span></button>
      <button onClick={() => setMode("restaurant")}><Store/><span><strong>Australian fast food</strong><small>Australian restaurant menus · offline fallback</small></span></button>
      <button onClick={() => setMode("label")}><ImagePlus/><span><strong>Import a nutrition label</strong><small>Photo and on-device text recognition</small></span></button>
    </section>}
    {mode === "barcode" && <BarcodeImport onReview={review} />}
    {mode === "branded" && <BrandedSearch onReview={review} />}
    {mode === "restaurant" && <RestaurantSearch onReview={review} />}
    {mode === "label" && <LabelImport onReview={review} />}
    {mode === "review" && <ReviewFood draft={draft} categories={categories} error={error} onChange={setDraft} onError={setError} onSave={async () => { try { const food = reviewedFood(draft); await db.foods.put(food); onSaved(food); } catch (ex) { setError(ex instanceof Error ? ex.message : "Could not save food"); } }} />}
  </main>;
}

async function fetchBarcode(code: string): Promise<FoodDraft> {
  let response: Response;
  try {
    response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=code,product_name,product_name_en,brands,nutriments,serving_size,product_quantity_unit`);
  } catch {
    throw new Error("The branded-food service could not be reached. Check your connection and try again.");
  }
  if (response.status === 404)
    throw new Error("This barcode is not in Open Food Facts yet. Import the nutrition label or create the food manually.");
  if (!response.ok)
    throw new Error(`The branded-food service returned an error (${response.status}). Try again shortly.`);
  const data = await response.json() as { status?: number; product?: Record<string, unknown> };
  if (data.status !== 1 || !data.product)
    throw new Error("This barcode is not in Open Food Facts yet. Import the nutrition label or create the food manually.");
  return openFoodFactsProductToDraft(data.product, code);
}

function BarcodeImport({ onReview }: { onReview: (draft: FoodDraft) => void }) {
  const [code, setCode] = useState(""); const [detectedCode, setDetectedCode] = useState<string>(); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const video = useRef<HTMLVideoElement>(null); const handledDetection = useRef<string>();
  useEffect(() => { let stream: MediaStream | undefined; let reader: ZXingReader | undefined; let stopped = false; let timer = 0; const accept = (value: string) => { if (stopped) return; stopped = true; setCode(value); setDetectedCode(value); reader?.reset(); }; const Detector = window.BarcodeDetector; if (Detector) { void navigator.mediaDevices?.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }).then(value => { stream = value; if (video.current) { video.current.srcObject = value; void video.current.play(); } const detector = new Detector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] }); const scan = async () => { if (stopped || !video.current) return; try { const found = await detector.detect(video.current); if (found[0]?.rawValue) { accept(found[0].rawValue); return; } } catch { /* camera frames may not be ready */ } timer = window.setTimeout(scan, 350); }; timer = window.setTimeout(scan, 700); }).catch(() => setError("Camera access is unavailable. Enter the barcode below.")); } else { void loadZxing().then(() => { if (stopped || !video.current || !window.ZXing) return; reader = new window.ZXing.BrowserMultiFormatReader(); return reader.decodeFromVideoDevice(undefined, video.current, result => { const value = result?.getText(); if (value) accept(value); }); }).catch(() => setError("Camera scanning is unavailable. Enter the barcode below.")); } return () => { stopped = true; clearTimeout(timer); reader?.reset(); stream?.getTracks().forEach(track => track.stop()); }; }, []);
  useEffect(() => { if (!detectedCode || handledDetection.current === detectedCode) return; handledDetection.current = detectedCode; setBusy(true); setError(""); void fetchBarcode(detectedCode).then(onReview).catch(ex => { handledDetection.current = undefined; setDetectedCode(undefined); setError(ex instanceof Error ? ex.message : "Barcode lookup failed"); }).finally(() => setBusy(false)); }, [detectedCode, onReview]);
  const lookup = async () => { try { if (!/^\d{8,14}$/.test(code.trim())) throw new Error("Enter an 8–14 digit barcode"); setBusy(true); setError(""); onReview(await fetchBarcode(code.trim())); } catch (ex) { setError(ex instanceof Error ? ex.message : "Barcode lookup failed"); } finally { setBusy(false); } };
  return <section className="barcode-import"><div className="camera-frame"><video ref={video} muted playsInline aria-label="Barcode camera preview"/><span className="camera-guide"><Camera/>Hold barcode inside the frame</span></div><p className="privacy-note">Camera frames stay on this device. A detected barcode is looked up automatically and opens the review screen.</p>{busy&&<p className="barcode-detected" role="status"><LoaderCircle className="spin"/>Barcode detected · finding product…</p>}{error&&<p className="form-error" role="alert">{error}</p>}<label>Barcode<input inputMode="numeric" pattern="[0-9]*" value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,""))} placeholder="e.g. 9300000000000"/></label><button className="primary full" disabled={busy} onClick={()=>void lookup()}>{busy?<LoaderCircle className="spin"/>:<Search/>}Look up product</button></section>;
}

function BrandedSearch({ onReview }: { onReview: (draft: FoodDraft) => void }) {
  const [query,setQuery]=useState(""); const [results,setResults]=useState<Record<string,unknown>[]>([]); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  const search=async()=>{try{if(query.trim().length<2)throw new Error("Enter at least two characters");setBusy(true);setError("");const params=new URLSearchParams({search_terms:query.trim(),search_simple:"1",action:"process",json:"1",page_size:"20",fields:"code,product_name,product_name_en,brands,nutriments,serving_size,product_quantity_unit"});const response=await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params}`);if(!response.ok)throw new Error("The branded-food service could not be reached");const data=await response.json() as {products?:Record<string,unknown>[]};setResults((data.products??[]).filter(item=>item.product_name||item.product_name_en));}catch(ex){setError(ex instanceof Error?ex.message:"Search failed")}finally{setBusy(false)}};
  return <section className="branded-import"><p className="network-note"><Wifi/>Online community database. Always compare the result with the Australian package label.</p><form onSubmit={event=>{event.preventDefault();void search()}}><label className="search"><Search/><span className="sr-only">Search branded foods</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Brand or product name"/></label></form>{error&&<p className="form-error" role="alert">{error}</p>}{busy&&<div className="loading"><LoaderCircle className="spin"/>Searching…</div>}<div className="branded-results">{results.map((product,index)=>{const item=openFoodFactsProductToDraft(product,String(product.code??""));return <button key={`${product.code??index}`} onClick={()=>onReview(item)}><span><strong>{item.name}</strong><small>{item.brand||"Unknown brand"} · Community data</small></span><b><EnergyText calories={item.calories} /><small>per 100 {item.baseUnit}</small></b></button>})}</div></section>;
}

function RestaurantSearch({ onReview }: { onReview: (draft: FoodDraft) => void }) {
  const [query, setQuery] = useState("");
  const [restaurant,setRestaurant]=useState<string>();
  const [restaurants,setRestaurants]=useState(restaurantNames);
  const [providerAvailable,setProviderAvailable]=useState(false);
  const [providerResults,setProviderResults]=useState<RestaurantProviderItem[]>([]);
  const [page,setPage]=useState(0);
  const [hasMore,setHasMore]=useState(false);
  const [busy,setBusy]=useState(false);
  const [openingId,setOpeningId]=useState<string>();
  const [error,setError]=useState("");
  const localResults = useMemo(() => restaurant?searchRestaurantFoods(query,restaurant):[], [query,restaurant]);
  useEffect(()=>{
    if(!restaurantApiConfigured())return;
    const controller=new AbortController();
    void fetchRestaurantNames(controller.signal).then(names=>{
      setRestaurants([...new Set([...names,...restaurantNames])]);
      setProviderAvailable(true);
    }).catch(ex=>setError(ex instanceof Error?ex.message:"Restaurant service unavailable"));
    return()=>controller.abort();
  },[]);
  useEffect(()=>{
    if(!restaurant||!providerAvailable){setProviderResults([]);setHasMore(false);return;}
    const controller=new AbortController();
    const timer=window.setTimeout(()=>{
      setBusy(true);setError("");setPage(0);
      void fetchRestaurantMenu(restaurant,query,0,controller.signal).then(result=>{setProviderResults(result.items);setHasMore(result.hasMore)}).catch(ex=>{if(!controller.signal.aborted)setError(ex instanceof Error?ex.message:"Restaurant search failed")}).finally(()=>{if(!controller.signal.aborted)setBusy(false)});
    },query?300:0);
    return()=>{clearTimeout(timer);controller.abort()};
  },[restaurant,query,providerAvailable]);
  const loadMore=async()=>{if(!restaurant||busy)return;try{setBusy(true);setError("");const next=page+1;const result=await fetchRestaurantMenu(restaurant,query,next);setProviderResults(current=>[...current,...result.items.filter(item=>!current.some(existing=>existing.id===item.id))]);setPage(next);setHasMore(result.hasMore)}catch(ex){setError(ex instanceof Error?ex.message:"Restaurant search failed")}finally{setBusy(false)}};
  const openProviderFood=async(item:RestaurantProviderItem)=>{try{setOpeningId(item.id);setError("");onReview(await fetchRestaurantFood(item.id))}catch(ex){setError(ex instanceof Error?ex.message:"Could not load menu item")}finally{setOpeningId(undefined)}};
  const addOfficialEnergy=()=>{if(!restaurant)return;onReview({name:"",brand:restaurant,categoryId:"other",calculationMode:"perServing",baseQuantity:1,baseUnit:"serving",calories:0,protein:0,carbohydrates:0,fat:0,unavailableNutrients:["protein","carbohydrates","fat","fibre"],servingDescription:"1 menu item",notes:"Energy transcribed from the restaurant's Australian menu. Macros were not published and are intentionally marked unavailable.",source:{kind:"restaurant",provider:`${restaurant} Australian menu labelling`,datasetVersion:"User-verified current menu",importedAt:new Date().toISOString()}})};
  return <section className="restaurant-import">
    <p className="restaurant-note"><Store/><span><strong>{providerAvailable?"Australian restaurant database":"Offline starter catalogue"}</strong><small>{providerAvailable?"Live Australian results. Review every item before saving.":"The live provider is unavailable; saved and bundled foods still work."}</small></span></p>
    {error&&<p className="form-error" role="alert">{error}</p>}
    {!restaurant?<><h2 className="restaurant-prompt">Choose a restaurant</h2><div className="restaurant-picker">{restaurants.map(name=><button key={name} onClick={()=>{setRestaurant(name);setQuery("");setError("")}}><Store/><span><strong>{name}</strong><small>{providerAvailable?"Search Australian menu":restaurantFoods.some(food=>food.restaurant===name)?`${restaurantFoods.filter(food=>food.restaurant===name).length} menu items · offline`:"Add from official menu kJ"}</small></span></button>)}</div></>:<><button className="restaurant-change" onClick={()=>{setRestaurant(undefined);setQuery("");setError("")}}><ChevronLeft/>All restaurants <b>{restaurant}</b></button><label className="restaurant-search"><Search/><span className="sr-only">Search {restaurant} menu</span><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder={`Search ${restaurant} menu`}/></label>{busy&&!providerResults.length&&<div className="loading"><LoaderCircle className="spin"/>Searching {restaurant}…</div>}<div className="restaurant-results">{providerAvailable?providerResults.map(item=><button key={item.id} disabled={openingId===item.id} onClick={()=>void openProviderFood(item)}><span><strong>{item.name}</strong><small>{item.restaurant}{item.description?` · ${item.description}`:""}</small></span>{openingId===item.id?<LoaderCircle className="spin"/>:<ChevronLeft className="result-chevron"/>}</button>):localResults.map(item=><button key={`${item.restaurant}-${item.name}`} onClick={()=>{const {restaurant:_,servingGrams:__,...draft}=item;onReview(draft)}}><span><strong>{item.name}</strong><small>{item.restaurant}{item.servingGrams?` · ${item.servingGrams} g serve`:" · per serve"}</small></span><b><EnergyText calories={item.calories}/><small>P {item.unavailableNutrients?.includes("protein")?"—":item.protein} · C {item.unavailableNutrients?.includes("carbohydrates")?"—":item.carbohydrates} · F {item.unavailableNutrients?.includes("fat")?"—":item.fat}</small></b></button>)}</div>{providerAvailable&&hasMore&&<button className="restaurant-load-more" disabled={busy} onClick={()=>void loadMore()}>{busy?<LoaderCircle className="spin"/>:null}Load more menu items</button>}{!(providerAvailable?providerResults:localResults).length&&!busy&&<><p className="restaurant-empty">No verified bundled item is available. Copy the kJ value from {restaurant}'s current Australian menu.</p><button className="primary full restaurant-energy-entry" onClick={addOfficialEnergy}><Plus/>Add from official menu kJ</button></>}</>}
  </section>;
}

function LabelImport({ onReview }: { onReview: (draft: FoodDraft) => void }) {
  const [image,setImage]=useState<string>(); const [text,setText]=useState(""); const [busy,setBusy]=useState(false); const [message,setMessage]=useState("");
  const choose=async(file?:File)=>{if(!file)return;setImage(URL.createObjectURL(file));setBusy(true);setMessage("");try{if(window.TextDetector){const bitmap=await createImageBitmap(file);const blocks=await new window.TextDetector().detect(bitmap);const detected=blocks.map(block=>block.rawValue).join("\n");setText(detected);setMessage("Text detected on this device. Check it before continuing.");}else setMessage("Automatic text recognition is unavailable here. Use iPhone Live Text to copy the panel into the box, or enter the values during review.");}catch{setMessage("The label could not be read automatically. You can paste its text or review the values manually.");}finally{setBusy(false)}};
  const proceed=()=>{const values=parseNutritionLabelText(text);onReview({...blank(),...values,servingDescription:values.servingDescription,source:{kind:"nutrition-label",provider:"Package nutrition information panel",importedAt:new Date().toISOString()},notes:"Imported from a nutrition-label photo — manually reviewed before saving."})};
  return <section className="label-import"><label className="photo-picker"><ImagePlus/><strong>Photograph or choose label</strong><small>Centre the nutrition information panel and avoid glare.</small><input type="file" accept="image/*" capture="environment" onChange={event=>void choose(event.target.files?.[0])}/></label>{image&&<img src={image} alt="Selected nutrition label"/>}{busy&&<div className="loading"><LoaderCircle className="spin"/>Reading label on this device…</div>}{message&&<p className="privacy-note">{message}</p>}<label>Detected or pasted label text<textarea rows={9} value={text} onChange={event=>setText(event.target.value)} placeholder="Paste text copied with iPhone Live Text, if needed"/></label><button className="primary full" onClick={proceed}>Review extracted values</button></section>;
}

function ReviewFood({draft,categories,error,onChange,onError,onSave}:{draft:FoodDraft;categories:FoodCategory[];error:string;onChange:(draft:FoodDraft)=>void;onError:(value:string)=>void;onSave:()=>void}) {
  const [confirmed,setConfirmed]=useState(false); const set=(key:keyof FoodDraft,value:unknown)=>onChange({...draft,[key]:value}); const provenance=sourceLabel(draft.source?.kind);
  const setMacro=(key:MacroNutrient,value:string)=>{const unavailable=new Set(draft.unavailableNutrients??[]);if(value===""){unavailable.add(key);onChange({...draft,[key]:0,unavailableNutrients:[...unavailable]})}else{unavailable.delete(key);onChange({...draft,[key]:Number(value),unavailableNutrients:unavailable.size?[...unavailable]:undefined})}};
  const nums=useMemo(()=>[draft.baseQuantity,draft.calories,draft.protein,draft.carbohydrates,draft.fat,draft.fibre].filter(value=>value!==undefined),[draft]); const invalid=nums.some(value=>typeof value!=="number"||!Number.isFinite(value)||value<0)||draft.baseQuantity<=0||!draft.name.trim();
  return <section className="review-food"><div className="review-source"><ShieldCheck/><span><strong>{provenance}</strong><small>{draft.source?.datasetVersion||"Imported food"}{draft.barcode?` · ${draft.barcode}`:""}</small></span></div>{error&&<p className="form-error" role="alert">{error}</p>}<label>Food name<input value={draft.name} onChange={event=>set("name",event.target.value)}/></label><label>Brand (optional)<input value={draft.brand??""} onChange={event=>set("brand",event.target.value||undefined)}/></label><label>Category<select value={draft.categoryId} onChange={event=>set("categoryId",event.target.value)}>{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></label><div className="review-basis"><label>Basis<select value={draft.calculationMode} onChange={event=>set("calculationMode",event.target.value)}><option value="per100">By weight / volume</option><option value="perServing">Per serving</option></select></label><label>Quantity<input type="number" min="0.01" step="any" value={draft.baseQuantity} onChange={event=>set("baseQuantity",Number(event.target.value))}/></label><label>Unit<select value={draft.baseUnit} onChange={event=>set("baseUnit",event.target.value as FoodUnit)}><option value="g">g</option><option value="ml">mL</option><option value="serving">serving</option><option value="item">item</option><option value="slice">slice</option><option value="scoop">scoop</option></select></label></div><div className="review-nutrients"><label>Energy<EnergyInput calories={draft.calories} onCaloriesChange={value=>set("calories",value)}/></label>{([['protein','Protein (g)'],['carbohydrates','Carbs (g)'],['fat','Fat (g)'],['fibre','Fibre (g)']] as const).map(([key,label])=><label key={key}>{label}<input type="number" min="0" step="any" inputMode="decimal" placeholder={draft.unavailableNutrients?.includes(key)?"Not published":"0"} value={draft.unavailableNutrients?.includes(key)?"":draft[key]??""} onChange={event=>setMacro(key,event.target.value)}/></label>)}</div>{draft.unavailableNutrients?.length?<p className="privacy-note">Blank nutrients were not published by the source and will appear as unavailable—not zero—in your log.</p>:null}<label className="manual-check"><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/><span><strong>I checked these values</strong><small>I compared the basis and nutrients with the source or package label.</small></span><Check/></label><button className="primary full" disabled={!confirmed||invalid} onClick={()=>{onError("");onSave()}}>Save verified food</button></section>;
}

function sourceLabel(kind?:FoodSourceKind){if(kind==="open-food-facts")return "Open Food Facts · community";if(kind==="nutrition-label")return "Nutrition label photo";if(kind==="fsanz")return "FSANZ · Australian official data";if(kind==="restaurant")return "Australian restaurant menu";return "Imported food"}
