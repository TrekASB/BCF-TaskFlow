/* Kanban for BCFTaskFlow. Subtasks remain embedded in parent BCF Topic. */
(()=>{'use strict';
const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const done=t=>Number(t.completion)===100||t.completion===undefined&&t.status==='Done';
const state=t=>done(t)?'Done':t.blocked?'Blocked':t.status==='In Progress'||Number(t.completion)>0?'In Progress':'New';
const colors={New:'#626f86','In Progress':'#0c66e4',Blocked:'#d97706',Done:'#21895e'};
const stages=[['New','Ny'],['In Progress','Pågår'],['Blocked','Blokkert'],['Done','Ferdig']];
let ctx=null,current=null;
const filters={from:'',to:'',discipline:'',assignee:'',parent:''};
function isoWeek(value){if(!value)return '';const d=new Date(value);if(!Number.isFinite(d.getTime()))return '';const x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));x.setUTCDate(x.getUTCDate()+4-(x.getUTCDay()||7));const yr=x.getUTCFullYear(),first=new Date(Date.UTC(yr,0,1));return yr+'-W'+String(Math.ceil(((x-first)/86400000+1)/7)).padStart(2,'0')}
const unique=values=>[...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'nb'));
const opt=(values,current)=>'<option value="">(alle)</option>'+values.map(v=>'<option value="'+E(v)+'" '+(v===current?'selected':'')+'>'+E(v)+'</option>').join('');

