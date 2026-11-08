const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../core.js');

const VOCAB='we,i,you,the,a,an,at,on,in,to,and,or,so,then,is,are,was,do,not,my,one,after,by,of,it,for,with,take,walk,wait,go,come,here,there,this,that,can,will,have,has,be,up,out,from,when,if,as,but,left,late,share,leave,old,open,close,light,last,first,now,two,again,back,home,door,street,hand,time,day,night,good,well,just,still,over,under,down,dark';
const LINES=[
 'We wait at the old north gate and watch the dawn train come in.',
 'The dawn train is late, so we share one loaf by the north pier.',
 'I left my coat on the dawn train, near the quiet north pier.',
 'Do not wait after dusk; the north gate is locked and the pier is dark.',
 'We lock the old gate, then walk back to the north pier before dawn.',
 'Share the last loaf, and leave the north gate open for the late train.'
].join('\n');
const D={q:'37',g:'100',k:'3',vocab:VOCAB,lines:LINES};
// 独立的朴素参考实现：不复用 core 的枚举/判定函数，按需求简报公式重写
function ref(x){
  const q=+x.q,g=+x.g,k=+x.k;
  const known=new Set(x.vocab.toLowerCase().split(/[,，\s]+/).filter(Boolean));
  const rows=x.lines.replace(/\r/g,'').split('\n').filter(l=>l.trim());
  const sents=rows.map(line=>{
    const toks=(line.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g)||[]).map(t=>t.toLowerCase());
    return {toks,u:toks.filter(t=>!known.has(t)).length,n:toks.length};
  });
  const freq={};rows.forEach(l=>(l.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g)||[]).forEach(t=>{const w=t.toLowerCase();if(!known.has(w))freq[w]=(freq[w]||0)+1}));
  const words=Object.keys(freq).sort(),M=sents.length,target=Math.ceil(g*M/100);
  function pass(s,learned){let u=0;for(const t of s.toks)if(!known.has(t)&&!learned.has(t))u++;return u*100<=q*s.n;}
  function count(learned){let c=0;for(const s of sents)if(pass(s,learned))c++;return c;}
  let exact=null;
  for(let mask=0;mask<(1<<words.length);mask++){
    const learned=new Set();let gain=0;
    for(let b=0;b<words.length;b++)if(mask&(1<<b)){learned.add(words[b]);gain+=freq[words[b]];}
    const c=count(learned),o={size:learned.size,passCount:c,gain,words:[...learned].sort()};
    const better=!exact||o.size<exact.size||(o.size===exact.size&&(o.passCount>exact.passCount||(o.passCount===exact.passCount&&(o.gain>exact.gain||(o.gain===exact.gain&&o.words.join('|')<exact.words.join('|'))))));
    if(c>=target&&better)exact=o;
  }
  return {total:sents.reduce((n,s)=>n+s.n,0),knownTotal:sents.reduce((n,s)=>n+s.toks.filter(t=>known.has(t)).length,0),
    U:words.length,M,target,exact,baseline:count(new Set()),sents:sents.map(s=>({n:s.n,u:s.u}))};
}

