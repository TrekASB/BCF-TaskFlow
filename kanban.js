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

function draw(topics,parse,save,teamMembers=[],projectTags=[],saveParent=null,projectStatuses=[]){
 ctx={topics,parse,save};
 const el=document.getElementById('kanban');if(!el)return;
 const cards=topics.flatMap(p=>{let ts=[];try{ts=parse(p).tasks||[]}catch{}return ts.map(t=>({parent:p,task:t,all:ts}))});
 el.innerHTML='<div class="kb-heading"><div><h2>Kanban – underoppgaver</h2><p class="meta">Rediger kortene direkte. Endringer lagres på hovedsakens BCF Topic.</p></div><label>Hovedsak: <select id="kbParent"><option value="">Alle hovedsaker</option>'+topics.map(p=>'<option value="'+E(p.guid)+'">'+E(p.title)+'</option>').join('')+'</select></label></div><div class="kb-filters"><span>PERIODE</span><label>Fra uke <select id="kbFrom"></select></label><label>Til uke <select id="kbTo"></select></label><label>FAG <select id="kbDiscipline"></select></label><label>ASSIGNEE <select id="kbAssignee"></select></label><button type="button" id="kbReset">Nullstill</button><button type="button" id="kbPrint">Skriv ut</button></div><div id="kbBoard" class="kb-board"></div><dialog id="kbDialog"><form id="kbForm"><h2>Rediger underoppgave</h2><label>Oppgave<input name="title" maxlength="200" required></label><label>Ansvarlig<input name="assignee" list="kbTeamOptions" maxlength="150" placeholder="Søk navn eller e-post"><datalist id="kbTeamOptions">'+teamMembers.filter(m=>m.email).map(m=>'<option value="'+E(m.email)+'" label="'+E([m.firstName,m.lastName].filter(Boolean).join(' ')||m.email)+'"></option>').join('')+'</datalist></label><label>Fag<input name="discipline" list="kbTagOptions" maxlength="80" placeholder="Søk fag/tag"><datalist id="kbTagOptions">'+projectTags.map(t=>'<option value="'+E(t)+'"></option>').join('')+'</datalist></label><label>Tidsfrist<input name="dueDate" type="date"></label><label>Status<select name="status"><option value="New">Ny</option><option value="In Progress">Pågår</option><option value="Blocked">Blokkert</option><option value="Done">Ferdig</option></select></label><label>Ferdigstillelse<select name="completion">'+[0,25,50,75,100].map(n=>'<option value="'+n+'">'+n+' %</option>').join('')+'</select></label><label>Vekting 1–5<select name="weight">'+Array.from({length:5},(_,i)=>'<option value="'+(i+1)+'">'+(i+1)+'</option>').join('')+'</select></label><label>Avhenger av<select name="dependsOn"><option value="">Ingen avhengighet</option></select></label><label><input name="blocked" type="checkbox"> Blokkert (hindring)</label><label>Beskrivelse av blokkering<textarea name="blockReason" rows="2"></textarea></label><div class="row"><button type="button" id="kbCancel">Avbryt</button><button class="primary" type="submit">Lagre endringer</button></div></form></dialog>';
 window.BCFTaskFlowPicker.attach(el.querySelector('[name="assignee"]'),teamMembers.map(m=>({value:m.email,label:m.name||m.email})),{placeholder:'Velg fra Team …'});
 window.BCFTaskFlowPicker.attach(el.querySelector('[name="discipline"]'),projectTags.map(t=>({value:t,label:t})),{placeholder:'Velg prosjekt-tag …'});
 const pd=document.createElement('dialog');pd.id='kbParentDialog';pd.innerHTML='<form id="kbParentForm"><h2>Rediger hovedsak</h2><label>Tittel<input name="title" maxlength="200" required></label><label>Status<select name="topic_status" required></select></label><label>Prioritet<select name="priority"></select></label><label>Type sak<select name="topic_type"></select></label><label>Fag/tag<select name="label"></select></label><label>Ansvarlig<select name="assigned_to"></select></label><label>Beskrivelse<textarea name="description" rows="4"></textarea></label><p class="meta">Lagrer direkte i BCF Topics. Underoppgaver beholdes.</p><div class="row"><button id="kbParentCancel" type="button">Avbryt</button><button class="primary" type="submit">Lagre hovedsak</button></div></form>';el.appendChild(pd);
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
 const parentColor=id=>{let n=0;for(const char of id)n=(n*31+char.charCodeAt(0))>>>0;return ['#0c66e4','#8b5cf6','#0f766e','#c2410c','#be185d','#0369a1','#4d7c0f'][n%7]};
 const parentStatus=p=>/^(done|closed|completed|resolved|ferdig)$/i.test(String(p.topic_status||''))?'Done':/^(in progress|pågår|active)$/i.test(String(p.topic_status||''))?'In Progress':'New';
 const parentSet=topics.filter(p=>(!selected||p.guid===selected)&&(!filters.discipline||shown.some(c=>c.parent.guid===p.guid))&&(!filters.assignee||shown.some(c=>c.parent.guid===p.guid))&&(!filters.from||shown.some(c=>c.parent.guid===p.guid))&&(!filters.to||shown.some(c=>c.parent.guid===p.guid)));
 board.innerHTML=stages.map(([key,label])=>'<section class="kb-column"><h3 style="border-color:'+colors[key]+'">'+label+' <span>'+parentSet.filter(p=>parentStatus(p)===key).length+' hovedsaker</span></h3>'+
 parentSet.filter(p=>parentStatus(p)===key).map(p=>{
  const cs=shown.filter(c=>c.parent.guid===p.guid),color=parentColor(String(p.guid));
  const original=cards.filter(c=>c.parent.guid===p.guid);
  const finished=original.filter(c=>done(c.task)).length;
  return '<div class="kb-parentgroup" style="--parent-color:'+color+'"><div class="kb-parentcard"><span class="kb-parentmark">HOVEDSAK · '+E(p.server_assigned_id||String(p.guid).slice(0,8))+'</span><strong>'+E(p.title)+'</strong><small>'+E(p.topic_status||'Ny')+' · '+finished+'/'+original.length+' deloppgaver ferdig</small><button type="button" class="kb-edit-parent" data-edit-parent="'+E(p.guid)+'">Rediger hovedsak</button></div>'+
 (cs.length?cs.map(c=>{const t=c.task,dependency=c.all.find(x=>x.id===t.dependsOn),overdue=t.dueDate&&!done(t)&&new Date(t.dueDate+'T23:59:59')<new Date(),st=state(t);
 return '<button class="kb-card kb-childcard" type="button" data-parent="'+E(p.guid)+'" data-id="'+E(t.id)+'"><span class="kb-parentref">↳ '+E(p.server_assigned_id||String(p.guid).slice(0,8))+'</span><strong>'+E(t.title)+'</strong><div class="kb-chip" style="background:'+colors[st]+'">'+E(st==='Done'?'Ferdig':st==='In Progress'?'Pågår':st==='Blocked'?'Blokkert':'Ny')+'</div><p>'+E(t.assignee||'Ikke tildelt')+' · '+E(t.discipline||'Uten fag')+' · '+E(t.dueDate||'Ingen frist')+(overdue?' · FORFALT':'')+'</p><div class="kb-progress"><div style="width:'+Math.max(0,Math.min(100,Number(t.completion??(done(t)?100:0))))+'%;background:'+color+'"></div></div><small>Vekt '+E(t.weight||1)+'/5 · '+E(t.completion??(done(t)?100:0))+' %</small>'+(dependency?'<small>Avhenger av: '+E(dependency.title)+'</small>':'')+(t.blocked?'<small>Hindring: '+E(t.blockReason||'Ikke beskrevet')+'</small>':'')+'</button>'
 }).join(''):'<p class="meta kb-nochild">Ingen underoppgaver i utvalget</p>')+'</div>';
 }).join('')+'</section>').join('');
 board.querySelectorAll('[data-edit-parent]').forEach(btn=>btn.onclick=()=>openParent(btn.dataset.editParent));
 board.querySelectorAll('[data-id]').forEach(btn=>btn.onclick=()=>open(btn.dataset.parent,btn.dataset.id));
 };select.onchange=()=>{filters.parent=select.value;redraw()};el.querySelector('#kbReset').onclick=()=>{Object.keys(filters).forEach(k=>filters[k]='');draw(topics,parse,save)};el.querySelector('#kbPrint').onclick=()=>window.print();redraw();
 let parentEditing=null;
 function choose(name,values,current,optional=false){
  const e=pd.querySelector('[name="'+name+'"]');
  const options=[...new Set([...values,current].filter(x=>typeof x==='string'&&x))];
  e.innerHTML=(optional?'<option value="">(ingen)</option>':'')+options.map(v=>'<option value="'+E(v)+'">'+E(v)+'</option>').join('');
  e.disabled=!optional&&!options.length;e.value=current||'';
 }
 function openParent(id){
  const p=topics.find(x=>x.guid===id);if(!p||!saveParent)return;
  parentEditing=p;
  const f=pd.querySelector('form');f.elements.title.value=p.title||'';
  f.elements.description.value=parse(p).plain||'';
  choose('topic_status',projectStatuses.concat(topics.map(x=>x.topic_status)),p.topic_status);
  choose('priority',topics.map(x=>x.priority),p.priority,true);
  choose('topic_type',topics.map(x=>x.topic_type),p.topic_type,true);
  choose('label',projectTags.concat(topics.flatMap(x=>Array.isArray(x.labels)?x.labels:[])),(p.labels||[])[0]||'',true);
  choose('assigned_to',teamMembers.map(x=>x.email).concat(topics.map(x=>x.assigned_to).filter(x=>typeof x==='string')),p.assigned_to||'',true);
  pd.showModal();
 }
 pd.querySelector('#kbParentCancel').onclick=()=>pd.close();
 pd.querySelector('#kbParentForm').onsubmit=async e=>{
  e.preventDefault();if(!parentEditing||!saveParent)return;
  const d=new FormData(e.currentTarget);
  const payload={title:String(d.get('title')||'').trim(),topic_status:String(d.get('topic_status')||'')};
  for(const key of ['priority','topic_type','assigned_to']){const value=String(d.get(key)||'');if(value)payload[key]=value}
  payload.labels=d.get('label')?[String(d.get('label'))]:[];
  const plain=String(d.get('description')||'');
  if(!payload.title||!payload.topic_status)return;
  try{await saveParent(parentEditing.guid,payload,plain);pd.close()}
  catch(err){alert('Kunne ikke lagre hovedsaken: '+err.message)}
 };
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