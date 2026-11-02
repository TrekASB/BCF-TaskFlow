(()=>{'use strict';
const $=s=>document.querySelector(s), E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const done=s=>/^(closed|done|completed|resolved|ferdig|lukket)$/i.test(String(s||''));
const norm=s=>done(s)?'Ferdig':/^(in progress|pågår|active)$/i.test(String(s||''))?'Pågår':'Ny';
const date=v=>{if(!v)return null;const d=new Date(v);return Number.isFinite(d.getTime())?d:null};
const week=d=>{const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));t.setUTCDate(t.getUTCDate()+4-(t.getUTCDay()||7));const y=t.getUTCFullYear();const jan=new Date(Date.UTC(y,0,1));return y+'-W'+String(Math.ceil((((t-jan)/86400000)+1)/7)).padStart(2,'0')};
const tags=t=>{const v=t.labels??t.topic_labels??t.tags??[];return Array.isArray(v)?v.map(x=>typeof x==='string'?x:(x?.name||x?.label||'')).filter(Boolean):typeof v==='string'&&v?[v]:[]};
const assignee=t=>{const a=t.assigned_to??t.assignee??'';return typeof a==='string'?(a||'Ikke tildelt'):(a?.email||a?.name||'Ikke tildelt')};
const weight=t=>Math.max(1,Math.min(10,Number(t.weight)||1));
const pct=t=>[0,25,50,75,100].includes(Number(t.completion))?Number(t.completion):(done(t.status)?100:0);
const progress=ts=>ts.length?Math.round(ts.reduce((s,t)=>s+weight(t)*pct(t),0)/ts.reduce((s,t)=>s+weight(t),0)):null;
let active='topic',filterWeekFrom='',filterWeekTo='',filterTag='',filterAssignee='';
function group(rows,fn){const m=new Map();rows.forEach(r=>{for(const k of fn(r))m.set(k,(m.get(k)||0)+1)});return [...m].sort((a,b)=>b[1]-a[1])}
function bar(rows){const max=Math.max(1,...rows.map(r=>r[1]));return rows.length?rows.map(([k,v])=>'<div class="bd-bar"><span title="'+E(k)+'">'+E(k)+'</span><div class="bd-track"><div style="width:'+100*v/max+'%"></div></div><strong>'+v+'</strong></div>').join(''):'<p class="meta">Ingen data for valgt filter.</p>'}
function chartBars(values,colors){const max=Math.max(1,...values.map(x=>x[1]));return '<div class="bd-colchart">'+values.map(([label,n],i)=>'<div class="bd-colitem"><b>'+n+'</b><div class="bd-colbox"><div style="height:'+n/max*100+'%;background:'+(colors?.[i%colors.length]||'#0c66e4')+'"></div></div><small>'+E(label)+'</small></div>').join('')+'</div>'}
function card(title,content,hint=''){return '<section class="bd-card"><h3>'+title+'</h3>'+(hint?'<p class="meta">'+hint+'</p>':'')+content+'</section>'}
function table(headers,rows){return '<div class="bd-overflow"><table class="bd-table"><thead><tr>'+headers.map(x=>'<th>'+E(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>'}
function row(cells){return '<tr>'+cells.map(x=>'<td>'+x+'</td>').join('')+'</tr>'}
function render(topics,parse,open,project){
const root=$('#dashboard');if(!root)return;
const raw=topics.map(t=>{let ts=[];try{ts=parse(t).tasks||[]}catch{}return {t,ts,tag:tags(t),owner:assignee(t),st:norm(t.topic_status),pr:t.priority||'Ikke angitt',created:date(t.creation_date||t.created_at),closed:date(t.closed_date||t.resolved_date),due:date(t.due_date),p:progress(ts)}});
const weeks=[...new Set(raw.map(r=>r.created?week(r.created):null).filter(Boolean))].sort();
const allTags=[...new Set(raw.flatMap(r=>r.tag))].sort(),allOwners=[...new Set(raw.map(r=>r.owner))].sort();
const opt=(items,current,all)=>'<option value="">'+all+'</option>'+items.map(x=>'<option value="'+E(x)+'" '+(x===current?'selected':'')+'>'+E(x)+'</option>').join('');
const selected=raw.filter(r=>(!filterTag||r.tag.includes(filterTag))&&(!filterAssignee||r.owner===filterAssignee)&&(!filterWeekFrom||r.created&&week(r.created)>=filterWeekFrom)&&(!filterWeekTo||r.created&&week(r.created)<=filterWeekTo));
const subs=selected.flatMap(r=>r.ts);const p=progress(subs);
const kpis=[['Totale saker',selected.length],['Åpne saker',selected.filter(r=>r.st!=='Ferdig').length],['Lukkede saker',selected.filter(r=>r.st==='Ferdig').length],['Underoppgaver',subs.length],['Vektet fremdrift',p===null?'–':p+' %'],['Klare til lukking',selected.filter(r=>r.st!=='Ferdig'&&r.ts.length&&r.p===100).length]];
root.innerHTML='<div class="bd-controls"><span class="bd-filtername">PERIODE</span><label>Fra uke <select id="bdFrom">'+opt(weeks,filterWeekFrom,'(alle)')+'</select></label><label>Til uke <select id="bdTo">'+opt(weeks,filterWeekTo,'(alle)')+'</select></label><label>FAG <select id="bdTag">'+opt(allTags,filterTag,'(alle)')+'</select></label><label>ASSIGNEE <select id="bdUser">'+opt(allOwners,filterAssignee,'(alle)')+'</select></label><button id="bdReset">Nullstill</button><button id="bdPrint">Skriv ut</button></div>'+
'<div class="bd-tabs">'+[['topic','Topic dashboard'],['vdc','VDC dashboard'],['assignee','Assignee dashboard']].map(([id,n])=>'<button class="'+(id===active?'on':'')+'" data-bdtab="'+id+'">'+n+'</button>').join('')+'</div>'+
'<div class="bd-heading">'+(active==='topic'?'FAG & OVERSIKT':active==='vdc'?'ANALYSE & KPI':'ASSIGNEE STATISTIKK')+' <span>'+E(project||'')+' · '+selected.length+' av '+raw.length+' saker</span></div>'+
'<div id="bdContent"></div>';
const statusGroups=group(selected,r=>[r.st]),tagGroups=group(selected,r=>r.tag.length?r.tag:['Uten fag/tag']);
const openLink=r=>'<button class="bd-open" data-open="'+E(r.t.guid)+'">'+E(r.t.title||'Uten tittel')+'</button>';
if(active==='topic'){
 const tagStatus=tagGroups.map(([name,total])=>{const sub=selected.filter(r=>(r.tag.length?r.tag:['Uten fag/tag']).includes(name));return row([E(name),total,sub.filter(r=>r.st==='Ferdig').length,sub.filter(r=>r.st==='Pågår').length,sub.filter(r=>r.st==='Ny').length])});
 $('#bdContent').innerHTML='<div class="bd-two">'+card('Fag (Tag) – hovedfordeling',bar(tagGroups),'Saker per fag. En sak kan ha flere fag.')+card('Fag (Tag) – detaljer per status',table(['Fag','Totalt','Ferdig','Pågår','Ny'],tagStatus),'Klikk på en fagruppe i filteret for å avgrense rapporten.')+'</div>'+card('Hovedsaker – fremdrift',table(['Sak','Fag','Ansvarlig','Status','Underoppgaver','Fremdrift'],selected.map(r=>row([openLink(r),E(r.tag.join(', ')||'–'),E(r.owner),E(r.t.topic_status),r.ts.length,r.p===null?'–':r.p+' %']))));
}else if(active==='vdc'){
 const w=new Map();for(const r of selected){if(r.created){const k=week(r.created),x=w.get(k)||{created:0,closed:0};x.created++;w.set(k,x)}if(r.st==='Ferdig'&&r.closed){const k=week(r.closed),x=w.get(k)||{created:0,closed:0};x.closed++;w.set(k,x)}}const allWeeks=[...w].sort((a,b)=>a[0].localeCompare(b[0]));const missing=selected.filter(r=>r.st==='Ferdig'&&!r.closed).length;
 const age=selected.filter(r=>r.st!=='Ferdig'&&r.created).map(r=>Math.max(0,Math.floor((Date.now()-r.created)/86400000)));
 const summaries=kpis.map(([k,v])=>'<div class="bd-stat"><small>'+E(k)+'</small><b>'+E(v)+'</b></div>').join('');
 const createdRows=allWeeks.map(([k,v])=>row([E(k),v.created,v.closed]));
 $('#bdContent').innerHTML='<div class="bd-stats">'+summaries+'</div><div class="bd-two">'+card('Status – hovedsaker',chartBars(statusGroups,['#579dff','#f5b800','#22a06b']))+card('Priority – hovedsaker',bar(group(selected,r=>[r.pr])))+card('Created vs Closed – per uke',table(['Uke','Opprettet','Lukket'],createdRows),missing?missing+' lukkede saker mangler sikker lukkedato.':'Basert på opprettetdato og faktisk lukkedato.')+card('WIP og Backlog',bar([['WIP – pågår',selected.filter(r=>r.st==='Pågår').length],['Backlog – ny/åpen',selected.filter(r=>r.st==='Ny').length]]),'Nåværende status, ikke historisk WIP. Gjennomsnittlig alder åpne: '+(age.length?Math.round(age.reduce((a,b)=>a+b,0)/age.length)+' dager':'Ukjent'))+'</div>';
}else{
 const owners=group(selected,r=>[r.owner]);
 const matrix=owners.map(([name,n])=>{const list=selected.filter(r=>r.owner===name);return row([E(name),n,list.filter(r=>r.st==='Ny').length,list.filter(r=>r.st==='Pågår').length,list.filter(r=>r.st==='Ferdig').length])});
 const dates=group(selected.filter(r=>r.created),r=>[week(r.created)]);
 $('#bdContent').innerHTML='<div class="bd-two">'+card('Saker per Assignee',bar(owners),'Arbeidsmengde per ansvarlig')+card('Assignee: Status-fordeling',table(['Ansvarlig','Totalt','Ny','Pågår','Ferdig'],matrix))+card('Assignee: Saker over tid',bar(dates),'Opprettede saker per uke for valgt bruker/fag')+card('Gjennomsnittlig cycle time', '<p class="meta">Beregnes ikke uten pålitelige datoer for både opprettelse og lukking. Ingen estimater fra siste endringsdato.</p>')+'</div>'+card('Ansvarlig – detaljert oversikt',table(['Sak','Status','Fag','Prioritet','Fremdrift'],selected.map(r=>row([openLink(r),E(r.t.topic_status),E(r.tag.join(', ')||'–'),E(r.pr),r.p===null?'–':r.p+' %']))));
}
// Jira-inspired parent/subtask overview. Parent issues count once; child progress remains separate.
 const treeRows=selected.flatMap(r=>[
  row(['<strong>▣ '+openLink(r)+'</strong>',E(r.t.topic_status||'–'),E(r.owner),r.p===null?'–':r.p+' %','Hovedsak']),
  ...r.ts.map(t=>row(['<span class="bd-childrow">↳ '+E(t.title||'Uten tittel')+'</span>',E(t.blocked?'Blokkert':t.status||'Ny'),E(t.assignee||'Ikke tildelt'),E(t.completion??(t.status==='Done'?100:0))+' %','Underoppgave']))
 ]);
 $('#bdContent').insertAdjacentHTML('beforeend',card('Hovedoppgaver og tilhørende underoppgaver',table(['Sak / underoppgave','Status','Ansvarlig','Ferdigstillelse','Nivå'],treeRows),'Hierarkisk oversikt. Hovedsaker og underoppgaver rapporteres på separate nivåer for å unngå dobbeltelling.'));
 root.querySelectorAll('[data-bdtab]').forEach(el=>el.onclick=()=>{active=el.dataset.bdtab;render(topics,parse,open,project)});
root.querySelectorAll('[data-open]').forEach(el=>el.onclick=()=>open(el.dataset.open));
for(const [sel,set] of [['#bdFrom',v=>filterWeekFrom=v],['#bdTo',v=>filterWeekTo=v],['#bdTag',v=>filterTag=v],['#bdUser',v=>filterAssignee=v]])$(sel).onchange=e=>{set(e.target.value);render(topics,parse,open,project)};
$('#bdReset').onclick=()=>{filterWeekFrom='';filterWeekTo='';filterTag='';filterAssignee='';render(topics,parse,open,project)};
$('#bdPrint').onclick=()=>window.print();
}
window.BCFTaskFlowDashboard={render};
})();