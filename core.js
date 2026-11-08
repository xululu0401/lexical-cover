(function(root){'use strict';
// 词面覆盖台：拉丁 token 逐句生词对账 + 2^U 精确最小补词集
var TOKEN_RE=/[A-Za-z]+(?:'[A-Za-z]+)?/g;
function int(v,label,min,max){var s=String(v).trim();if(!/^-?\d+$/.test(s))throw Error(label+'须为整数');var n=Number(s);if(!Number.isSafeInteger(n)||n<min||n>max)throw Error(label+'须为 '+min+'–'+max+' 的整数');return n;}
function tokenize(line){return (String(line).match(TOKEN_RE)||[]).map(function(t){return t.toLowerCase();});}
function parseVocab(text){
  var parts=String(text).trim().split(/[,，\s]+/).filter(function(x){return x.length>0;});
  if(!parts.length)throw Error('已认识词表不能为空');
  if(parts.length>200)throw Error('已认识词表最多 200 项');
  var set={};
  parts.forEach(function(w,i){if(!/^[A-Za-z]+(?:'[A-Za-z]+)?$/.test(w)||w.length>24)throw Error('词表第 '+(i+1)+' 项须为 1–24 个拉丁字母（可含中间撇号）');set[w.toLowerCase()]=true;});
  return {set:set,list:Object.keys(set).sort(),count:Object.keys(set).length};
}
function compareWords(a,b){return a.join('|')<b.join('|')?-1:a.join('|')>b.join('|')?1:0;}
function better(a,b){ // a 是否优于 b
  if(!b)return true;
  if(a.size!==b.size)return a.size<b.size;
  if(a.passCount!==b.passCount)return a.passCount>b.passCount;
  if(a.gain!==b.gain)return a.gain>b.gain;
  return compareWords(a.words,b.words)<0;
}
function betterBudget(a,b){
  if(!b)return true;
  if(a.passCount!==b.passCount)return a.passCount>b.passCount;
  if(a.size!==b.size)return a.size<b.size;
  if(a.gain!==b.gain)return a.gain>b.gain;
  return compareWords(a.words,b.words)<0;
}
function solve(x){
  var q=int(x.q,'每句生词上限',0,100),g=int(x.g,'目标听懂句占比',0,100),k=int(x.k,'学习预算',0,14);
  var vocab=parseVocab(x.vocab);
  var lines=String(x.lines).replace(/\r/g,'').split('\n').filter(function(l){return l.trim().length>0;});
  if(!lines.length)throw Error('台词文本不能为空');
  if(lines.length>12)throw Error('台词文本最多 12 行（空行忽略）');
  lines.forEach(function(l,i){if([...l].length>200)throw Error('第 '+(i+1)+' 行超过 200 字符');});
  var sentences=[],totalTokens=0,allTokens={},unknownTypes={};
  lines.forEach(function(line,i){
    var toks=tokenize(line);
    if(toks.length>400)throw Error('第 '+(i+1)+' 行词次超过 400');
    var unknown=0,local={};
    toks.forEach(function(t){allTokens[t]=(allTokens[t]||0)+1;if(!vocab.set[t]){unknown++;unknownTypes[t]=(unknownTypes[t]||0)+1;local[t]=true;}});
    totalTokens+=toks.length;
    sentences.push({index:i+1,text:line.trim(),n:toks.length,unknown:unknown,unknownWords:Object.keys(local).sort(),
      pct:0,pass:false,tokens:toks});
    if(unknown*100<=q*toks.length)sentences[sentences.length-1].pass=true;
    sentences[sentences.length-1].pct=toks.length?unknown/toks.length*100:0;
  });
  if(totalTokens===0)throw Error('台词文本中没有可统计的拉丁字母词次');
  if(totalTokens>400)throw Error('总词次超过 400');
  var words=Object.keys(unknownTypes).sort();
  if(words.length>14)throw Error('不同生词种类 '+words.length+' 个，超过 14 个上限（精确枚举不可用）');
  var M=sentences.length,U=words.length;
  var knownTokens=totalTokens-Object.values(unknownTypes).reduce(function(a,b){return a+b;},0);
  var knownTypes=Object.keys(allTokens).filter(function(t){return vocab.set[t];}).length;
  var totalTypes=Object.keys(allTokens).length;
  var baseline=sentences.filter(function(s){return s.pass;}).length;
  var targetCount=Math.ceil(g*M/100);
  // 每词在每句出现次数
  var counts=words.map(function(w){return sentences.map(function(s){var c=0;s.tokens.forEach(function(t){if(t===w)c++;});return c;});});
  var gains=words.map(function(w){return unknownTypes[w];});
  function evalSet(mask){
    var passCount=0,gain=0,chosen=[];
    for(var b=0;b<U;b++)if(mask&(1<<b)){gain+=gains[b];chosen.push(words[b]);}
    for(var i=0;i<M;i++){
      var u=sentences[i].unknown;
      for(var b=0;b<U;b++)if(mask&(1<<b))u-=counts[b][i];
      if(u*100<=q*sentences[i].n)passCount++;
    }
    return {mask:mask,words:chosen,size:chosen.length,gain:gain,passCount:passCount};
  }
  var exact=null,budget=null,total=1<<U;
  for(var mask=0;mask<total;mask++){
    var e=evalSet(mask);
    if(e.passCount>=targetCount&&better(e,exact))exact=e;
    if(e.size<=k&&betterBudget(e,budget))budget=e;
  }
  var budgetReached=budget&&budget.passCount>=targetCount;
  // 贪心：每步选单步增量最大者；无提升则停止并记平台期
  var greedyMask=0,greedyWords=[],greedySteps=[],stuck=false;
  var cur=evalSet(0);
  while(greedyWords.length<U&&cur.passCount<targetCount){
    var bestStep=null;
    for(var b=0;b<U;b++)if(!(greedyMask&(1<<b))){
      var nx=evalSet(greedyMask|(1<<b));
      var cand={b:b,w:words[b],delta:nx.passCount-cur.passCount,gain:gains[b]};
      if(!bestStep||cand.delta>bestStep.delta||(cand.delta===bestStep.delta&&(cand.gain>bestStep.gain||(cand.gain===bestStep.gain&&cand.w<bestStep.w))))bestStep=cand;
    }
    if(!bestStep||bestStep.delta<=0){stuck=true;break;}
    greedyMask|=1<<bestStep.b;greedyWords.push(bestStep.w);
    greedySteps.push({word:bestStep.w,delta:bestStep.delta,passCount:evalSet(greedyMask).passCount});
    cur=evalSet(greedyMask);
  }
  var greedy=evalSet(greedyMask);
  // 频次 top-k 反事实
  var topMask=0;
  words.map(function(w,i){return {w:w,i:i,f:gains[i]};}).sort(function(a,b){return b.f-a.f||a.w.localeCompare(b.w);}).slice(0,k).forEach(function(o){topMask|=1<<o.i;});
  var topK=evalSet(topMask);
  // 单词边际
  var marginal=words.map(function(w,b){
    var e=evalSet(1<<b);
    var affects=[];for(var i=0;i<M;i++)if(counts[b][i]>0)affects.push(i+1);
    return {word:w,freq:gains[b],soloDelta:e.passCount-baseline,sentences:affects};
  });
  // 精确方案后覆盖
  var afterKnown=knownTokens+(exact?exact.gain:0);
  return {
    q:q,g:g,k:k,vocab:vocab,lines:lines,sentences:sentences,M:M,U:U,words:words,
    totalTokens:totalTokens,knownTokens:knownTokens,totalTypes:totalTypes,knownTypes:knownTypes,
    tokenCover:knownTokens/totalTokens*100,typeCover:totalTypes?knownTypes/totalTypes*100:0,
    baseline:baseline,baselinePct:baseline/M*100,targetCount:targetCount,
    exact:exact,budget:budget,budgetReached:budgetReached,greedy:greedy,greedyWords:greedyWords,greedySteps:greedySteps,stuck:stuck,
    topK:topK,marginal:marginal,afterKnown:afterKnown,afterCover:afterKnown/totalTokens*100,
    subsets:total
  };
}
var api={solve,tokenize,parseVocab,int};
if(typeof module!=='undefined')module.exports=api;else root.AppCore=api;
})(typeof window!=='undefined'?window:this);