test('默认虚构锚点：全部数字可回溯到同一次计算',()=>{
  const r=C.solve(D),f=ref(D);
  assert.equal(r.totalTokens,84);assert.equal(r.knownTokens,52);
  assert.equal(r.M,6);assert.equal(r.U,14);assert.equal(r.subsets,16384);
  assert.ok(Math.abs(r.tokenCover-61.904761904761905)<1e-9);
  assert.equal(r.baseline,4);assert.equal(r.targetCount,6);
  assert.deepEqual(r.sentences.map(s=>[s.n,s.unknown,s.pass]),[[14,5,true],[14,5,true],[13,7,false],[15,5,true],[14,6,false],[14,4,true]]);
  assert.deepEqual(r.exact.words,['dawn','north','pier']);
  assert.equal(r.exact.size,3);assert.equal(r.exact.passCount,6);assert.equal(r.exact.gain,14);
  assert.equal(r.afterKnown,66);assert.ok(Math.abs(r.afterCover-78.57142857142857)<1e-9);
  assert.deepEqual(r.topK.words,['dawn','gate','north']);assert.equal(r.topK.passCount,5);
  assert.deepEqual(r.greedyWords,['north']);assert.equal(r.stuck,true);assert.equal(r.greedy.passCount,5);
  assert.equal(r.budgetReached,true);
  // 与独立参考实现一致（不是两边复制同一个函数）
  assert.equal(r.totalTokens,f.total);assert.equal(r.knownTokens,f.knownTotal);
  assert.deepEqual(r.exact.words,f.exact.words);assert.equal(r.exact.size,f.exact.size);
  assert.equal(r.baseline,f.baseline);
});

test('token 化：拉丁字母、小写、撇号、数字/中文/连字符',()=>{
  assert.deepEqual(C.tokenize("We don't WAIT, go-ing 42 中文!"),['we',"don't",'wait','go','ing']);
  assert.deepEqual(C.tokenize('... 123 ...'),[]);
  assert.deepEqual(C.tokenize("it's John's"),["it's","john's"]);
  assert.deepEqual(C.parseVocab('Go, go GO, don\'t').list,["don't",'go']); // list 按字典序排序
  assert.equal(C.parseVocab('a, a, b').count,2);
});

test('阈值两侧与整数比较：q 刚跨过某句生词占比',()=>{
  const base={q:'25',g:'100',k:'2',vocab:'we,go',lines:'we go moon moon'}; // n=4,u=2 → 50%
  const a=C.solve(base),b=C.solve({...base,q:'49'}),c=C.solve({...base,q:'50'}),d=C.solve({...base,q:'51'});
  assert.equal(a.baseline,0);assert.equal(b.baseline,0);
  assert.equal(c.sentences[0].pass,true);assert.equal(c.baseline,1);
  assert.equal(d.baseline,1);
  const e=C.solve({...base,q:'50',g:'100'});
  assert.equal(e.baseline,1);assert.equal(e.exact.size,0);
});

test('边界：q=0 / q=100 / g=0 / k=0 / 无生词 / 全部不认识',()=>{
  const none=C.solve({q:'0',g:'0',k:'0',vocab:'x',lines:'moon sun'});
  assert.equal(none.baseline,0);assert.equal(none.targetCount,0);assert.equal(none.exact.size,0);assert.equal(none.budgetReached,true);
  const all=C.solve({q:'100',g:'100',k:'0',vocab:'x',lines:'moon sun'});
  assert.equal(all.baseline,1);assert.equal(all.exact.size,0);assert.equal(all.budgetReached,true);
  const k0=C.solve({q:'0',g:'100',k:'0',vocab:'x',lines:'moon sun'});
  assert.equal(k0.budgetReached,false);assert.equal(k0.exact.words.length,2);assert.equal(k0.budget.size,0);
  const noUnk=C.solve({q:'0',g:'100',k:'0',vocab:'moon,sun',lines:'moon sun'});
  assert.equal(noUnk.U,0);assert.equal(noUnk.subsets,1);assert.equal(noUnk.tokenCover,100);assert.equal(noUnk.typeCover,100);
  assert.equal(noUnk.exact.size,0);assert.equal(noUnk.topK.passCount,1);
});

