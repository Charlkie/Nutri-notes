import { lazy, Suspense, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, Check, Copy, GripVertical, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { addRecipeToDay, db, id, saveRecipe, updateLoggedRecipeEntry } from "./data/db";
import { recipeIngredientsFromLogged, recipeSnapshot, scaleLoggedRecipe } from "./domain/recipes";
import { createSnapshot, roundMacro } from "./domain/nutrition";
import { EnergyText } from "./energyDisplay";
import type { DayFoodEntry, Food, FoodCategory, FoodUnit, ISODate, LoggedRecipe, LoggedRecipeIngredient, Recipe, RecipeIngredient } from "./domain/types";
const RecipeImport=lazy(()=>import("./recipeImport").then(module=>({default:module.RecipeImport})));
export function RecipePanel({ date, foods, categories, onLogged }: {
    date: ISODate;
    foods: Food[];
    categories: FoodCategory[];
    onLogged: (message: string) => void;
}) {
    const recipes = useLiveQuery(() => db.recipes.orderBy("name").toArray(), []) ?? [];
    const [editing, setEditing] = useState<Recipe | "new">();
    const [logging, setLogging] = useState<Recipe>();
    const [servings, setServings] = useState("1");
    const [error, setError] = useState("");
    const [importing, setImporting] = useState(false);
    if (importing)
        return <Suspense fallback={<div className="loading import-loading">Loading importer…</div>}><RecipeImport foods={foods} categories={categories} onClose={() => setImporting(false)} onSaved={recipe => { setImporting(false); setEditing(recipe); }}/></Suspense>;
    if (editing)
        return <RecipeBuilder recipe={editing === "new" ? undefined : editing} foods={foods} categories={categories} onClose={() => setEditing(undefined)}/>;
    const log = async () => { try {
        const count = Number(servings);
        if (!Number.isFinite(count) || count <= 0)
            throw new Error("Servings must be greater than zero");
        if (!logging)
            return;
        await addRecipeToDay(date, logging, foods, count);
        onLogged(`Logged ${count} serving${count === 1 ? "" : "s"} of “${logging.name}”`);
    }
    catch (ex) {
        setError(ex instanceof Error ? ex.message : "Could not log recipe");
    } };
    return <section className="recipe-panel">
      <div className="recipe-panel-heading"><div><strong>Recipes & meal combos</strong><small>Saved ingredient sets with per-day adjustments.</small></div><div className="recipe-heading-actions"><button onClick={()=>setImporting(true)}>Import</button><button onClick={()=>setEditing("new")}><Plus />New</button></div></div>
      {recipes.map(recipe=>{const names=recipe.ingredients.map(item=>foods.find(food=>food.id===item.foodId)?.name).filter(Boolean);return <article className="recipe-row" key={recipe.id}><button className="recipe-edit" onClick={()=>setEditing(recipe)}><span><strong>{recipe.name}</strong><small>{recipe.yieldServings} serving yield · {names.slice(0,3).join(", ")}{names.length>3?` +${names.length-3}`:""}</small></span><Pencil /></button><button className="recipe-log" onClick={()=>{setLogging(recipe);setServings("1");setError("")}}>Log</button></article>})}
      {!recipes.length&&<div className="recipe-empty"><h2>Build your first recipe</h2><p>Combine saved foods into a meal, or import a recipe from pasted text.</p><button className="primary" onClick={()=>setEditing("new")}><Plus />Create recipe</button><button onClick={()=>setImporting(true)}>Import pasted recipe</button></div>}
      {logging&&<div className="dialog-backdrop"><div className="dialog recipe-log-dialog" role="dialog" aria-modal="true"><h2>Log {logging.name}</h2><p>This recipe makes {logging.yieldServings} servings. Ingredient quantities will scale to what you log.</p>{error&&<p className="form-error" role="alert">{error}</p>}<label>Servings<input type="number" min="0.1" step="0.1" inputMode="decimal" value={servings} onChange={e=>setServings(e.target.value)} autoFocus/></label><div><button onClick={()=>setLogging(undefined)}>Cancel</button><button className="primary" onClick={()=>void log()}>Log recipe</button></div></div></div>}
    </section>;
}
function RecipeIngredientPicker({categories,excludedIds,onClose,onSelected,onCustom}:{categories:FoodCategory[];excludedIds:string[];onClose:()=>void;onSelected:(food:Food)=>void;onCustom:()=>void}) {
  const foods=useLiveQuery(()=>db.foods.toArray(),[])??[];
  const catalogFoods=useLiveQuery(()=>db.catalogFoods.toArray(),[])??[];
  const [query,setQuery]=useState("");
  const [category,setCategory]=useState<string>();
  const excluded=new Set(excludedIds);
  const savedIds=new Set(foods.map(food=>food.id));
  const visible=useMemo(()=>[...foods,...(query.trim().length>=2?catalogFoods.filter(food=>!savedIds.has(food.id)):[])].filter(food=>!excluded.has(food.id)&&(!category||food.categoryId===category)&&`${food.name} ${food.brand??""} ${food.notes??""} ${categories.find(item=>item.id===food.categoryId)?.name??""}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>(b.lastLoggedAt??"").localeCompare(a.lastLoggedAt??"")||b.logCount-a.logCount||a.name.localeCompare(b.name)),[foods,catalogFoods,query,category,categories,excludedIds.join("|")]);
  const choose=async(food:Food)=>{if(!savedIds.has(food.id))await db.foods.put(food);onSelected(food)};
  return <main className="screen picker-screen recipe-ingredient-picker">
    <header className="modal-header"><button className="icon-button close" onClick={onClose} aria-label="Close ingredient picker"><X/></button><h1>Choose Ingredient</h1><button className="icon-button add" onClick={onCustom} aria-label="Add custom ingredient food"><Plus/></button></header>
    <label className="search"><Search/><span className="sr-only">Search foods</span><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Food name, brand or category"/></label>
    <div className="chips" role="group" aria-label="Filter by category"><button className={!category?"selected":""} onClick={()=>setCategory(undefined)}>All</button>{categories.map(item=><button key={item.id} className={category===item.id?"selected":""} onClick={()=>setCategory(category===item.id?undefined:item.id)}><i style={{background:item.colour}}/>{item.name}</button>)}</div>
    <div className="picker-meta"><span>{visible.length} foods</span><span>{query.trim().length<2?"Type 2+ letters to search FSANZ":"Local · FSANZ · A–Z"}</span></div>
    <section className="food-list">{visible.map(food=>{const cat=categories.find(item=>item.id===food.categoryId);return <div className="food-row recipe-food-choice" key={food.id}><button className="food-select" onClick={()=>void choose(food)}><i style={{background:cat?.colour}}/><span><strong>{food.name}</strong><small>{food.brand?`${food.brand} · `:""}{food.source?.kind==="fsanz"?`FSANZ ${food.source.datasetVersion}`:food.logCount?`${food.logCount} logs`:"Never logged"}</small></span><b>{food.calculationMode==="per100"?`100 ${food.baseUnit}`:food.servingDescription??`1 ${food.baseUnit}`}<small><EnergyText calories={food.calories}/></small></b></button></div>})}{!visible.length&&<p className="no-results">No matching unused foods.</p>}</section>
    <button className="floating-add" onClick={onCustom}><Plus/>Custom food</button>
  </main>;
}
function RecipeBuilder({ recipe, foods, categories, onClose }: {
    recipe?: Recipe;
    foods: Food[];
    categories: FoodCategory[];
    onClose: () => void;
}) {
    const [name, setName] = useState(recipe?.name ?? "");
    const [categoryId, setCategoryId] = useState(recipe?.categoryId ?? categories[0]?.id ?? "other");
    const [yieldServings, setYieldServings] = useState(String(recipe?.yieldServings ?? 1));
    const [notes, setNotes] = useState(recipe?.notes ?? "");
    const [instructions, setInstructions] = useState((recipe?.instructions ?? []).join("\n"));
    const [ingredients, setIngredients] = useState(recipe?.ingredients ?? []);
    const [selectedId,setSelectedId]=useState<string>();
    const [choosingFood, setChoosingFood] = useState(false);
    const [error, setError] = useState("");
    const [customFood, setCustomFood] = useState(false);
    const sensors=useSensors(useSensor(TouchSensor,{activationConstraint:{delay:380,tolerance:8}}),useSensor(PointerSensor,{activationConstraint:{delay:350,tolerance:6}}),useSensor(KeyboardSensor,{coordinateGetter:sortableKeyboardCoordinates}));
    const dragEnd=({active,over}:DragEndEvent)=>{if(!over||active.id===over.id)return;setIngredients(current=>{const from=current.findIndex(item=>item.id===active.id);const to=current.findIndex(item=>item.id===over.id);return from<0||to<0?current:arrayMove(current,from,to)})};
    const moveSelected=(offset:-1|1)=>setIngredients(current=>{const from=current.findIndex(item=>item.id===selectedId);const to=from+offset;return from<0||to<0||to>=current.length?current:arrayMove(current,from,to)});
    const addIngredient = (food: Food) => { setIngredients(current => [...current, { id: id(), foodId: food.id, quantity: food.baseQuantity, sortIndex: current.length }]); };
    const save = async () => { try {
        const servings = Number(yieldServings);
        if (!name.trim())
            throw new Error("Recipe name is required");
        if (!Number.isFinite(servings) || servings <= 0)
            throw new Error("Yield must be greater than zero");
        if (!ingredients.length)
            throw new Error("Add at least one ingredient");
        if (ingredients.some(item => !Number.isFinite(item.quantity) || item.quantity <= 0))
            throw new Error("Ingredient quantities must be greater than zero");
        const now = new Date().toISOString();
        const steps = instructions.split("\n").map(step => step.trim()).filter(Boolean);
        await saveRecipe({ id: recipe?.id ?? id(), name: name.trim(), categoryId, yieldServings: servings, ingredients: ingredients.map((item, sortIndex) => ({ ...item, group: item.group?.trim() || undefined, sortIndex })), instructions: steps.length ? steps : undefined, notes: notes.trim() || undefined, createdAt: recipe?.createdAt ?? now, updatedAt: now });
        onClose();
    }
    catch (ex) {
        setError(ex instanceof Error ? ex.message : "Could not save recipe");
    } };
    const duplicate = async () => { if (!recipe)
        return; const now = new Date().toISOString(); await db.recipes.add({ ...recipe, id: id(), name: `${recipe.name} Copy`, ingredients: recipe.ingredients.map((item, sortIndex) => ({ ...item, id: id(), sortIndex })), instructions: recipe.instructions ? [...recipe.instructions] : undefined, createdAt: now, updatedAt: now }); onClose(); };
    if (choosingFood) return <><RecipeIngredientPicker categories={categories} excludedIds={ingredients.map(item=>item.foodId)} onClose={()=>setChoosingFood(false)} onSelected={food=>{addIngredient(food);setChoosingFood(false)}} onCustom={()=>setCustomFood(true)}/>{customFood&&<InlineFoodDialog categories={categories} onClose={()=>setCustomFood(false)} onCreated={food=>{addIngredient(food);setCustomFood(false);setChoosingFood(false)}}/>}</>;
    return <section className="recipe-builder">
      <header><button onClick={onClose} aria-label="Back to recipes"><X /></button><div><strong>{recipe ? "Edit recipe" : "New recipe"}</strong><small>Nutrition is calculated from ingredients.</small></div><button onClick={() => void save()} aria-label="Save recipe"><Check /></button></header>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="recipe-fields"><label>Recipe name<input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Spaghetti bolognese"/></label><div><label>Category<select value={categoryId} onChange={e => setCategoryId(e.target.value)}>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Recipe yield<input type="number" min="0.1" step="0.1" inputMode="decimal" value={yieldServings} onChange={e => setYieldServings(e.target.value)}/><small>servings</small></label></div></div>
      <div className="ingredient-heading"><strong>Ingredients</strong><span>{ingredients.length}</span></div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={({active})=>setSelectedId(String(active.id))} onDragEnd={dragEnd}><SortableContext items={ingredients.map(item=>item.id)} strategy={verticalListSortingStrategy}><div className="recipe-ingredients">{ingredients.map((item,index)=>{const food=foods.find(candidate=>candidate.id===item.foodId);return <SavedIngredientRow key={item.id} item={item} food={food} editing={selectedId!==undefined} selected={selectedId===item.id} categoryColour={categories.find(category=>category.id===food?.categoryId)?.colour} onSelect={()=>setSelectedId(item.id)} onQuantity={value=>setIngredients(current=>current.map((ingredient,i)=>i===index?{...ingredient,quantity:value}:ingredient))} onGroup={group=>setIngredients(current=>current.map((ingredient,i)=>i===index?{...ingredient,group}:ingredient))}/>})}</div></SortableContext></DndContext>
      <button className="add-another recipe-add-ingredient" onClick={()=>setChoosingFood(true)}><Plus />Add ingredient</button>
      <label className="recipe-instructions">Preparation steps <small>One step per line</small><textarea rows={4} value={instructions} onChange={e=>setInstructions(e.target.value)} placeholder={"Cook the pasta.\nPrepare the sauce.\nCombine and serve."}/></label>
      <label className="recipe-notes">Notes (optional)<textarea rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Substitutions, storage, or serving notes"/></label>
      {recipe&&<div className="recipe-record-actions"><button onClick={()=>void duplicate()}><Copy />Duplicate recipe</button><button className="danger" onClick={async()=>{await db.recipes.delete(recipe.id);onClose()}}><Trash2 />Delete recipe</button></div>}
      {customFood&&<InlineFoodDialog categories={categories} onClose={()=>setCustomFood(false)} onCreated={food=>{addIngredient(food);setCustomFood(false)}}/>}
      {selectedId&&<IngredientEditToolbar index={ingredients.findIndex(item=>item.id===selectedId)} count={ingredients.length} onDone={()=>setSelectedId(undefined)} onMove={moveSelected} onDelete={()=>{setIngredients(current=>current.filter(item=>item.id!==selectedId));setSelectedId(undefined)}}/>}
    </section>;
}

function SavedIngredientRow({item,food,categoryColour,editing,selected,onSelect,onQuantity,onGroup}:{item:RecipeIngredient;food?:Food;categoryColour?:string;editing:boolean;selected:boolean;onSelect:()=>void;onQuantity:(value:number)=>void;onGroup:(value:string)=>void}) {
  const {attributes,listeners,setNodeRef,transform,transition,isDragging}=useSortable({id:item.id});
  const cardActivation=editing?{}:listeners;
  return <div ref={setNodeRef} onClick={editing?onSelect:undefined} {...cardActivation} className={`ingredient-card ${editing?"editing":""} ${selected?"selected":""} ${isDragging?"ingredient-dragging":""}`} style={{"--cat":categoryColour,transform:CSS.Transform.toString(transform),transition} as React.CSSProperties}>
    <span><strong>{food?.name??"Missing food"}</strong><small>{food?.calculationMode==="per100"?`per 100 ${food.baseUnit}`:food?.servingDescription??food?.baseUnit}</small></span>
    <label><span className="sr-only">Quantity for {food?.name}</span><input type="number" min="0.01" step="any" inputMode="decimal" value={item.quantity} onChange={e=>onQuantity(Number(e.target.value))}/><small>{food?.baseUnit}</small></label>
    <label className="ingredient-group"><span className="sr-only">Group for {food?.name}</span><input value={item.group??""} onChange={e=>onGroup(e.target.value)} placeholder="Group (optional), e.g. Sauce"/></label>
    {editing&&<div className="ingredient-drag-actions"><button className="ingredient-grip" aria-label={`Reorder ${food?.name??"ingredient"}`} {...attributes} {...listeners}><GripVertical/></button></div>}
  </div>;
}

function LoggedIngredientRow({ingredient,categoryColour,editing,selected,onSelect,onToggle,onQuantity}:{ingredient:LoggedRecipeIngredient;categoryColour?:string;editing:boolean;selected:boolean;onSelect:()=>void;onToggle:(value:boolean)=>void;onQuantity:(value:number)=>void}) {
  const {attributes,listeners,setNodeRef,transform,transition,isDragging}=useSortable({id:ingredient.id});
  const cardActivation=editing?{}:listeners;
  return <div ref={setNodeRef} onClick={editing?onSelect:undefined} {...cardActivation} className={`ingredient-card ${editing?"editing":""} ${ingredient.enabled?"":"disabled"} ${selected?"selected":""} ${isDragging?"ingredient-dragging":""}`} style={{"--cat":categoryColour,transform:CSS.Transform.toString(transform),transition} as React.CSSProperties}>
    <input type="checkbox" aria-label={`Include ${ingredient.snapshot.name}`} checked={ingredient.enabled} onChange={e=>onToggle(e.target.checked)}/>
    <span><strong>{ingredient.snapshot.name}</strong><small>{ingredient.group&&<b className="instance-group">{ingredient.group} · </b>}<EnergyText calories={ingredient.snapshot.calories} /></small></span>
    <span className="instance-quantity"><input aria-label={`Quantity for ${ingredient.snapshot.name}`} type="number" min="0.01" step="any" inputMode="decimal" value={ingredient.snapshot.quantity} onChange={e=>onQuantity(Number(e.target.value))}/><small>{ingredient.snapshot.unit}</small></span>
    {editing&&<div className="ingredient-drag-actions"><button className="ingredient-grip" aria-label={`Reorder ${ingredient.snapshot.name}`} {...attributes} {...listeners}><GripVertical/></button></div>}
  </div>;
}

function IngredientEditToolbar({index,count,onDone,onMove,onDelete}:{index:number;count:number;onDone:()=>void;onMove:(offset:-1|1)=>void;onDelete:()=>void}) {
  return <div className="edit-toolbar recipe-ingredient-toolbar" aria-label="Edit selected ingredient"><button onClick={onDone}><Check/><span>Done</span></button><button onClick={()=>onMove(-1)} disabled={index<=0}><ArrowUp/><span>Move up</span></button><button onClick={()=>onMove(1)} disabled={index<0||index>=count-1}><ArrowDown/><span>Move down</span></button><button onClick={onDelete}><Trash2/><span>Delete</span></button></div>;
}

function InlineFoodDialog({ categories, onClose, onCreated }: {
    categories: FoodCategory[];
    onClose: () => void;
    onCreated: (food: Food) => void;
}) { const [name, setName] = useState(""); const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "other"); const [unit, setUnit] = useState<FoodUnit>("g"); const [calories, setCalories] = useState(""); const [protein, setProtein] = useState(""); const [carbs, setCarbs] = useState(""); const [fat, setFat] = useState(""); const [error, setError] = useState(""); const save = async () => { try {
    const values = [Number(calories), Number(protein), Number(carbs), Number(fat)];
    if (!name.trim())
        throw new Error("Food name is required");
    if (values.some(value => !Number.isFinite(value) || value < 0))
        throw new Error("Nutrition values must be valid and non-negative");
    const now = new Date().toISOString();
    const food: Food = { id: id(), name: name.trim(), categoryId, calculationMode: "per100", baseQuantity: 100, baseUnit: unit, calories: values[0]!, protein: values[1]!, carbohydrates: values[2]!, fat: values[3]!, notes: "Created while building a recipe — verify against your source.", logCount: 0, createdAt: now, updatedAt: now };
    await db.foods.add(food);
    onCreated(food);
}
catch (ex) {
    setError(ex instanceof Error ? ex.message : "Could not create food");
} }; return <div className="dialog-backdrop"><div className="dialog inline-food-dialog"><h2>New ingredient food</h2><p>Enter nutrition per 100 g or mL. You can edit the full food record later.</p>{error && <p className="form-error" role="alert">{error}</p>}<label>Name<input value={name} onChange={e => setName(e.target.value)} autoFocus/></label><div className="inline-food-grid"><label>Category<select value={categoryId} onChange={e => setCategoryId(e.target.value)}>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Unit<select value={unit} onChange={e => setUnit(e.target.value as FoodUnit)}><option value="g">grams</option><option value="ml">millilitres</option></select></label></div><div className="inline-food-grid"><label>Calories<input type="number" min="0" inputMode="decimal" value={calories} onChange={e => setCalories(e.target.value)}/></label><label>Protein (g)<input type="number" min="0" inputMode="decimal" value={protein} onChange={e => setProtein(e.target.value)}/></label><label>Carbs (g)<input type="number" min="0" inputMode="decimal" value={carbs} onChange={e => setCarbs(e.target.value)}/></label><label>Fat (g)<input type="number" min="0" inputMode="decimal" value={fat} onChange={e => setFat(e.target.value)}/></label></div><div><button onClick={onClose}>Cancel</button><button className="primary" onClick={() => void save()}>Create & add</button></div></div></div>; }
export function RecipeEntryEditor({ entry, onClose, onSaved, onDelete }: {
    entry: DayFoodEntry;
    onClose: () => void;
    onSaved: () => void;
    onDelete: (entry: DayFoodEntry) => void;
}) {
    const saved = useLiveQuery(() => entry.recipe ? db.recipes.get(entry.recipe.recipeId) : undefined, [entry.recipe?.recipeId]);
    const categories = useLiveQuery(() => db.categories.orderBy("sortIndex").toArray(), []) ?? [];
    const [logged, setLogged] = useState<LoggedRecipe>(() => structuredClone(entry.recipe!));
    const [consumed, setConsumed] = useState(entry.consumed);
    const [error, setError] = useState("");
    const [adding, setAdding] = useState(false);
    const [customFood, setCustomFood] = useState(false);
    const [servings, setServings] = useState(String(entry.recipe!.loggedServings));
    const [saveOptions, setSaveOptions] = useState(false);
    const [newRecipeName, setNewRecipeName] = useState(`${entry.snapshot.name} Copy`);
    const [selectedId,setSelectedId]=useState<string>();
    const sensors=useSensors(useSensor(TouchSensor,{activationConstraint:{delay:380,tolerance:8}}),useSensor(PointerSensor,{activationConstraint:{delay:350,tolerance:6}}),useSensor(KeyboardSensor,{coordinateGetter:sortableKeyboardCoordinates}));
    const dragEnd=({active,over}:DragEndEvent)=>{if(!over||active.id===over.id)return;setLogged(current=>{const from=current.ingredients.findIndex(item=>item.id===active.id);const to=current.ingredients.findIndex(item=>item.id===over.id);return from<0||to<0?current:{...current,ingredients:arrayMove(current.ingredients,from,to)}})};
    const moveSelected=(offset:-1|1)=>setLogged(current=>{const from=current.ingredients.findIndex(item=>item.id===selectedId);const to=from+offset;return from<0||to<0||to>=current.ingredients.length?current:{...current,ingredients:arrayMove(current.ingredients,from,to)}});
    const categoryId = saved?.categoryId ?? entry.snapshot.categoryId;
    const recipeInfo = { id: logged.recipeId, name: saved?.name ?? entry.snapshot.name, categoryId };
    const updateQuantity = (index: number, value: number) => setLogged(current => ({ ...current, ingredients: current.ingredients.map((ingredient, i) => { if (i !== index)
            return ingredient; const factor = value / ingredient.snapshot.quantity; return { ...ingredient, snapshot: { ...ingredient.snapshot, quantity: value, calories: ingredient.snapshot.calories * factor, protein: ingredient.snapshot.protein * factor, carbohydrates: ingredient.snapshot.carbohydrates * factor, fat: ingredient.snapshot.fat * factor, fibre: ingredient.snapshot.fibre === undefined ? undefined : ingredient.snapshot.fibre * factor } }; }) }));
    const addFood = (food: Food) => { setLogged(current => ({ ...current, ingredients: [...current.ingredients, { id: id(), enabled: true, snapshot: createSnapshot(food, food.baseQuantity) }] })); setAdding(false); };
    const preview = recipeSnapshot(recipeInfo, logged);
    const validate = () => { if (!logged.ingredients.length)
        throw new Error("Keep at least one ingredient"); if (logged.ingredients.some(ingredient => !Number.isFinite(ingredient.snapshot.quantity) || ingredient.snapshot.quantity <= 0))
        throw new Error("Ingredient quantities must be greater than zero"); };
    const saveMeal = async () => { validate(); await updateLoggedRecipeEntry({ ...entry, recipe: logged, consumed }, recipeInfo); };
    const finish = async (mode: "meal" | "update" | "copy") => { try {
        await saveMeal();
        if (mode === "update") {
            if (!saved)
                throw new Error("The original recipe no longer exists");
            await db.recipes.put({ ...saved, ingredients: recipeIngredientsFromLogged(logged, saved.yieldServings), instructions: logged.instructions ? [...logged.instructions] : undefined, updatedAt: new Date().toISOString() });
        }
        if (mode === "copy") {
            if (!newRecipeName.trim())
                throw new Error("New recipe name is required");
            const now = new Date().toISOString();
            await db.recipes.add({ id: id(), name: newRecipeName.trim(), categoryId: recipeInfo.categoryId, yieldServings: logged.loggedServings, ingredients: recipeIngredientsFromLogged(logged, logged.loggedServings), instructions: logged.instructions ? [...logged.instructions] : undefined, createdAt: now, updatedAt: now });
        }
        onSaved();
    }
    catch (ex) {
        setSaveOptions(false);
        setError(ex instanceof Error ? ex.message : "Could not save recipe entry");
    } };
    const applyServings = () => { try {
        const count = Number(servings);
        setLogged(current => scaleLoggedRecipe(current, count));
        setServings(String(count));
        setError("");
    }
    catch (ex) {
        setError(ex instanceof Error ? ex.message : "Could not scale servings");
    } };
    if(adding)return <><RecipeIngredientPicker categories={categories} excludedIds={logged.ingredients.map(item=>item.snapshot.foodId).filter((value):value is string=>Boolean(value))} onClose={()=>setAdding(false)} onSelected={addFood} onCustom={()=>setCustomFood(true)}/>{customFood&&<InlineFoodDialog categories={categories} onClose={()=>setCustomFood(false)} onCreated={food=>{addFood(food);setCustomFood(false)}}/>}</>;
    return <main className="screen recipe-instance">
      <header className="modal-header"><button className="icon-button close" onClick={onClose} aria-label="Close"><X /></button><h1>Edit Recipe Entry</h1><span className="header-spacer"/></header>
      <section className="recipe-instance-summary"><label className="logged-servings"><span>Servings logged</span><input type="number" min="0.1" step="0.1" inputMode="decimal" value={servings} onChange={e=>setServings(e.target.value)} onBlur={applyServings}/></label><h2>{recipeInfo.name}</h2><strong><EnergyText calories={preview.calories} /></strong><span>P {roundMacro(preview.protein)} · C {roundMacro(preview.carbohydrates)} · F {roundMacro(preview.fat)}</span></section>
      {error&&<p className="form-error recipe-entry-error" role="alert">{error}</p>}
      <section className="instance-ingredients"><header><strong>Ingredients this time</strong><small>Uncheck an omission, change its amount, or hold a card to reorder.</small></header><DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={({active})=>setSelectedId(String(active.id))} onDragEnd={dragEnd}><SortableContext items={logged.ingredients.map(item=>item.id)} strategy={verticalListSortingStrategy}>{logged.ingredients.map((ingredient,index)=><LoggedIngredientRow key={ingredient.id} ingredient={ingredient} editing={selectedId!==undefined} selected={selectedId===ingredient.id} onSelect={()=>setSelectedId(ingredient.id)} categoryColour={categories.find(category=>category.id===ingredient.snapshot.categoryId)?.colour} onToggle={enabled=>setLogged(current=>({...current,ingredients:current.ingredients.map((item,i)=>i===index?{...item,enabled}:item)}))} onQuantity={value=>updateQuantity(index,value)}/>)}</SortableContext></DndContext></section>
      <button className="add-instance-ingredient" onClick={()=>setAdding(true)}><Plus />Add ingredient this time</button>
      {!!logged.instructions?.length&&<section className="logged-instructions"><h3>Preparation</h3><ol>{logged.instructions.map((step,index)=><li key={`${index}-${step}`}>{step}</li>)}</ol></section>}
      <label className="toggle-row recipe-consumed"><span><strong>Consumed</strong><small>Include in consumed totals</small></span><input type="checkbox" checked={consumed} onChange={e=>setConsumed(e.target.checked)}/></label>
      <div className="recipe-instance-actions"><button className="primary" onClick={()=>setSaveOptions(true)}>Save changes</button><button className="danger" onClick={async()=>{await db.entries.delete(entry.id);onDelete(entry);onSaved()}}><Trash2 />Delete entry</button></div>
      {saveOptions&&<div className="dialog-backdrop"><div className="dialog recipe-save-dialog"><h2>Save recipe changes</h2><p>Choose whether these ingredient changes belong only to this meal or to a reusable recipe.</p><button className="save-choice primary" onClick={()=>void finish("meal")}><strong>This meal only</strong><small>Keep the saved recipe unchanged.</small></button>{saved&&<button className="save-choice" onClick={()=>void finish("update")}><strong>Update “{saved.name}”</strong><small>Enabled ingredients become the new recipe.</small></button>}<label>New recipe name<input value={newRecipeName} onChange={e=>setNewRecipeName(e.target.value)}/></label><button className="save-choice" onClick={()=>void finish("copy")}><strong>Save as new recipe</strong><small>Create an independent reusable recipe.</small></button><div><button onClick={()=>setSaveOptions(false)}>Cancel</button></div></div></div>}
      {customFood&&<InlineFoodDialog categories={categories} onClose={()=>setCustomFood(false)} onCreated={food=>{addFood(food);setCustomFood(false)}}/>}
      {selectedId&&<IngredientEditToolbar index={logged.ingredients.findIndex(item=>item.id===selectedId)} count={logged.ingredients.length} onDone={()=>setSelectedId(undefined)} onMove={moveSelected} onDelete={()=>{setLogged(current=>({...current,ingredients:current.ingredients.filter(item=>item.id!==selectedId)}));setSelectedId(undefined)}}/>}
    </main>;
}
