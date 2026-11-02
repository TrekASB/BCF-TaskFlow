/* BCFTaskFlow leadership dashboard, read-only. Uses existing topic data and TaskFlow subtasks. */
(()=>{'use strict';
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const done=s=>/^(done|closed|completed|resolved|ferdig|lukket)$/i.test(String(s||'').trim());
const stage=s=>done(s)?'Ferdig':/^(in progress|pågår|active|under arbeid)$/i.test(String(s||'').trim())?'Pågår':'Åpen';
const weight=t=>{const n=Number(t.weight);return Number.isFinite(n)&&n>0?n:1};
const completion=t=>t.completion!==undefined&&[0,25,50,75,100].includes(Number(t.completion))?Number(t.completion):(done(t.status)?100:0);
const progress=tasks=>tasks.length?Math.round(tasks.reduce((sum,t)=>sum+weight(t)*completion(t),0)/tasks.reduce((sum,t)=>sum+weight(t),0)):null;
function getTags(t){const raw=t.labels??t.topic_labels??t.tags??[];return Array.isArray(raw)?raw.map(v=>typeof v==='string'?v:v?.name||v?.label||'').filter(Boolean):typeof raw==='string'?[raw]:[]}
function getDate(t){const d=t.due_date||t.dueDate||null;return d?new Date(d):null}
function summary(topics,parse){const data=topics.map(t=>{let tasks=[];try{tasks=parse(t).tasks||[]}catch{}return {topic:t,tasks,p:progress(tasks),stage:stage(t.topic_status),tags:getTags(t),priority:t.priority||'Ikke angitt',due:getDate(t)}});return data}
function barGroup(data,labelFn){const map=new Map();data.forEach(x=>{const values=labelFn(x);for(const v of values){map.set(v,(map.get(v)||0)+1)}});return [...map].sort((a,b)=>b[1]-a[1]).slice(0,8)}
function bars(data){const max=Math.max(1,...data.map(x=>x[1]));return data.length?data.map(([name,val])=>'<div class="db-barline"><span title="'+E(name)+'">'+E(name)+'</span><div class="db-track"><div style="width:'+val/max*100+'%"></div></div><b>'+val+'</b></div>').join(''):'<p class="meta">Ingen registrerte data.</p>'}

// VDC snapshot metrics. Historical flow metrics require reliable lifecycle timestamps.
function vdcMetrics(data){
 const open=data.filter(d=>d.stage!=='Ferdig');
 const wip=open.filter(d=>d.stage==='Pågår');
 const backlog=open.filter(d=>d.stage!=='Pågår');
 const created= data.filter(d=>Number.isFinite(new Date(d.topic.creation_date||d.topic.created_at).getTime()));
 const closed=data.filter(d=>d.stage==='Ferdig'&&Number.isFinite(new Date(d.topic.closed_date||d.topic.resolved_date).getTime()));
 const missingClosure=data.filter(d=>d.stage==='Ferdig').length-closed.length;
 const weekly=new Map();
 const weekKey=dt=>{const a=new Date(Date.UTC(dt.getFullYear(),dt.getMonth(),dt.getDate()));const n=a.getUTCDay()||7;a.setUTCDate(a.getUTCDate()+4-n);const y=a.getUTCFullYear();const start=new Date(Date.UTC(y,0,1));return y+'-U'+String(Math.ceil((((a-start)/86400000)+1)/7)).padStart(2,'0')};
 for(const d of created){const k=weekKey(new Date(d.topic.creation_date||d.topic.created_at));const row=weekly.get(k)||{created:0,closed:0};row.created++;weekly.set(k,row)}
 for(const d of closed){const k=weekKey(new Date(d.topic.closed_date||d.topic.resolved_date));const row=weekly.get(k)||{created:0,closed:0};row.closed++;weekly.set(k,row)}
 const weeklyRows=[...weekly].sort((a,b)=>a[0].localeCompare(b[0])).slice(-12);
 return {wip:wip.length,backlog:backlog.length,missingClosure,weeklyRows,
 aging:open.map(d=>{const dt=new Date(d.topic.creation_date||d.topic.created_at);return Number.isFinite(dt.getTime())?Math.max(0,Math.floor((Date.now()-dt.getTime())/86400000)):null}).filter(x=>x!==null),
 assignees:barGroup(data,d=>[String(d.topic.assigned_to||'Uten ansvarlig')])};
}
function render(topics,parse,onOpen,projectName){
 const root=document.getElementById('dashboard');if(!root)return;
 const data=summary(topics,parse),vdc=vdcMetrics(data),all=data.flatMap(d=>d.tasks),withTasks=data.filter(d=>d.tasks.length);
 const totalW=all.reduce((s,t)=>s+weight(t),0),wPct=totalW?Math.round(all.reduce((s,t)=>s+weight(t)*completion(t),0)/totalW):null;
 const completed=all.filter(t=>completion(t)===100).length,blocked=data.filter(d=>d.stage!=='Ferdig'&&d.p===100&&d.tasks.length);
 const now=new Date();now.setHours(0,0,0,0);
 const overdue=data.filter(d=>d.stage!=='Ferdig'&&d.due&&Number.isFinite(d.due.getTime())&&d.due<now);
 const waiting=all.filter(t=>completion(t)===0).length;
 const high=data.filter(d=>/high|critical|høy|kritisk|urgent|haster/i.test(String(d.priority))&&d.stage!=='Ferdig');
 const countStatus=barGroup(data,d=>[d.stage]);const countPriority=barGroup(data,d=>[String(d.priority)]);
 const countTags=barGroup(data,d=>d.tags.length?d.tags:['Uten fag/tag']);
 const focus=data.filter(d=>d.stage!=='Ferdig').sort((a,b)=>{const sa=(overdue.includes(a)?100:0)+(a.p===100?60:0)+(/high|critical|høy|kritisk/i.test(String(a.priority))?30:0);const sb=(overdue.includes(b)?100:0)+(b.p===100?60:0)+(/high|critical|høy|kritisk/i.test(String(b.priority))?30:0);return sb-sa}).slice(0,10);
 root.innerHTML='<div class="db-intro"><div><div class="section-kicker">LEDELSESOVERSIKT</div><h2>Prosjektstatus og leveranser</h2><p class="meta">'+E(projectName||'Trimble Connect')+' · Oppdatert fra tilgjengelige BCF Topics · '+new Date().toLocaleString('nb-NO')+'</p></div><button id="dbPrint">Skriv ut / PDF</button></div>'+
 '<div class="db-kpis">'+[
 ['Hovedsaker',data.length,'BCF Topics'],['Åpne hovedsaker',data.filter(d=>d.stage!=='Ferdig').length,'Ikke lukket'],['Underoppgaver',all.length,completed+' ferdige · '+waiting+' ikke påbegynt'],['Vektet fremdrift',wPct===null?'–':wPct+' %',wPct===null?'Ingen deloppgaver':'Basert på vekt × ferdigstillelse'],['Klar til lukking',blocked.length,'100 % deloppgaver, åpen hovedsak'],['Forfalte hovedsaker',overdue.length,'Kun saker med gyldig frist'],['WIP',vdc.wip,'Pågående hovedsaker'],['Backlog',vdc.backlog,'Åpne, ikke pågående hovedsaker'],['Gj.sn. alder åpne',vdc.aging.length?Math.round(vdc.aging.reduce((a,b)=>a+b,0)/vdc.aging.length)+' d':'–','Fra opprettelsesdato']
 ].map(([name,v,desc])=>'<div class="db-kpi"><span>'+E(name)+'</span><strong>'+E(v)+'</strong><small>'+E(desc)+'</small></div>').join('')+'</div>'+
 '<div class="db-panels"><section class="panel db-panel"><h3>Status på hovedsaker</h3>'+bars(countStatus)+'</section><section class="panel db-panel"><h3>Prioritetsfordeling</h3>'+bars(countPriority)+'</section><section class="panel db-panel"><h3>Fordeling per fag/tag</h3>'+bars(countTags)+'</section><section class="panel db-panel"><h3>Ferdigstillelse</h3><div class="db-big">'+(wPct===null?'–':wPct+' %')+'</div><div class="db-track db-large"><div style="width:'+(wPct||0)+'%"></div></div><p class="meta">Vektet fullføringsgrad for alle underoppgaver. '+withTasks.length+' av '+data.length+' hovedsaker har underoppgaver.</p><p class="meta">Åpen BCF-hovedsak lukkes fortsatt manuelt.</p></section></div>'+
 '<section class="panel db-panel"><h3>VDC – flyt og leveranseevne</h3><div class="db-panels"><div><h3>Created vs Closed · per uke</h3><p class="meta">Opprettetdato og faktisk lukketdato brukes. Lukkede saker uten sluttdato holdes utenfor tidsserien.</p><div class="db-tablewrap"><table class="db-table"><thead><tr><th>Uke</th><th>Opprettet</th><th>Lukket</th></tr></thead><tbody>'+ (vdc.weeklyRows.length?vdc.weeklyRows.map(([week,row])=>'<tr><td>'+E(week)+'</td><td>'+row.created+'</td><td>'+row.closed+'</td></tr>').join(''):'<tr><td colspan="3">Ingen daterte hendelser</td></tr>')+'</tbody></table></div></div><div><h3>Ansvar og arbeidsmengde</h3>'+bars(vdc.assignees)+'<p class="meta">Saker per ansvarlig, basert på BCF assigned_to.</p></div></div><p class="meta">'+(vdc.missingClosure?'OBS: '+vdc.missingClosure+' lukkede saker mangler verifiserbar lukketdato. Historisk WIP, cycle time og gjennomstrømning beregnes derfor ikke.':'Historisk WIP og cycle time krever fullstendige livsløpsdata; disse er ikke inkludert i denne versjonen.')+'</p></section>'+\n '<section class="panel db-panel"><div class="db-section-header"><h3>Oppfølging – hovedsaker som krever oppmerksomhet</h3><span class="meta">'+focus.length+' vist av '+data.filter(d=>d.stage!=='Ferdig').length+' åpne</span></div><div class="db-tablewrap"><table class="db-table"><thead><tr><th>Sak</th><th>Status</th><th>Prioritet</th><th>Fag</th><th>Underoppgaver</th><th>Fremdrift</th><th>Oppfølging</th></tr></thead><tbody>'+
 (focus.length?focus.map(d=>{const reason=overdue.includes(d)?'Forfalt':d.p===100&&d.tasks.length?'Klar til lukking':high.includes(d)?'Høy prioritet':'Pågår / åpen';return '<tr><td><button class="db-link" data-open="'+E(d.topic.guid)+'">'+E(d.topic.title||'Uten tittel')+'</button></td><td>'+E(d.topic.topic_status||'–')+'</td><td>'+E(d.priority)+'</td><td>'+E(d.tags.join(', ')||'–')+'</td><td>'+d.tasks.length+'</td><td>'+(d.p===null?'–':d.p+' %')+'</td><td>'+E(reason)+'</td></tr>'}).join(''):'<tr><td colspan="7">Ingen åpne saker.</td></tr>')+'</tbody></table></div></section>'+
 '<p class="meta db-foot">Tallene er et øyeblikksbilde av tilgjengelige BCF Topics. Underoppgaver telles ikke som egne hovedsaker. «Forfalt» krever fristfelt i API-responsen. Historiske trender og opprettet-vs-lukket vises ikke uten pålitelige historikkdata.</p>';
 root.querySelectorAll('[data-open]').forEach(el=>el.addEventListener('click',()=>onOpen(el.dataset.open)));
 root.querySelector('#dbPrint')?.addEventListener('click',()=>window.print());
}
window.BCFTaskFlowDashboard={render};
})();