test('精确最小补词集与独立全枚举对拍（300 组随机场景）',()=>{
  let seed=20261109;const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};
  for(let t=0;t<300;t++){
    const pool=['aa','bb','cc','dd','ee','ff','gg','hh'];
    const nv=1+Math.floor(rnd()*4),nvocab=pool.slice(0,nv);
    const M=1+Math.floor(rnd()*5);const lines=[];
    for(let i=0;i<M;i++){
      const len=1+Math.floor(rnd()*6),ws=[];
      for(let j=0;j<len;j++)ws.push(rnd()<0.45?nvocab[Math.floor(rnd()*nvocab.length)]:pool[Math.floor(rnd()*pool.length)]);
      lines.push(ws.join(' '));
    }
    const x={q:String(Math.floor(rnd()*101)),g:String(Math.floor(rnd()*101)),k:String(Math.floor(rnd()*5)),vocab:nvocab.join(','),lines:lines.join('\n')};
    const a=C.solve(x),b=ref(x);
    assert.equal(a.baseline,b.baseline,'baseline '+t);
    assert.equal(a.tokenCover,b.knownTotal/b.total*100,'tokenCover '+t);
    if(b.exact){
      assert.equal(a.exact.size,b.exact.size,'exact size '+t);
      assert.deepEqual(a.exact.words,b.exact.words,'exact words '+t);
      assert.equal(a.exact.passCount,b.exact.passCount,'exact pass '+t);
    }else assert.equal(a.exact,null,'exact null '+t);
    assert.deepEqual(a.sentences.map(s=>[s.n,s.unknown]),b.sents.map(s=>[s.n,s.u]),'sentences '+t);
  }
});

test('预算内最优：不超过 k，且句数不低于任何同规模方案（200 组对拍）',()=>{
  let seed=77123;const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};
  for(let t=0;t<200;t++){
    const pool=['aa','bb','cc','dd','ee','ff'];
    const vocab=pool.slice(0,1+Math.floor(rnd()*3));
    const lines=[];for(let i=0;i<1+Math.floor(rnd()*4);i++){const ws=[];for(let j=0;j<1+Math.floor(rnd()*5);j++)ws.push(pool[Math.floor(rnd()*pool.length)]);lines.push(ws.join(' '));}
    const x={q:String(Math.floor(rnd()*101)),g:String(Math.floor(rnd()*101)),k:String(Math.floor(rnd()*5)),vocab:vocab.join(','),lines:lines.join('\n')};
    const r=C.solve(x);
    assert.ok(r.budget.size<=r.k);
    // 独立枚举：预算内最大句数及并列规则
    const words=r.words,known=new Set(vocab),sents=x.lines.split('\n').map(l=>(l.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g)||[]).map(w=>w.toLowerCase()));
    const freq={};sents.flat().forEach(w=>{if(!known.has(w))freq[w]=(freq[w]||0)+1});
    let best=null;
    for(let mask=0;mask<(1<<words.length);mask++){
      const S=new Set();let gain=0;for(let b=0;b<words.length;b++)if(mask&(1<<b)){S.add(words[b]);gain+=freq[words[b]];}
      if(S.size>r.k)continue;
      let c=0;for(const toks of sents){let u=0;for(const w of toks)if(!known.has(w)&&!S.has(w))u++;if(u*100<=r.q*toks.length)c++;}
      const o={passCount:c,size:S.size,gain,words:[...S].sort()};
      const bt=!best||o.passCount>best.passCount||(o.passCount===best.passCount&&(o.size<best.size||(o.size===best.size&&(o.gain>best.gain||(o.gain===best.gain&&o.words.join('|')<best.words.join('|'))))));
      if(bt)best=o;
    }
    assert.equal(r.budget.passCount,best.passCount,'budget pass '+t);
    assert.equal(r.budget.size,best.size,'budget size '+t);
  }
});

test('贪心平台期：默认场景确实卡住但精确解达标',()=>{
  const r=C.solve(D);
  assert.equal(r.stuck,true);
  assert.equal(r.greedy.passCount,5);
  assert.ok(r.exact.passCount>r.greedy.passCount);
  assert.ok(r.exact.size<=r.k);
  assert.deepEqual(r.greedySteps,[{word:'north',delta:1,passCount:5}]);
  // 频次 top-k 与精确解不同且更差
  assert.notDeepEqual(r.topK.words,r.exact.words);
  assert.ok(r.topK.passCount<r.exact.passCount);
});

