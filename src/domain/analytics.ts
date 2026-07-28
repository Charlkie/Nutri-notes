import type { DayFoodEntry, Nutrients } from "./types";
import { emptyNutrients } from "./nutrition";

export interface DatedEntry { date:string; entry:DayFoodEntry }
export interface BreakdownItem { id:string; label:string; value:number }
export interface DailyNutrition extends Nutrients { date:string }
export interface FoodStatistic { id:string; name:string; logs:number; calories:number; protein:number; averageQuantity:number; unit:string; lastDate:string }

export function dailyNutrition(items:DatedEntry[]):DailyNutrition[] {const dates=new Map<string,Nutrients>();for(const {date,entry} of items){const total=dates.get(date)??emptyNutrients();total.calories+=entry.snapshot.calories;total.protein+=entry.snapshot.protein;total.carbohydrates+=entry.snapshot.carbohydrates;total.fat+=entry.snapshot.fat;total.fibre=(total.fibre??0)+(entry.snapshot.fibre??0);dates.set(date,total)}return [...dates].map(([date,total])=>({date,...total})).sort((a,b)=>a.date.localeCompare(b.date))}

export function categoryBreakdown(items:DatedEntry[],labels:Map<string,string>):BreakdownItem[]{const totals=new Map<string,number>();for(const {entry} of items)totals.set(entry.snapshot.categoryId,(totals.get(entry.snapshot.categoryId)??0)+entry.snapshot.calories);return [...totals].map(([id,value])=>({id,label:labels.get(id)??"Other",value})).sort((a,b)=>b.value-a.value)}

export function macroCalorieBreakdown(items:DatedEntry[]):BreakdownItem[]{const totals=items.reduce((sum,{entry})=>({protein:sum.protein+entry.snapshot.protein*4,carbohydrates:sum.carbohydrates+entry.snapshot.carbohydrates*4,fat:sum.fat+entry.snapshot.fat*9}),{protein:0,carbohydrates:0,fat:0});return [{id:"protein",label:"Protein",value:totals.protein},{id:"carbohydrates",label:"Carbohydrates",value:totals.carbohydrates},{id:"fat",label:"Fat",value:totals.fat}].filter(item=>item.value>0).sort((a,b)=>b.value-a.value)}

export function foodStatistics(items:DatedEntry[]):FoodStatistic[]{const groups=new Map<string,{name:string;logs:number;calories:number;protein:number;quantity:number;unit:string;lastDate:string}>();for(const {date,entry} of items){const key=entry.snapshot.foodId??entry.snapshot.name;const current=groups.get(key)??{name:entry.snapshot.name,logs:0,calories:0,protein:0,quantity:0,unit:entry.snapshot.unit,lastDate:date};current.logs+=1;current.calories+=entry.snapshot.calories;current.protein+=entry.snapshot.protein;current.quantity+=entry.snapshot.quantity;if(date>current.lastDate)current.lastDate=date;groups.set(key,current)}return [...groups].map(([id,item])=>({id,name:item.name,logs:item.logs,calories:item.calories,protein:item.protein,averageQuantity:item.quantity/item.logs,unit:item.unit,lastDate:item.lastDate})).sort((a,b)=>b.logs-a.logs||b.calories-a.calories)}
