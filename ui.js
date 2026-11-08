const $=id=>document.getElementById(id),key='lexical-cover-v1';
const VOCAB='we,i,you,the,a,an,at,on,in,to,and,or,so,then,is,are,was,do,not,my,one,after,by,of,it,for,with,take,walk,wait,go,come,here,there,this,that,can,will,have,has,be,up,out,from,when,if,as,but,left,late,share,leave,old,open,close,light,last,first,now,two,again,back,home,door,street,hand,time,day,night,good,well,just,still,over,under,down,dark';
const LINES=[
 'We wait at the old north gate and watch the dawn train come in.',
 'The dawn train is late, so we share one loaf by the north pier.',
 'I left my coat on the dawn train, near the quiet north pier.',
 'Do not wait after dusk; the north gate is locked and the pier is dark.',
 'We lock the old gate, then walk back to the north pier before dawn.',
 'Share the last loaf, and leave the north gate open for the late train.'
].join('\n');
const demo={q:'37',g:'100',k:'3',vocab:VOCAB,lines:LINES};
let current=null;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=n=>(Math.round(n*10)/10).toFixed(1).replace(/\.0$/,'');
const num=n=>n.toLocaleString('zh-CN');
const input=()=>({q:$('q').value,g:$('g').value,k:$('k').value,vocab:$('vocab').value,lines:$('lines').value});
function set(v){for(const id of ['q','g','k','vocab','lines'])$(id).value=v[id]??'';render()}
function render(){current=null;$('error').textContent='';
  try{const r=AppCore.solve(input());current=r;
    const ex=r.exact,bu=r.budget,tk=r.topK,gr=r.greedy;
    const reached=r.baseline>=r.targetCount;
    const cw=ex?ex.words.map(w=>`<span class="word">${esc(w)}</span>`).join(''):'<span class="bad">无解</span>';
    $('result').innerHTML=`<div class="eyebrow">当前输入下的对账结论</div>
      <div class="metric ${reached?'good':(r.budgetReached?'good':'bad')}">${reached?'当前已达到目标':(r.budgetReached?'预算内可以达标':'预算内无法达标')} <small>· 最少再学 ${ex?ex.size:'—'} 个词</small></div>
      <div class="hint">每句生词上限 ${r.q}% · 目标听懂句占比 ${r.g}%（需 ${r.targetCount}/${r.M} 句）· 学习预算 ${r.k} 个词 · 已枚举 ${num(r.subsets)} 个补词组合</div>
      <div class="stats"><div><strong>${pct(r.tokenCover)}%</strong><span>词次覆盖率 ${num(r.knownTokens)}/${num(r.totalTokens)}</span></div><div><strong>${r.baseline} / ${r.M}</strong><span>当前能听懂句数（${pct(r.baselinePct)}%）</span></div><div><strong>${r.U}</strong><span>不同生词种类</span></div><div><strong>${ex?ex.size:'—'} / ${r.k}</strong><span>最少需学 / 预算</span></div></div>
      <div class="bar" aria-label="词次覆盖：绿色为已认识词次，橙色为生词词次"><i class="known" style="width:${(r.tokenCover).toFixed(3)}%"></i><i class="unknown" style="width:${(100-r.tokenCover).toFixed(3)}%"></i></div><div class="legend">绿=已认识词次 ${num(r.knownTokens)}，橙=生词词次 ${num(r.totalTokens-r.knownTokens)}；按词次而非种类统计，重复出现重复计数。种类覆盖率 ${pct(r.typeCover)}%（${r.knownTypes}/${r.totalTypes} 种）。</div>
      <h2 style="margin-top:26px">达到目标的精确最少词集</h2>
      <div class="notice ${r.budgetReached?'cool':''}">${ex?`枚举全部 ${num(r.subsets)} 个子集后，最少学 <strong>${ex.size}</strong> 个词即可听懂 ${ex.passCount}/${r.M} 句（目标 ${r.targetCount} 句）；这组词共覆盖 ${ex.gain} 个生词词次，学完后词次覆盖率由 ${pct(r.tokenCover)}% 升到 ${pct(r.afterCover)}%。${r.budgetReached?'预算 '+r.k+' 个词够用。':'预算 '+r.k+' 个词不够，最少需要 '+ex.size+' 个。'}`:'无满足条件的补词组合。'}</div>
      <div class="words">${cw}</div>
      ${ex&&ex.size>0?`<div class="buttons"><button id="apply" class="primary">采用精确补词并重算</button></div>`:''}
      <h2 style="margin-top:26px">四条路线的对照</h2>
      <div class="scroll"><table class="stack"><thead><tr><th>路线</th><th>选词</th><th>用几个词</th><th>能听懂句数</th><th>结论</th></tr></thead><tbody>
        <tr><td data-label="路线">精确最优（全枚举）</td><td data-label="选词">${ex?esc(ex.words.join('、')):'—'}</td><td data-label="用几个词">${ex?ex.size:'—'}</td><td data-label="能听懂句数">${ex?ex.passCount:'—'} / ${r.M}</td><td data-label="结论">${r.budgetReached?'达标':'未达标'}</td></tr>
        <tr><td data-label="路线">预算 ${r.k} 词内最优</td><td data-label="选词">${bu?esc(bu.words.join('、')):'—'}</td><td data-label="用几个词">${bu?bu.size:'—'}</td><td data-label="能听懂句数">${bu?bu.passCount:'—'} / ${r.M}</td><td data-label="结论">${r.budgetReached?'达标':'未达标'}</td></tr>
        <tr><td data-label="路线">只按出现频次选前 ${r.k}</td><td data-label="选词">${esc(tk.words.join('、'))||'（空）'}</td><td data-label="用几个词">${tk.size}</td><td data-label="能听懂句数">${tk.passCount} / ${r.M}</td><td data-label="结论" class="${tk.passCount>=r.targetCount?'good':'bad'}">${tk.passCount>=r.targetCount?'达标':'未达标'}</td></tr>
        <tr><td data-label="路线">贪心逐步选</td><td data-label="选词">${esc(r.greedyWords.join('、'))||'（空）'}</td><td data-label="用几个词">${r.greedyWords.length}</td><td data-label="能听懂句数">${gr.passCount} / ${r.M}</td><td data-label="结论" class="${r.stuck?'bad':''}">${r.stuck?'平台期：再无单词能提升':'达标'}</td></tr>
      </tbody></table></div>
      <div class="notice">${r.stuck?'贪心先选了「'+esc(r.greedyWords.join('、')||'无')+'」后停在第 '+gr.passCount+' 句，单个新词都推不动剩下的句子；但 '+(ex?ex.size:0)+' 个词一起学就能到 '+(ex?ex.passCount:0)+' 句。这正是「按频次背」与「按目标精确选」的差别，不是语言学习结论，只是本模型下的集合覆盖性质。':'本例贪心可以走到目标；精确解仍由全枚举保证最小词数。'}</div>
      <h2 style="margin-top:26px">逐句对账</h2>
      <div class="scroll"><table class="stack"><thead><tr><th>句</th><th>总词次</th><th>生词词次</th><th>生词占比</th><th>判定（上限 ${r.q}%）</th><th>本句生词</th></tr></thead><tbody>${r.sentences.map(s=>`<tr><td data-label="句">第 ${s.index} 句</td><td data-label="总词次">${s.n}</td><td data-label="生词词次">${s.unknown}</td><td data-label="生词占比">${pct(s.pct)}%</td><td data-label="判定" class="${s.pass?'good':'bad'}">${s.pass?'能听懂':'未达标'}</td><td data-label="本句生词">${s.unknownWords.length?esc(s.unknownWords.join('、')):'—'}</td></tr>`).join('')}</tbody></table></div>
      <div class="line"><strong>台词全文（虚构示例）：</strong></div>${r.sentences.map(s=>`<div class="line">${s.index}. ${esc(s.text)}</div>`).join('')}
      <h2 style="margin-top:26px">生词边际表</h2>
      <div class="hint">「单独学它」= 只把这一个词加进已认识词表后，能听懂句数的增量。这一列不能相加：多个词的作用会重叠，所以才需要全枚举。</div>
      <div class="scroll"><table class="stack"><thead><tr><th>生词</th><th>出现次数</th><th>单独学它的增量</th><th>涉及句</th></tr></thead><tbody>${r.marginal.map(m=>`<tr><td data-label="生词">${esc(m.word)}</td><td data-label="出现次数">${m.freq}</td><td data-label="单独学它的增量">+${m.soloDelta}</td><td data-label="涉及句">${m.sentences.join('、')}</td></tr>`).join('')}</tbody></table></div>`;
    const ap=$('apply');if(ap)ap.onclick=()=>{const e=r.exact;if(!e||!e.words.length)return;const cur=$('vocab').value.trim().split(/[,，\s]+/).filter(Boolean);const merged=cur.concat(e.words).join(',');$('vocab').value=merged;$('message').textContent='已把 '+e.words.join('、')+' 追加进已认识词表，结果已重算。';render()};
  }catch(e){$('result').innerHTML='';$('error').textContent=e.message}
  for(const id of ['save','backup','md','png','csv'])$(id).disabled=!current;
}
for(const id of ['q','g','k','vocab','lines'])$(id).addEventListener('input',render);
$('demo').onclick=()=>{set(demo);$('message').textContent='已载入虚构示例。'};
$('tight').onclick=()=>{$('q').value='30';render();$('message').textContent='每句生词上限改为 30%：更多句子未达标，所需最少词集随之变化。'};
$('zerobudget').onclick=()=>{$('k').value='0';render();$('message').textContent='预算改为 0：预算内无法达标，但精确最少词集仍给出所需词数。'};
$('save').onclick=()=>{try{localStorage.setItem(key,JSON.stringify(input()));$('message').textContent='已保存；刷新将恢复此版本。'}catch(e){$('message').textContent='保存失败，请下载备份。'}};
function restore(){try{const s=localStorage.getItem(key);if(!s){$('message').textContent='尚无本机保存';return}const v=JSON.parse(s);AppCore.solve(v);set(v);$('message').textContent='已恢复本机保存'}catch(e){$('message').textContent='保存内容无法读取：'+e.message}}
$('restore').onclick=restore;
function dl(name,data,type){const b=data instanceof Blob?data:new Blob([data],{type}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);$('message').textContent='已请求下载：'+name}
$('backup').onclick=()=>dl('词面覆盖-备份.json',JSON.stringify({version:1,input:input()},null,2),'application/json');
$('import').onclick=()=>$('imports').click();
$('imports').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>100000)throw Error('备份超过100KB');const v=JSON.parse(await file.text());if(v.version!==1||!v.input)throw Error('备份格式不正确');AppCore.solve(v.input);set(v.input);$('message').textContent='已导入备份，未覆盖本机保存'}catch(err){$('message').textContent='导入失败：'+err.message}finally{$('imports').value=''}};
const cell=x=>'"'+String(x).replace(/^([=+@-])/,"'$1").replace(/"/g,'""')+'"';
$('csv').onclick=()=>{const r=current,rows=[['类型','句/词','总词次','生词词次','生词占比%','判定','涉及词','出现次数','能听懂句数','所用词数'],
 ...r.sentences.map(s=>['句子',s.index,s.n,s.unknown,pct(s.pct),s.pass?'能听懂':'未达标',s.unknownWords.join(' / '),'','','']),
 ...r.marginal.map(m=>['生词',m.word,'','','','','',m.freq,m.soloDelta,'']),
 ['路线','精确最优','','','','达标','',(r.exact||{}).gain,(r.exact||{}).passCount,(r.exact||{}).size],
 ['路线','预算内最优','','','',r.budgetReached?'达标':'未达标','',(r.budget||{}).gain,(r.budget||{}).passCount,(r.budget||{}).size],
 ['路线','频次前'+r.k,'','','',r.topK.passCount>=r.targetCount?'达标':'未达标',r.topK.words.join(' / '),r.topK.gain,r.topK.passCount,r.topK.size],
 ['路线','贪心','','','',r.stuck?'平台期':'达标',r.greedyWords.join(' / '),r.greedy.gain,r.greedy.passCount,r.greedyWords.length]];
 dl('词面覆盖-明细.csv','\ufeff'+rows.map(row=>row.map(cell).join(',')).join('\r\n'),'text/csv;charset=utf-8')};
function report(){const r=current,ex=r.exact;return '# 词面覆盖台 · 对账说明\n\n每句生词上限 '+r.q+'%，目标听懂句占比 '+r.g+'%（需 '+r.targetCount+'/'+r.M+' 句），学习预算 '+r.k+' 个词。\n\n'+
 '词次覆盖率 '+pct(r.tokenCover)+'%（'+r.knownTokens+'/'+r.totalTokens+' 词次），种类覆盖率 '+pct(r.typeCover)+'%（'+r.knownTypes+'/'+r.totalTypes+' 种）；当前能听懂 '+r.baseline+'/'+r.M+' 句。不同生词 '+r.U+' 种，共枚举 '+r.subsets+' 个补词组合。\n\n'+
 '## 结论\n'+(ex?'达到目标最少再学 '+ex.size+' 个词：'+ex.words.join('、')+'。学会后能听懂 '+ex.passCount+'/'+r.M+' 句，词次覆盖率升至 '+pct(r.afterCover)+'%。'+(r.budgetReached?'预算 '+r.k+' 个词够用。':'预算 '+r.k+' 个词不足。'):'无满足条件的补词组合。')+'\n\n'+
 '## 逐句\n'+r.sentences.map(s=>'- 第 '+s.index+' 句：'+s.n+' 词次，生词 '+s.unknown+'（'+pct(s.pct)+'%），'+(s.pass?'能听懂':'未达标')+'；生词 '+(s.unknownWords.join('、')||'无')+'。原文：'+s.text).join('\n')+'\n\n'+
 '## 生词边际（单独学会该词的句数增量，不可相加）\n'+r.marginal.map(m=>'- '+m.word+'：出现 '+m.freq+' 次，单独学 +'+m.soloDelta+' 句，涉及第 '+m.sentences.join('、')+' 句').join('\n')+'\n\n'+
 '## 四条路线\n- 精确最优：'+(ex?ex.words.join('、')+'，'+ex.size+' 词，'+ex.passCount+'/'+r.M+' 句':'无解')+'\n- 预算内最优：'+(r.budget?r.budget.words.join('、')+'，'+r.budget.size+' 词，'+r.budget.passCount+'/'+r.M+' 句':'无')+'\n- 频次前 '+r.k+'：'+(r.topK.words.join('、')||'空')+'，'+r.topK.passCount+'/'+r.M+' 句\n- 贪心：'+(r.greedyWords.join('、')||'空')+'，'+r.greedy.passCount+'/'+r.M+' 句'+(r.stuck?'，遇平台期（再无单词能提升）':'')+'\n\n'+
 '模型：仅统计拉丁字母 token，统一小写，不查词典、不处理词形变化。一句能听懂当且仅当 生词词次×100 ≤ '+r.q+'×本句总词次；目标达成当且仅当 能听懂句数×100 ≥ '+r.g+'×总句数。精确解由 2^'+r.U+' 全子集枚举得到，不是贪心近似。默认数据为虚构示例；不预测真实听力或词汇量，不提供语言学习结论。计算在本机完成，未上传输入。';}
$('md').onclick=()=>dl('词面覆盖-说明.md',report(),'text/markdown;charset=utf-8');
$('png').onclick=()=>{const r=current,ex=r.exact,c=document.createElement('canvas');c.width=1080;c.height=1350;const g=c.getContext('2d');
 g.fillStyle='#f1f5fa';g.fillRect(0,0,1080,1350);g.fillStyle='#22344e';g.font='bold 52px sans-serif';g.fillText('词面覆盖台',60,100);
 g.font='25px sans-serif';g.fillStyle='#5a6d84';g.fillText('每句生词上限 '+r.q+'% · 目标 '+r.g+'% · 预算 '+r.k+' 词',60,152);
 g.font='bold 40px sans-serif';g.fillStyle=r.budgetReached?'#2b6b4f':'#a23b28';g.fillText(r.baseline>=r.targetCount?'当前已达到目标':(r.budgetReached?'预算内可以达标':'预算内无法达标'),60,222);
 g.font='bold 34px sans-serif';g.fillStyle='#22344e';g.fillText('最少再学 '+(ex?ex.size:'—')+' 个词',60,278);
 g.font='24px sans-serif';g.fillStyle='#5a6d84';g.fillText('词次覆盖 '+pct(r.tokenCover)+'% · 当前能听懂 '+r.baseline+'/'+r.M+' 句 · 生词 '+r.U+' 种',60,325);
 // 覆盖条
 const bw=940,bx=60,by=355;g.fillStyle='#ffffff';g.fillRect(bx,by,bw,30);g.fillStyle='#6aa58a';g.fillRect(bx,by,bw*r.tokenCover/100,30);g.fillStyle='#d98a70';g.fillRect(bx+bw*r.tokenCover/100,by,bw*(100-r.tokenCover)/100,30);g.strokeStyle='#c9d7e6';g.lineWidth=2;g.strokeRect(bx,by,bw,30);
 g.font='20px sans-serif';g.fillStyle='#61738a';g.fillText('绿=已认识 '+r.knownTokens+' 词次 · 橙=生词 '+(r.totalTokens-r.knownTokens)+' 词次',60,by+58);
 // 精确词集
 let y=by+110;g.fillStyle='#22344e';g.font='bold 28px sans-serif';g.fillText('达到目标的精确最少词集',60,y);
 let wx=60;const wy=y+20;
 if(ex&&ex.words.length){ex.words.forEach(w=>{g.font='bold 26px sans-serif';const tw=g.measureText(w).width+28;if(wx+tw>1020){wx=60;g.fillText('',0,0)}g.fillStyle='#2d5f96';g.fillRect(wx,wy,tw,44);g.fillStyle='#ffffff';g.fillText(w,wx+14,wy+31);wx+=tw+12});}else{g.font='24px sans-serif';g.fillStyle='#a23b28';g.fillText('无解',60,wy+31)}
 const cy=wy+80;g.font='22px sans-serif';g.fillStyle='#22344e';g.fillText('枚举 '+num(r.subsets)+' 个组合 · 学会后能听懂 '+(ex?ex.passCount:'—')+'/'+r.M+' 句 · 覆盖率升至 '+pct(r.afterCover)+'%',60,cy);
 // 路线对照
 let ry=cy+55;g.fillStyle='#22344e';g.font='bold 28px sans-serif';g.fillText('四条路线对照',60,ry);g.font='22px sans-serif';
 const routes=[['精确最优',ex?ex.size+' 词 / '+ex.passCount+' 句':'-',r.budgetReached],['预算内最优',r.budget?r.budget.size+' 词 / '+r.budget.passCount+' 句':'-',r.budgetReached],['频次前 '+r.k,r.topK.size+' 词 / '+r.topK.passCount+' 句',r.topK.passCount>=r.targetCount],['贪心'+(r.stuck?'（平台期）':''),r.greedyWords.length+' 词 / '+r.greedy.passCount+' 句',r.greedy.passCount>=r.targetCount]];
 routes.forEach((o,i)=>{const yy=ry+42+i*44;g.fillStyle=o[2]?'#2b6b4f':'#a23b28';g.fillText((o[2]?'● ':'○ ')+o[0]+'：'+o[1],60,yy)});
 // 逐句
 let sy=ry+42+routes.length*44+34;g.fillStyle='#22344e';g.font='bold 28px sans-serif';g.fillText('逐句对账',60,sy);g.font='21px sans-serif';
 r.sentences.forEach((s,i)=>{const yy=sy+40+i*38;g.fillStyle=s.pass?'#2b6b4f':'#a23b28';g.fillText((s.pass?'✓ ':'✗ ')+'第 '+s.index+' 句：'+s.n+' 词次 / 生词 '+s.unknown+'（'+pct(s.pct)+'%）',60,yy)});
 g.fillStyle='#63738a';g.font='19px sans-serif';g.fillText('仅统计拉丁字母词次，不查词典、不预测真实听力；「能听懂」是模型标记。',60,1290);g.fillText('默认数据为虚构示例；计算在本机完成，未上传输入。V1.0.0',60,1320);
 c.toBlob(b=>{if(b)dl('词面覆盖-结果卡.png',b,'image/png')})};
set(demo);restore();
