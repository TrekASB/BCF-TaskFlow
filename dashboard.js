(()=>{'use strict';
const q=s=>document.querySelector(s), esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const done=x=>/^(done|closed|completed|resolved|ferdig|lukket)$/i.test(String(x||''));
const status=x=>done(x)?'Ferdig':/^(in progress|pågår|active)$/i.test(String(x||''))?'Pågår':/^(blocked|blokkert)$/i.test(String(x||''))?'Blokkert':'Ny';
const dates=x=>{if(!x)return null;const d=new Date(x);return Number.isFinite(+d)?d:null};
const week=d=>{const x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));x.setUTCDate(x.getUTCDate()+4-(x.getUTCDay()||7));const y=x.getUTCFullYear();return y+'-W'+String(Math.ceil(((x-new Date(Date.UTC(y,0,1)))/86400000+1)/7)).padStart(2,'0')};
const tags=t=>{const v=t.labels??t.topic_labels??t.tags??[];return Array.isArray(v)?v.map(x=>typeof x==='string'?x:x?.name||x?.label||'').filter(Boolean):typeof v==='string'?[v]:[]};
const assignee=x=>{const v=x||'';return typeof v==='string'?(v||'Ikke tildelt'):(v.email||v.name||'Ikke tildelt')};
const percent=t=>[0,25,50,75,100].includes(Number(t.completion))?Number(t.completion):(done(t.status)?100:0);
const weight=t=>{const w=Number(t.weight);return Number.isFinite(w)&&w>0?w:1};
const progress=ts=>ts.length?Math.round(ts.reduce((s,t)=>s+weight(t)*percent(t),0)/ts.reduce((s,t)=>s+weight(t),0)):null;
let active='topic',filter={from:'',to:'',tag:'',user:''},charts=[];
const COLORS=['#0c66e4','#e8440a','#21895e','#f5b400','#8b5cf6','#0891b2','#bd185d','#4d7c0f'];
const count=(rows,fn)=>{const m=new Map();for(const x of rows){for(const k of fn(x))m.set(k,(m.get(k)||0)+1)}return [...m].sort((a,b)=>b[1]-a[1])};
const opts=(vals,sel)=>'<option value="">(alle)</option>'+vals.map(v=>'<option value="'+esc(v)+'" '+(sel===v?'selected':'')+'>'+esc(v)+'</option>').join('');
const card=(title,content,hint='')=>'<section class="bd-card"><h3>'+esc(title)+'</h3>'+(hint?'<p class="meta">'+esc(hint)+'</p>':'')+content+'</section>';
const placeholder=id=>'<div class="bd-chart-box"><canvas id="'+id+'"></canvas></div>';
const table=(headers,rows)=>'<div class="bd-overflow"><table class="bd-table"><thead><tr>'+headers.map(s=>'<th>'+esc(s)+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
const tr=cells=>'<tr>'+cells.map(x=>'<td>'+x+'</td>').join('')+'</tr>';
function createChart(id,type,labels,datasets,options={}){
 const canvas=document.getElementById(id);if(!canvas)return;
 if(!window.Chart){canvas.replaceWith(Object.assign(document.createElement('p'),{textContent:'Diagram-biblioteket kunne ikke lastes.'}));return}
 const chart=new Chart(canvas,{type,data:{labels,datasets:datasets.map((d,i)=>({...d,backgroundColor:d.backgroundColor??(type==='pie'?COLORS:COLORS[i%COLORS.length]),borderColor:d.borderColor??COLORS[i%COLORS.length],borderWidth:1}))},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:datasets.length>1||type==='pie',position:'top'},datalabels:{display:type==='pie',color:'#fff',font:{weight:'bold'},formatter:(v,ctx)=>{const total=ctx.dataset.data.reduce((a,b)=>a+b,0);return total&&v?Math.round(v/total*100)+'%':''}}},scales:type==='pie'?{}:{y:{beginAtZero:true,ticks:{precision:0}},x:{ticks:{maxRotation:45}}},...options}});
 charts.push(chart);
}
function drawBars(id,rows,label){createChart(id,'bar',rows.map(x=>x[0]),[{label,data:rows.map(x=>x[1])}])}
function drawPie(id,rows){createChart(id,'pie',rows.map(x=>x[0]),[{data:rows.map(x=>x[1])}])}
function render(topics,parse,onOpen,projectName){
 const root=q('#dashboard');if(!root)return;
 for(const c of charts)c.destroy();charts=[];
 const parents=topics.map(t=>{let ts=[];try{ts=parse(t).tasks||[]}catch{}return {kind:'parent',id:t.guid,parentId:t.guid,title:t.title||'Uten tittel',owner:assignee(t.assigned_to),fags:tags(t),status:status(t.topic_status),rawStatus:t.topic_status||'',priority:t.priority||'Ikke angitt',type:t.topic_type||'Hovedsak',created:dates(t.creation_date||t.created_at),closed:dates(t.closed_date||t.resolved_date),due:dates(t.due_date),tasks:ts,p:progress(ts)}});
 const children=parents.flatMap(p=>p.tasks.map(t=>({kind:'child',id:t.id,parentId:p.id,title:t.title||'Uten tittel',parentTitle:p.title,owner:assignee(t.assignee),fags:t.discipline?[t.discipline]:p.fags,status:t.blocked?'Blokkert':percent(t)===100?'Ferdig':status(t.status),rawStatus:t.status||'New',priority:t.priority||p.priority,type:'Underoppgave',created:dates(t.createdAt||t.creationDate),closed:dates(t.closedAt||t.completedAt),due:dates(t.dueDate),p:percent(t),weight:weight(t)})));
 const all=[...parents,...children];
 const weeks=[...new Set(all.map(x=>x.created?week(x.created):null).filter(Boolean))].sort();
 const fags=[...new Set(all.flatMap(x=>x.fags))].sort(),users=[...new Set(all.map(x=>x.owner))].sort();
 const selected=all.filter(x=>(!filter.tag||x.fags.includes(filter.tag))&&(!filter.user||x.owner===filter.user)&&(!filter.from||x.created&&week(x.created)>=filter.from)&&(!filter.to||x.created&&week(x.created)<=filter.to));
 const p=selected.filter(x=>x.kind==='parent'),c=selected.filter(x=>x.kind==='child');
 root.innerHTML='<div class="bd-controls"><span class="bd-filtername">PERIODE</span><label>Fra uke <select id="bdFrom">'+opts(weeks,filter.from)+'</select></label><label>Til uke <select id="bdTo">'+opts(weeks,filter.to)+'</select></label><label>FAG <select id="bdTag">'+opts(fags,filter.tag)+'</select></label><label>ASSIGNEE <select id="bdUser">'+opts(users,filter.user)+'</select></label><button id="bdReset">Nullstill</button><button id="bdPrint">Skriv ut</button></div>'+
 '<div class="bd-tabs">'+[['topic','Topic dashboard'],['vdc','VDC dashboard'],['assignee','Assignee dashboard']].map(([k,l])=>'<button class="'+(active===k?'on':'')+'" data-bdtab="'+k+'">'+l+'</button>').join('')+'</div>'+
 '<div class="bd-heading">'+(active==='topic'?'FAG & OVERSIKT':active==='vdc'?'ANALYSE & KPI':'ASSIGNEE STATISTIKK')+' <span>'+esc(projectName||'')+'</span></div>'+
 '<div class="bd-stats">'+[['ALLE SAKER',selected.length],['HOVEDSAKER',p.length],['UNDEROPPGAVER',c.length],['ÅPNE SAKER',selected.filter(x=>x.status!=='Ferdig').length],['FERDIGE SAKER',selected.filter(x=>x.status==='Ferdig').length],['UNDEROPPGAVER – FREMDRIFT',c.length?Math.round(c.reduce((sum,x)=>sum+x.weight*x.p,0)/c.reduce((sum,x)=>sum+x.weight,0))+' %':'–']].map(([name,value])=>'<div class="bd-stat"><small>'+name+'</small><b>'+value+'</b></div>').join('')+'</div>'+
 '<div id="bdContent"></div>';
 const content=q('#bdContent');
 const overview=(rows,prefix)=>'<div class="bd-two">'+card(prefix+' – status',placeholder(prefix+'Status'))+card(prefix+' – fagfordeling',placeholder(prefix+'Fag'))+'</div>';
 if(active==='topic'){
  content.innerHTML=card('Alle saker – fagfordeling',placeholder('allPie'),'Hovedsaker og underoppgaver samlet')+
    card('Alle saker – status per fag',placeholder('tagStatus'),'Antall fra begge nivåer, gruppert etter fag')+
    overview(p,'parent')+overview(c,'child');
  drawPie('allPie',count(selected,x=>x.fags.length?x.fags:['Uten fag']));
  const names=[...new Set(selected.flatMap(x=>x.fags.length?x.fags:['Uten fag']))].sort(),st=['Ny','Pågår','Blokkert','Ferdig'];
  createChart('tagStatus','bar',names,st.map((k,i)=>({label:k,data:names.map(n=>selected.filter(x=>x.status===k&&(x.fags.length?x.fags:['Uten fag']).includes(n)).length),backgroundColor:COLORS[i]})),{scales:{x:{stacked:true},y:{stacked:true,beginAtZero:true,ticks:{precision:0}}}});
  for(const [rows,name] of [[p,'parent'],[c,'child']]){drawBars(name+'Status',count(rows,x=>[x.status]));drawPie(name+'Fag',count(rows,x=>x.fags.length?x.fags:['Uten fag']))}
 }else if(active==='vdc'){
  content.innerHTML='<div class="bd-two">'+card('Alle saker – status',placeholder('allStatus'))+card('Alle saker – prioritet',placeholder('allPriority'))+card('Hovedsaker – status',placeholder('parentStatus'))+card('Underoppgaver – status',placeholder('childStatus'))+card('Hovedsaker – prioritet',placeholder('parentPriority'))+card('Underoppgaver – prioritet',placeholder('childPriority'))+card('Created vs Closed – hovedsaker',placeholder('parentFlow'),'Historikk krever faktiske opprettet- og lukkedatoer')+card('Created vs Closed – underoppgaver',placeholder('childFlow'),'Historikk vises bare når underoppgaver har egne livsløpsdatoer')+'</div>';
  drawBars('allStatus',count(selected,x=>[x.status]));drawBars('allPriority',count(selected,x=>[x.priority]));
  for(const [rows,name] of [[p,'parent'],[c,'child']]){
   drawBars(name+'Status',count(rows,x=>[x.status]));drawBars(name+'Priority',count(rows,x=>[x.priority]));
   const weekly=new Map();
   for(const x of rows){for(const [d,key] of [[x.created,'created'],[x.closed,'closed']]){if(!d)continue;const w=week(d),val=weekly.get(w)||{created:0,closed:0};val[key]++;weekly.set(w,val)}}
   const w=[...weekly].sort((a,b)=>a[0].localeCompare(b[0]));
   createChart(name+'Flow','bar',w.map(x=>x[0]),[{label:'Opprettet',data:w.map(x=>x[1].created)},{label:'Lukket',data:w.map(x=>x[1].closed)}]);
  }
 }else{
  content.innerHTML='<div class="bd-two">'+card('Alle saker – per ansvarlig',placeholder('allOwners'))+card('Alle saker – status',placeholder('ownersStatus'))+card('Hovedsaker – per ansvarlig',placeholder('parentOwners'))+card('Underoppgaver – per ansvarlig',placeholder('childOwners'))+'</div>';
  drawBars('allOwners',count(selected,x=>[x.owner]));drawBars('ownersStatus',count(selected,x=>[x.status]));
  drawBars('parentOwners',count(p,x=>[x.owner]));drawBars('childOwners',count(c,x=>[x.owner]));
 }
 const treeRows=p.flatMap(parent=>[tr(['<button class="bd-open" data-open="'+esc(parent.id)+'">'+esc(parent.title)+'</button>',esc(parent.status),esc(parent.owner),'Hovedsak']),...c.filter(x=>x.parentId===parent.id).map(x=>tr(['↳ '+esc(x.title),esc(x.status),esc(x.owner),'Underoppgave']))]);
 const childOrphans=c.filter(x=>!p.some(parent=>parent.id===x.parentId)).map(x=>tr(['↳ '+esc(x.title)+' ('+esc(x.parentTitle)+')',esc(x.status),esc(x.owner),'Underoppgave']));
 content.insertAdjacentHTML('beforeend',card('Hovedsaker og underoppgaver',table(['Oppgave','Status','Ansvarlig','Nivå'],[...treeRows,...childOrphans]),'Oppgaver vises i hierarki, og samlet statistikk teller begge nivåer.'));
 content.insertAdjacentHTML('beforeend','<p class="meta bd-foot">Alle saker = hovedsaker + underoppgaver. Fag kan føre til at en sak inngår i flere faggrupper. Historikk for underoppgaver krever egne opprettelses- og lukkedatoer.</p>');
 root.querySelectorAll('[data-open]').forEach(el=>el.onclick=()=>onOpen(el.dataset.open));
 root.querySelectorAll('[data-bdtab]').forEach(el=>el.onclick=()=>{active=el.dataset.bdtab;render(topics,parse,onOpen,projectName)});
 for(const [key,target] of [['from','bdFrom'],['to','bdTo'],['tag','bdTag'],['user','bdUser']])q('#'+target).onchange=e=>{filter[key]=e.target.value;render(topics,parse,onOpen,projectName)};
 q('#bdReset').onclick=()=>{filter={from:'',to:'',tag:'',user:''};render(topics,parse,onOpen,projectName)};
 q('#bdPrint').onclick=()=>window.print();
}
window.BCFTaskFlowDashboard={render};
})();