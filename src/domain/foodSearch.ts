// A compact search vocabulary handles genuinely different Australian/common
// terms. Relevance and typo tolerance below do the general matching work.
const SEARCH_VOCABULARY:Record<string,string[]>= {
  quick:["rolled","instant"], rolled:["quick"],
  naval:["navel"], navel:["naval"],
  mince:["minced","ground"], minced:["mince","ground"], ground:["mince","minced"],
  capsicum:["pepper"], coriander:["cilantro"], rocket:["arugula"],
  full:["regular","whole"], cream:["fat"], whole:["full","regular"], regular:["full","whole"],
  skim:["skimmed","nonfat"], skimmed:["skim","nonfat"], nonfat:["skim","skimmed"],
  lite:["light","reduced","low"], yoghurt:["yogurt"], yogurt:["yoghurt"],
  wholemeal:["wholegrain","wholewheat"], zucchini:["courgette"], eggplant:["aubergine"],
};

function words(value:string):string[]{
  return value.toLocaleLowerCase("en-AU").normalize("NFKD").replace(/[^a-z0-9]+/g," ").trim().split(/\s+/).filter(Boolean);
}

function stem(word:string):string{
  if(word.length>5&&word.endsWith("ies"))return `${word.slice(0,-3)}y`;
  if(word.length>5&&word.endsWith("ing"))return word.slice(0,-3);
  if(word.length>4&&word.endsWith("es"))return word.slice(0,-2);
  if(word.length>3&&word.endsWith("s"))return word.slice(0,-1);
  return word;
}

function editDistance(left:string,right:string):number{
  if(Math.abs(left.length-right.length)>2)return 3;
  const previous=Array.from({length:right.length+1},(_,index)=>index);
  for(let row=1;row<=left.length;row+=1){
    let diagonal=previous[0]!;
    previous[0]=row;
    for(let column=1;column<=right.length;column+=1){
      const above=previous[column]!;
      previous[column]=Math.min(previous[column]!+1,previous[column-1]!+1,diagonal+(left[row-1]===right[column-1]?0:1));
      diagonal=above;
    }
  }
  return previous[right.length]!;
}

function tokenSimilarity(target:string,query:string):number{
  const alternatives=[query,...(SEARCH_VOCABULARY[query]??[])];
  let best=0;
  for(const candidate of alternatives){
    if(target===candidate)best=Math.max(best,1);
    else if(candidate.length>=2&&target.startsWith(candidate))best=Math.max(best,.9);
    else if(stem(target)===stem(candidate))best=Math.max(best,.86);
    else if(candidate.length>=4&&target.includes(candidate))best=Math.max(best,.72);
    else if(candidate.length>=4){
      const distance=editDistance(target,candidate);
      if(distance===1)best=Math.max(best,.78);
      else if(distance===2&&candidate.length>=7)best=Math.max(best,.64);
    }
  }
  return best;
}

export function foodSearchScore(name:string,query:string,secondary=""):number{
  const queryWords=words(query);
  if(!queryWords.length)return 0;
  const nameWords=words(name);
  const secondaryWords=words(secondary);
  const normalName=nameWords.join(" ");
  const normalQuery=queryWords.join(" ");
  if(normalName===normalQuery)return 10_000;
  const similarities=queryWords.map(queryWord=>{
    const nameScore=Math.max(0,...nameWords.map(nameWord=>tokenSimilarity(nameWord,queryWord)));
    const secondaryScore=Math.max(0,...secondaryWords.map(word=>tokenSimilarity(word,queryWord)))*.55;
    return {score:Math.max(nameScore,secondaryScore),inName:nameScore>=secondaryScore&&nameScore>0};
  });
  const matched=similarities.filter(item=>item.score>=.6).length;
  const coverage=similarities.reduce((sum,item)=>sum+item.score,0)/queryWords.length;
  const required=queryWords.length===1?1:Math.ceil(queryWords.length*.66);
  if(matched<required||coverage<(queryWords.length===1?.6:.58))return 0;
  let score=coverage*5_000+(similarities.filter(item=>item.inName).length/queryWords.length)*1_800;
  if(normalName.startsWith(normalQuery))score+=1_500;
  else if(nameWords.some((_,index)=>nameWords.slice(index,index+queryWords.length).join(" ")===normalQuery))score+=900;
  if(queryWords.some(queryWord=>tokenSimilarity(nameWords[0]??"",queryWord)>=.85))score+=500;
  score-=Math.min(nameWords.length,100)*4;
  return score;
}

export function matchesFoodSearch(searchable:string,query:string):boolean{
  return !words(query).length||foodSearchScore(searchable,query)>0;
}
