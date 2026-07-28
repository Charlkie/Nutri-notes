import type { Food, FoodSnapshot, LoggedRecipe, Nutrients, Recipe } from "./types";
import { createSnapshot, emptyNutrients } from "./nutrition";
import { createId } from "./id";

export function buildLoggedRecipe(recipe:Recipe, foods:Food[], loggedServings:number):{snapshot:FoodSnapshot;recipe:LoggedRecipe}{
  if(!Number.isFinite(loggedServings)||loggedServings<=0)throw new Error("Servings must be greater than zero");
  if(!recipe.ingredients.length)throw new Error("Add at least one ingredient");
  const byId=new Map(foods.map(food=>[food.id,food]));const factor=loggedServings/recipe.yieldServings;
  const ingredients=[...recipe.ingredients].sort((a,b)=>a.sortIndex-b.sortIndex).map(item=>{const food=byId.get(item.foodId);if(!food)throw new Error(`Missing ingredient for ${recipe.name}`);return {id:item.id,enabled:true,snapshot:createSnapshot(food,item.quantity*factor),group:item.group}});
  const logged:LoggedRecipe={recipeId:recipe.id,yieldServings:recipe.yieldServings,loggedServings,ingredients,instructions:recipe.instructions?[...recipe.instructions]:undefined};
  return {recipe:logged,snapshot:recipeSnapshot(recipe,logged)};
}

export function recipeSnapshot(recipe:Pick<Recipe,"id"|"name"|"categoryId">,logged:LoggedRecipe):FoodSnapshot{
  const total=sumEnabledIngredients(logged);return {foodId:recipe.id,name:recipe.name,categoryId:recipe.categoryId,quantity:logged.loggedServings,unit:"serving",calculationMode:"perServing",baseQuantity:1,...total};
}

export function sumEnabledIngredients(logged:LoggedRecipe):Nutrients{
  const total=emptyNutrients();for(const ingredient of logged.ingredients)if(ingredient.enabled)for(const key of ["calories","protein","carbohydrates","fat","fibre"] as const)total[key]=(total[key]??0)+(ingredient.snapshot[key]??0);return total;
}

export function scaleLoggedRecipe(logged:LoggedRecipe,servings:number):LoggedRecipe{
  if(!Number.isFinite(servings)||servings<=0)throw new Error("Servings must be greater than zero");const factor=servings/logged.loggedServings;return {...logged,loggedServings:servings,ingredients:logged.ingredients.map(ingredient=>({...ingredient,snapshot:{...ingredient.snapshot,quantity:ingredient.snapshot.quantity*factor,calories:ingredient.snapshot.calories*factor,protein:ingredient.snapshot.protein*factor,carbohydrates:ingredient.snapshot.carbohydrates*factor,fat:ingredient.snapshot.fat*factor,fibre:ingredient.snapshot.fibre===undefined?undefined:ingredient.snapshot.fibre*factor}}))};
}

export function recipeIngredientsFromLogged(logged:LoggedRecipe,targetYield:number){
  if(!Number.isFinite(targetYield)||targetYield<=0)throw new Error("Recipe yield must be greater than zero");const factor=targetYield/logged.loggedServings;return logged.ingredients.filter(ingredient=>ingredient.enabled).map((ingredient,sortIndex)=>{if(!ingredient.snapshot.foodId)throw new Error(`${ingredient.snapshot.name} is not linked to a saved food`);return {id:createId(),foodId:ingredient.snapshot.foodId,quantity:ingredient.snapshot.quantity*factor,sortIndex,group:ingredient.group}});
}

export function moveRecipeItem<T>(items:readonly T[],index:number,offset:-1|1):T[]{
  const target=index+offset;
  if(index<0||index>=items.length||target<0||target>=items.length)return [...items];
  const reordered=[...items];
  const [item]=reordered.splice(index,1);
  reordered.splice(target,0,item!);
  return reordered;
}
