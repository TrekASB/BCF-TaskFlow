/* BCFTaskFlow lossless compact storage. Supports legacy v2 metadata. */
(()=>{'use strict';
const V2A='[BCFTaskFlow:v2]',V2B='[/BCFTaskFlow:v2]',V3A='[BCFTaskFlow:v3]',V3B='[/BCFTaskFlow:v3]',LIMIT=2048;
function encode(input){
 const bytes=new TextEncoder().encode(input),dict=new Map();
 for(let i=0;i<256;i++)dict.set(String.fromCharCode(i),i);
 let next=256,word='',codes=[];
 for(const b of bytes){const ch=String.fromCharCode(b),phrase=word+ch;
  if(dict.has(phrase))word=phrase;
  else{if(word)codes.push(dict.get(word));if(next<65535)dict.set(phrase,next++);word=ch}
 }
 if(word)codes.push(dict.get(word));
 let raw='';for(const code of codes)raw+=String.fromCharCode(code>>>8,code&255);
 return btoa(raw);
}
function decode(value){
 const raw=atob(value),codes=[];
 if(raw.length%2)throw Error('Ugyldig komprimert TaskFlow-data');
 for(let i=0;i<raw.length;i+=2)codes.push(raw.charCodeAt(i)*256+raw.charCodeAt(i+1));
 if(!codes.length)return '';
 const dict=Array.from({length:256},(_,i)=>String.fromCharCode(i));
 let prev=dict[codes[0]];if(prev===undefined)throw Error('Ugyldig TaskFlow-kode');
 const parts=[prev];let next=256;
 for(let i=1;i<codes.length;i++){
  const code=codes[i],entry=dict[code]!==undefined?dict[code]:(code===next?prev+prev[0]:null);
  if(entry==null)throw Error('Skadet TaskFlow-data');
  parts.push(entry);if(next<65535)dict[next++]=prev+entry[0];prev=entry;
 }
 const combined=parts.join(''),bytes=new Uint8Array(combined.length);
 for(let i=0;i<combined.length;i++)bytes[i]=combined.charCodeAt(i);
 return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
function read(topic){
 const d=String(topic?.description||'');
 for(const [start,end,compact] of [[V3A,V3B,true],[V2A,V2B,false]]){
  const a=d.indexOf(start);if(a===-1)continue;
  const b=d.indexOf(end,a+start.length);
  if(b===-1)throw Error('Ufullstendige TaskFlow-metadata – lagring avbrutt');
  try{
   const raw=d.slice(a+start.length,b).trim(),obj=JSON.parse(compact?decode(raw):raw);
   if(!Array.isArray(obj.tasks))throw Error('Underoppgavelisten mangler');
   return {tasks:obj.tasks,plain:(d.slice(0,a)+d.slice(b+end.length)).trim()};
  }catch(e){throw Error('Kan ikke lese TaskFlow-metadata: '+e.message+'. Ingen data overskrives.')}
 }
 return {tasks:[],plain:d};
}
function pack(plain,tasks){
 const body=JSON.stringify({schemaVersion:3,tasks});
 const d=(plain?String(plain).trim()+'\n\n':'')+V3A+encode(body)+V3B;
 if(d.length>LIMIT)throw Error('BCF tillater maks '+LIMIT+' tegn i beskrivelsen. Komprimert TaskFlow-data krever '+d.length+' tegn. Ingen endringer lagret. Bruk en kortere hovedbeskrivelse eller færre underoppgaver inntil ekstern lagring er etablert.');
 return d;
}
window.BCFTaskFlowStorage={read,pack,encode,decode,LIMIT};
})();