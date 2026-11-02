/* Searchable Team and Tag picker for BCFTaskFlow. No dependencies. */
(()=>{'use strict';
const txt=v=>String(v??'');
const html=v=>txt(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function members(source){
 const array=Array.isArray(source)?source:Array.isArray(source?.members)?source.members:Array.isArray(source?.items)?source.items:Array.isArray(source?.data)?source.data:[];
 return array.filter(x=>x&&typeof x==='object'&&!/^(removed|deleted)$/i.test(x.status||'')).map(x=>{
 const person=x.user||x.member||x.profile||x;
 const email=person.email||person.emailAddress||person.mail||person.userEmail||x.email||x.emailAddress||'';
 const name=[person.firstName||person.first_name,person.lastName||person.last_name].filter(Boolean).join(' ')||person.displayName||person.name||person.fullName||x.name||email;
 return {email:txt(email).trim(),name:txt(name).trim()};
 }).filter(x=>x.email);
}
function labels(source){
 const raw=Array.isArray(source)?source:Array.isArray(source?.topic_label)?source.topic_label:Array.isArray(source?.topic_labels)?source.topic_labels:[];
 return raw.map(x=>typeof x==='string'?x:(x?.name||x?.label||x?.value||'')).filter(Boolean).map(txt);
}
function attach(input,options,{allowCustom=false,placeholder='Søk og velg …'}={}){
 if(!input)return;
 input.removeAttribute('list');input.autocomplete='off';input.placeholder=placeholder;
 const outer=document.createElement('div');outer.className='tf-picker';input.parentNode.insertBefore(outer,input);outer.appendChild(input);
 const button=document.createElement('button');button.type='button';button.className='tf-picker-toggle';button.textContent='▾';button.setAttribute('aria-label','Vis alternativer');
 outer.appendChild(button);
 const menu=document.createElement('div');menu.className='tf-picker-menu';menu.hidden=true;outer.appendChild(menu);
 const items=[...new Map(options.filter(x=>x.value).map(x=>[x.value.toLowerCase(),x])).values()].sort((a,b)=>a.label.localeCompare(b.label,'nb'));
 function show(){
 const q=input.value.trim().toLocaleLowerCase('nb');const choices=items.filter(x=>(x.label+' '+x.value).toLocaleLowerCase('nb').includes(q));
 menu.innerHTML=choices.length?choices.slice(0,100).map(x=>'<button type="button" class="tf-picker-option" data-value="'+html(x.value)+'"><strong>'+html(x.label)+'</strong>'+(x.label!==x.value?'<small>'+html(x.value)+'</small>':'')+'</button>').join(''):'<div class="tf-picker-empty">'+(items.length?'Ingen treff':'Ingen alternativer hentet fra prosjektet')+'</div>';
 menu.hidden=false;
 menu.querySelectorAll('[data-value]').forEach(el=>el.onclick=()=>{input.value=el.dataset.value;input.dispatchEvent(new Event('change',{bubbles:true}));menu.hidden=true});
 }
 input.addEventListener('focus',show);input.addEventListener('input',show);
 button.onclick=()=>{if(menu.hidden){input.focus();show()}else menu.hidden=true};
 input.addEventListener('keydown',e=>{if(e.key==='Escape')menu.hidden=true;if(e.key==='ArrowDown'){const first=menu.querySelector('button');if(first){e.preventDefault();first.focus()}}});
 outer.addEventListener('focusout',e=>{if(!outer.contains(e.relatedTarget))menu.hidden=true});
 if(!allowCustom){input.addEventListener('change',()=>{if(input.value&&!items.some(x=>x.value===input.value))input.setCustomValidity('Velg et alternativ fra prosjektlisten');else input.setCustomValidity('')})}
}
window.BCFTaskFlowPicker={members,labels,attach};
})();