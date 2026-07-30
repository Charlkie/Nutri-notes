const SEARCH_ALIASES:Record<string,string[]>={
  quick:["quick","rolled","instant"],
  naval:["naval","navel"],
  navel:["navel","naval"],
  mince:["mince","minced","ground"],
  capsicum:["capsicum","pepper"],
  coriander:["coriander","cilantro"],
  rocket:["rocket","arugula"],
};

function words(value:string):string[]{
  return value.toLocaleLowerCase("en-AU").normalize("NFKD").replace(/[^a-z0-9]+/g," ").trim().split(/\s+/).filter(Boolean);
}

export function matchesFoodSearch(searchable:string,query:string):boolean{
  const queryWords=words(query);
  if(!queryWords.length)return true;
  const target=words(searchable);
  return queryWords.every(word=>(SEARCH_ALIASES[word]??[word]).some(candidate=>target.some(targetWord=>targetWord.startsWith(candidate))));
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
  else if(queryWords.every(queryWord=>secondaryWords.some(word=>word.startsWith(queryWord))))score+=2_000;
  return score-Math.min(nameWords.length,100)*5-Math.min(normalName.length,200)/10;
}
