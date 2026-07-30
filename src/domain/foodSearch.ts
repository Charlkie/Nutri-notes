const SEARCH_ALIASES:Record<string,string[]>={
  quick:["quick","rolled","instant"],
  naval:["naval","navel"],
  navel:["navel","naval"],
  mince:["mince","minced","ground"],
  capsicum:["capsicum","pepper"],
  coriander:["coriander","cilantro"],
  rocket:["rocket","arugula"],
  full:["full","regular","whole"],
  cream:["cream","fat"],
  whole:["whole","full","regular"],
  skim:["skim","skimmed","nonfat","non","zero"],
  skimmed:["skimmed","skim","nonfat","non","zero"],
  lite:["lite","light","reduced","low"],
  yoghurt:["yoghurt","yogurt"],
  yogurt:["yogurt","yoghurt"],
  wholemeal:["wholemeal","wholegrain","wholewheat"],
  zucchini:["zucchini","courgette"],
  eggplant:["eggplant","aubergine"],
};

function words(value:string):string[]{
  return value.toLocaleLowerCase("en-AU").normalize("NFKD").replace(/[^a-z0-9]+/g," ").trim().split(/\s+/).filter(Boolean);
}

function wordMatches(targetWords:string[],queryWord:string):boolean{
  return (SEARCH_ALIASES[queryWord]??[queryWord]).some(candidate=>targetWords.some(targetWord=>targetWord.startsWith(candidate)));
}

export function matchesFoodSearch(searchable:string,query:string):boolean{
  const queryWords=words(query);
  if(!queryWords.length)return true;
  const target=words(searchable);
  return queryWords.every(word=>wordMatches(target,word));
}

export function foodSearchScore(name:string,query:string,secondary=""):number{
  const queryWords=words(query);
  if(!queryWords.length)return 0;
  const nameWords=words(name);
  const secondaryWords=words(secondary);
  const normalName=nameWords.join(" ");
  const normalQuery=queryWords.join(" ");
  let score=0;
  if(normalName===normalQuery)score+=10_000;
  else if(nameWords[0]===normalQuery)score+=9_000;
  else if(normalName.startsWith(`${normalQuery} `))score+=8_000;
  else if(queryWords.every(queryWord=>nameWords.includes(queryWord)))score+=7_000;
  else if(queryWords.every(queryWord=>nameWords.some(nameWord=>nameWord.startsWith(queryWord))))score+=6_000;
  else if(queryWords.every(queryWord=>wordMatches(nameWords,queryWord)))score+=6_500;
  else if(queryWords.every(queryWord=>secondaryWords.some(word=>word.startsWith(queryWord))))score+=2_000;
  return score-Math.min(nameWords.length,100)*5-Math.min(normalName.length,200)/10;
}