function draw(topics,parse,save){
 ctx={topics,parse,save};
 const el=document.getElementById('kanban');if(!el)return;
 const cards=topics.flatMap(p=>{let ts=[];try{ts=parse(p).tasks||[]}catch{}return ts.map(t=>({parent:p,task:t,all:ts}))});
 el.innerHTML='<div class="kb-heading"><div><h2>Kanban – underoppgaver</h2><p class="meta">Rediger kortene direkte. Endringer lagres på hovedsakens BCF Topic.</p></div><label>Hovedsak: <select id="kbParent"><option value="">Alle hovedsaker</option>'+topics.map(p=>'<option value="'+E(p.guid)+'">'+E(p.title)+'</option>').join('')+'</select></label></div><div class="kb-filters"><span>PERIODE</span><label>Fra uke <select id="kbFrom"></select></label><label>Til uke <select id="kbTo"></select></label><label>FAG <select id="kbDiscipline"></select></label><label>ASSIGNEE <select id="kbAssignee"></select></label><button type="button" id="kbReset">Nullstill</button><button type="button" id="kbPrint">Skriv ut</button></div><div id="kbBoard" class="kb-board"></div><dialog id="kbDialog"><form id="kbForm"><h2>Rediger underoppgave</h2><label>Oppgave<input name="title" maxlength="200" required></label><label>Ansvarlig<input name="assignee" maxlength="150" placeholder="Navn eller e-post"></label><label>Fag<input name="discipline" maxlength="80" placeholder="F.eks. VEG"></label><label>Tidsfrist<input name="dueDate" type="date"></label><label>Status<select name="status"><option value="New">Ny</option><option value="In Progress">Pågår</option><option value="Blocked">Blokkert</option><option value="Done">Ferdig</option></select></label><label>Ferdigstillelse<select name="completion">'+[0,25,50,75,100].map(n=>'<option value="'+n+'">'+n+' %</option>').join('')+'</select></label><label>Vekting 1–5<select name="weight">'+Array.from({length:5},(_,i)=>'<option value="'+(i+1)+'">'+(i+1)+'</option>').join('')+'</select></label><label>Avhenger av<select name="dependsOn"><option value="">Ingen avhengighet</option></select></label><label><input name="blocked" type="checkbox"> Blokkert (hindring)</label><label>Beskrivelse av blokkering<textarea name="blockReason" rows="2"></textarea></label><div class="row"><button type="button" id="kbCancel">Avbryt</button><button class="primary" type="submit">Lagre endringer</button></div></form></dialog>';
 const select=el.querySelector('#kbParent'),board=el.querySelector('#kbBoard');
 const weeks=unique(cards.map(c=>isoWeek(c.task.createdAt||c.task.creationDate||c.parent.creation_date||c.parent.created_at)));
 const disciplines=unique(cards.map(c=>c.task.discipline||'Uten fag'));
 const owners=unique(cards.map(c=>c.task.assignee||'Ikke tildelt'));
 const filterInputs=[['kbFrom','from',weeks],['kbTo','to',weeks],['kbDiscipline','discipline',disciplines],['kbAssignee','assignee',owners]];
 for(const [id,key,values] of filterInputs){
  const element=el.querySelector('#'+id);element.innerHTML=opt(values,filters[key]);element.value=filters[key];
  element.onchange=()=>{filters[key]=element.value;redraw()};
 }
 select.value=filters.parent;
 const redraw=()=>{
 const selected=select.value;
 const shown=cards.filter(c=>{
  const t=c.task,week=isoWeek(t.createdAt||t.creationDate||c.parent.creation_date||c.parent.created_at);
  return (!selected||c.parent.guid===selected)&&(!filters.from||week&&week>=filters.from)&&(!filters.to||week&&week<=filters.to)&&(!filters.discipline||(t.discipline||'Uten fag')===filters.discipline)&&(!filters.assignee||(t.assignee||'Ikke tildelt')===filters.assignee);
 });
 board.innerHTML=stages.map(([key,label])=>'<section class="kb-column"><h3 style="border-color:'+colors[key]+'">'+label+' <span>'+shown.filter(c=>state(c.task)===key).length+'</span></h3>'+shown.filter(c=>state(c.task)===key).map(c=>{const t=c.task;const dependency=c.all.find(x=>x.id===t.dependsOn);const overdue=t.dueDate&&!done(t)&&new Date(t.dueDate+'T23:59:59')<new Date();return '<button class="kb-card" type="button" data-parent="'+E(c.parent.guid)+'" data-id="'+E(t.id)+'"><strong>'+E(t.title)+'</strong><small>'+E(c.parent.title)+'</small><div class="kb-chip" style="background:'+colors[key]+'">'+label+'</div><p>'+E(t.assignee||'Ikke tildelt')+' · '+E(t.discipline||'Uten fag')+' · '+E(t.dueDate||'Ingen frist')+(overdue?' · FORFALT':'')+'</p><div class="kb-progress"><div style="width:'+Math.max(0,Math.min(100,Number(t.completion??(done(t)?100:0))))+'%;background:'+colors[key]+'"></div></div><small>Vekt '+E(t.weight||1)+'/5 · '+E(t.completion??(done(t)?100:0))+' %</small>'+(dependency?'<small>Avhenger av: '+E(dependency.title)+'</small>':'')+(t.blocked?'<small>Hindring: '+E(t.blockReason||'Ikke beskrevet')+'</small>':'')+'</button>'}).join('')+'</section>').join('');
 board.querySelectorAll('[data-id]').forEach(btn=>btn.onclick=()=>open(btn.dataset.parent,btn.dataset.id));
 };select.onchange=()=>{filters.parent=select.value;redraw()};el.querySelector('#kbReset').onclick=()=>{Object.keys(filters).forEach(k=>filters[k]='');draw(topics,parse,save)};el.querySelector('#kbPrint').onclick=()=>window.print();redraw();
 el.querySelector('#kbCancel').onclick=()=>el.querySelector('#kbDialog').close();
 el.querySelector('#kbForm').onsubmit=async ev=>{ev.preventDefault();if(!current)return;
 const fd=new FormData(ev.currentTarget),next={...current.task,title:String(fd.get('title')||'').trim(),assignee:String(fd.get('assignee')||'').trim(),discipline:String(fd.get('discipline')||'').trim(),dueDate:String(fd.get('dueDate')||''),status:String(fd.get('status')),completion:Number(fd.get('completion')),weight:Number(fd.get('weight')),dependsOn:String(fd.get('dependsOn')||''),blocked:fd.has('blocked'),blockReason:String(fd.get('blockReason')||'').trim()};
 if(!next.title)return;
 if(next.dependsOn===next.id){alert('En oppgave kan ikke være avhengig av seg selv.');return}
 if(next.dependsOn){const lookup=new Map(current.all.map(x=>[x.id,x]));const seen=new Set([next.id]);let id=next.dependsOn;while(id){if(seen.has(id)){alert('Avhengigheten ville skapt en sirkel.');return}seen.add(id);id=lookup.get(id)?.dependsOn}}
 if(next.status==='Done'||next.completion===100){const dependency=current.all.find(x=>x.id===next.dependsOn);if(next.blocked||dependency&&!done(dependency)){alert('Fjern blokkeringen og fullfør avhengigheten før oppgaven lukkes.');return}next.status='Done';next.completion=100;next.blocked=false}
 else if(next.blocked){next.status='Blocked';if(next.completion===100)next.completion=75}
 else if(next.status==='New'){next.completion=0}
 else if(next.status==='In Progress'&&next.completion===0){next.completion=25}
 else if(next.status==='Blocked'&&!next.blocked)next.blocked=true;
 try{await save(current.parent.guid,ts=>ts.map(t=>t.id===next.id?next:t));el.querySelector('#kbDialog').close()}catch(err){alert('Lagring feilet: '+err.message)}
 };
 function open(parentId,taskId){
 const c=cards.find(c=>c.parent.guid===parentId&&c.task.id===taskId);if(!c)return;current=c;
 const f=el.querySelector('#kbForm'),t=c.task;
 for(const field of ['title','assignee','discipline','dueDate','status','completion','weight','blockReason'])f.elements[field].value=t[field]??(field==='completion'?(done(t)?100:0):field==='weight'?3:'');
 f.elements.blocked.checked=!!t.blocked;
 const dep=f.elements.dependsOn;dep.innerHTML='<option value="">Ingen avhengighet</option>'+c.all.filter(x=>x.id!==t.id).map(x=>'<option value="'+E(x.id)+'">'+E(x.title)+'</option>').join('');dep.value=t.dependsOn||'';
 el.querySelector('#kbDialog').showModal();
 }
}
window.BCFTaskFlowKanban={render:draw};
})();