test('改条件立即变化：q=30 / q=45 / k=0 / g=50',()=>{
  const a=C.solve(D),b=C.solve({...D,q:'30'}),c=C.solve({...D,q:'45'}),d=C.solve({...D,k:'0'}),e=C.solve({...D,g:'50'});
  assert.notEqual(a.baseline,b.baseline);
  assert.notEqual(a.baseline,c.baseline);
  assert.equal(d.budgetReached,false);assert.equal(d.budget.size,0);
  assert.equal(e.targetCount,3);assert.ok(e.exact.size<=a.exact.size);
  assert.equal(a.budgetReached,true);
});

test('采用精确补词后：词次覆盖率上升、生词减少、结果可重算',()=>{
  const r=C.solve(D);const merged=D.vocab+','+r.exact.words.join(',');
  const r2=C.solve({...D,vocab:merged});
  assert.equal(r2.totalTokens,r.totalTokens);
  assert.equal(r2.knownTokens,r.afterKnown);
  assert.ok(Math.abs(r2.tokenCover-r.afterCover)<1e-9);
  assert.equal(r2.baseline,6);
  assert.equal(r2.U,r.U-r.exact.size);
});

test('非法输入与上限：全部抛错且不产生半结果',()=>{
  const bad=[
    [{...D,q:'101'},'每句生词上限'],
    [{...D,q:'-1'},'每句生词上限'],
    [{...D,q:'3.5'},'每句生词上限'],
    [{...D,g:'101'},'目标听懂句占比'],
    [{...D,k:'15'},'学习预算'],
    [{...D,vocab:''},'已认识词表'],
    [{...D,vocab:'a1'},'词表第'],
    [{...D,vocab:Array(201).fill('a').join(',')},'最多 200'],
    [{...D,lines:''},'台词文本不能为空'],
    [{...D,lines:'   \n  '},'台词文本不能为空'],
    [{...D,lines:Array(13).fill('moon').join('\n')},'最多 12'],
    [{...D,lines:'a'.repeat(201)},'超过 200 字符'],
    [{...D,lines:'123 中文 456'},'没有可统计'],
    [{...D,lines:Array(401).fill('moon').join(' ')},'超过 200 字符'],
    [{...D,vocab:'x',lines:'aa bb cc dd ee ff gg hh ii jj kk ll mm nn oo'},'超过 14'],
  ];
  for(const [x,msg] of bad)assert.throws(()=>C.solve(x),e=>e.message.includes(msg),msg);
  // 总词次 400 上限：12 行 × 40 个单字母词 = 480 词次，每行 79 字符 < 200
  assert.throws(()=>C.solve({...D,vocab:'x',lines:Array(12).fill(Array(40).fill('m').join(' ')).join('\n')}),/总词次超过 400/);
});

test('空行忽略、大小写混用、重复词表项、撇号词',()=>{
  const r=C.solve({q:'0',g:'100',k:'2',vocab:'WE, we, Go',lines:'\n WE go Moon,\n\nMOON don\'t stop\n'});
  assert.equal(r.M,2);assert.equal(r.vocab.count,2);
  assert.equal(r.sentences[0].n,3);assert.equal(r.sentences[1].n,3); // "MOON don't stop" 中 don't 是一个 token
  assert.ok(r.words.includes("don't"));assert.ok(r.words.includes('moon'));
});

test('单位与舍入：覆盖率按词次而非种类，重复出现重复计数',()=>{
  const r=C.solve({q:'0',g:'100',k:'1',vocab:'a,b',lines:'a a a x\n'});
  assert.equal(r.totalTokens,4);assert.equal(r.knownTokens,3);
  assert.equal(r.tokenCover,75);assert.ok(Math.abs(r.typeCover-50)<1e-9); // a,b,x 三种，认识 2 种
  assert.equal(r.sentences[0].pct,25);
  assert.equal(r.marginal[0].freq,1);
});
