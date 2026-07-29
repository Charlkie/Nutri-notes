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
