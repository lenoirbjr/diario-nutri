'use strict';
const APP='diario-nutri', VERSION=1, MAX_ENTRIES=15000, MIN_DATE='1900-01-01', MAX_DATE='2100-12-31';
const KEY=APP+':'+new URL('./',location.href).pathname+':v1';
const MEALS=[
 {id:'breakfast',label:'Café da manhã',tag:'CM'},
 {id:'morning',label:'Lanche da manhã',tag:'LM'},
 {id:'lunch',label:'Almoço',tag:'AL'},
 {id:'afternoon',label:'Lanche da tarde',tag:'LT'},
 {id:'dinner',label:'Jantar',tag:'JA'},
 {id:'supper',label:'Ceia',tag:'CE'}
];
const MEAL_IDS=new Set(MEALS.map(x=>x.id));
const $=id=>document.getElementById(id);
const num=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1});
const dateShort=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short'});
const dateLong=new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
const dateUTC=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'long',year:'numeric'});
const pad=n=>String(n).padStart(2,'0');
function keyOf(date){return date.getFullYear()+'-'+pad(date.getMonth()+1)+'-'+pad(date.getDate());}
function dayObject(key){return new Date(key+'T12:00:00');}
function today(){return keyOf(new Date());}
function validDate(key){return typeof key==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(key)&&key>=MIN_DATE&&key<=MAX_DATE&&keyOf(dayObject(key))===key;}
function shiftDay(key,offset){const day=dayObject(key);day.setDate(day.getDate()+offset);return keyOf(day);}
function normalize(value){return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');}
function finiteAmount(value,min,max){return typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max&&Math.round(value*10)/10===value;}
function kcalByWeight(grams,density){return Math.round((Math.round(grams*10)*Math.round(density*10))/1000)/10;}
function totals(entries){return entries.reduce((sum,item)=>sum+Math.round(item.kcal*10),0)/10;}
function validEntry(item){
 if(!item||typeof item!=='object'||Array.isArray(item)||typeof item.id!=='string'||!/^[A-Za-z0-9-]{8,80}$/.test(item.id)||
    !validDate(item.date)||!MEAL_IDS.has(item.meal)||typeof item.name!=='string'||item.name!==item.name.trim()||!item.name||item.name.length>120||
    !finiteAmount(item.kcal,0,1000000))return false;
 if(item.mode==='kcal')return item.kcal<=999999;
 return item.mode==='grams'&&finiteAmount(item.grams,0.1,100000)&&finiteAmount(item.density,0,1000)&&kcalByWeight(item.grams,item.density)===item.kcal;
}
function parseState(data){
 if(!data||data.app!==APP||data.version!==VERSION||!Array.isArray(data.entries)||data.entries.length>MAX_ENTRIES)throw Error('Arquivo incompatível com esta versão do diário.');
 const ids=new Set();
 const entries=data.entries.map(item=>{
  if(!validEntry(item)||ids.has(item.id))throw Error('O arquivo contém registros inválidos ou duplicados.');
  ids.add(item.id);
  const {id,date,meal,name,mode,kcal,grams,density}=item;
  return {id,date,meal,name,mode,kcal,...(mode==='grams'?{grams,density}:{})};
 });
 return {app:APP,version:VERSION,entries};
}
const blank=()=>({app:APP,version:VERSION,entries:[]});
const FOOD_LIST=(Array.isArray(globalThis.NUTRI_FOODS)?globalThis.NUTRI_FOODS:[]).filter(x=>x&&typeof x.name==='string'&&finiteAmount(x.kcal,0,1000)).map(food=>({...food,terms:[food.name,...(Array.isArray(food.aliases)?food.aliases:[])].map(normalize)}));
function searchFoods(query){
 const q=normalize(query);
 if(q.length<2)return [];
 const words=q.split(' ');
 return FOOD_LIST.map(food=>({food,score:food.terms[0]===q?0:food.terms.includes(q)?1:food.terms.some(term=>term.startsWith(q))?2:words.every(w=>food.terms.some(term=>term.includes(w)))?3:Infinity}))
  .filter(x=>Number.isFinite(x.score)).sort((a,b)=>a.score-b.score||a.food.name.localeCompare(b.food.name,'pt-BR')).slice(0,6).map(x=>x.food);
}
const exactFood=query=>{const q=normalize(query),matches=FOOD_LIST.filter(food=>food.terms.includes(q));return matches.length===1?matches[0]:null;};
let state=blank(), selectedDate=today(), editingId=null, autoDensity=false, readIssue=false;
function node(tag,className,text){
 const out=document.createElement(tag);if(className)out.className=className;if(text!==undefined)out.textContent=text;return out;
}
const icons={
 edit:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7l-3-3L5 16l-1 4Z"/></svg>',
 remove:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16m-14 0 1 13h10l1-13M9 7V4h6v3m-5 4v5m4-5v5"/></svg>'
};
function setBanner(value){$('banner').textContent=value;$('banner').hidden=!value;}
function announce(value){$('announcer').textContent='';requestAnimationFrame(()=>{$('announcer').textContent=value;});}
function readLocal(){
 try{
  const raw=localStorage.getItem(KEY);
  state=raw===null?blank():parseState(JSON.parse(raw));
 }catch{
  readIssue=true;
  setBanner('Não consegui abrir os registros deste navegador. Não alterei os dados. Se tiver um backup válido, restaure pela aba Dados.');
 }
}
function persist(next,{replace=false}={}){
 if(readIssue&&!replace)throw Error('Restaure um backup válido antes de salvar novos registros.');
 if(next.entries.length>MAX_ENTRIES)throw Error('O diário atingiu seu limite de registros. Exporte um backup antes de remover registros.');
 try{
  const serialized=JSON.stringify(next);
  localStorage.setItem(KEY,serialized);state=next;readIssue=false;setBanner('');
 }catch{throw Error('Não consegui salvar neste navegador. Os registros anteriores não foram alterados.');}
}
function formatKcal(value){return num.format(value)+' kcal';}
function plural(count){return count===0?'Nenhum alimento registrado':count===1?'1 alimento registrado':num.format(count)+' alimentos registrados';}
function displayDate(key){return dateLong.format(dayObject(key));}
function jump(date){
 if(!validDate(date)){$('diaryDate').value=selectedDate;return;}
 selectedDate=date;
 renderDiary();
}
function renderDiary(){
 const day=selectedDate,dayEntries=state.entries.filter(e=>e.date===day);
 $('selectedDateLabel').textContent=day===today()?'Hoje · '+dateShort.format(dayObject(day)):displayDate(day).replace(/,? de \d{4}$/,'');
 $('diaryDate').value=day;$('diaryDate').setAttribute('aria-valuetext',displayDate(day));
 $('goToday').hidden=day===today();$('prevDay').disabled=day<=MIN_DATE;$('nextDay').disabled=day>=MAX_DATE;
 $('dayTotal').textContent=num.format(totals(dayEntries));$('dayCount').textContent=plural(dayEntries.length);
 $('addFood').disabled=readIssue;
 const cards=MEALS.map(({id,label,tag})=>{
  const items=dayEntries.filter(e=>e.meal===id);
  const card=node('section','meal-card');card.setAttribute('aria-label',label);
  const head=node('header','meal-card-head');
  const glyph=node('span','meal-glyph',tag);glyph.setAttribute('aria-hidden','true');
  const title=node('div','meal-heading');
  title.append(node('h3','',label),node('p','',items.length?num.format(items.length)+(items.length===1?' item':' itens'):'Nenhum item'));
  const add=node('button','meal-add','＋');add.type='button';add.dataset.mealAdd=id;add.disabled=readIssue;add.setAttribute('aria-label','Adicionar alimento em '+label);
  head.append(glyph,title,node('strong','meal-kcal',formatKcal(totals(items))),add);card.append(head);
  if(!items.length)return card;
  const list=node('ul');
  for(const entry of items){
   const row=node('li','food-row'),main=node('div','food-main');
   main.append(node('strong','',entry.name),node('small','',entry.mode==='grams'?num.format(entry.grams)+' g · '+formatKcal(entry.kcal):formatKcal(entry.kcal)));
   row.append(main);
   for(const action of ['edit','remove']){
    const control=node('button','item-action '+action);control.type='button';control.dataset[action]=entry.id;
    control.setAttribute('aria-label',(action==='edit'?'Editar ':'Excluir ')+entry.name);
    control.innerHTML=icons[action];row.append(control);
   }
   list.append(row);
  }
  card.append(list);return card;
 });
 $('meals').replaceChildren(...cards);
}
function renderHistory(){
 const groups=new Map();
 for(const entry of state.entries){
  if(!groups.has(entry.date))groups.set(entry.date,[]);
  groups.get(entry.date).push(entry);
 }
 const ordered=[...groups].sort(([a],[b])=>b.localeCompare(a));
 const rows=ordered.map(([date,items])=>{
  const button=node('button','history-row');button.type='button';button.dataset.historyDate=date;const copy=node('span');
  const title=node('strong','',date===today()?'Hoje':dateUTC.format(dayObject(date)));
  copy.append(title,node('small','',plural(items.length)));button.append(copy,node('span','history-value',formatKcal(totals(items))));
  return button;
 });
 $('history').replaceChildren(...(rows.length?rows:[node('p','empty-note','Ainda não há dias registrados. Adicione um alimento no diário para começar.')]));
}
function tab(name,{focus=false}={}){
 for(const target of ['diary','history','data'])$('screen-'+target).hidden=target!==name;
 for(const button of document.querySelectorAll('[data-tab]')){
  if(button.dataset.tab===name)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
 }
 if(name==='history')renderHistory();if(name==='diary')renderDiary();
 window.scrollTo(0,0);
 if(focus)$('screen-'+name).querySelector('h1')?.focus({preventScroll:true});
}
function editorMessage(value){$('editorError').textContent=value;$('editorError').hidden=!value;}
function pickFood(food){
 $('foodName').value=food.name;$('density').value=food.kcal;autoDensity=true;
 $('modeGrams').checked=true;
 $('foodMatches').hidden=true;$('foodMatches').replaceChildren();showMode();$('grams').focus();
}
function renderSuggestions(){
 const query=$('foodName').value,known=exactFood(query);
 if(autoDensity&&!known){$('density').value='';autoDensity=false;}
 if(known&&($('density').value===''||autoDensity)){$('density').value=known.kcal;autoDensity=true;}
 const results=searchFoods(query);
 const buttons=results.map(food=>{
  const item=node('button');item.type='button';item.append(node('span','',food.name),node('small','',formatKcal(food.kcal)+'/100 g'));
  item.addEventListener('click',()=>pickFood(food));return item;
 });
 $('foodMatches').replaceChildren(...buttons);$('foodMatches').hidden=!buttons.length;
 showPreview();
}
function readEntry(){
 const name=$('foodName').value.trim(),meal=$('meal').value;
 const mode=$('modeGrams').checked?'grams':'kcal';
 const id=editingId||'preview-entry';
 if(mode==='grams'){
  const grams=$('grams').valueAsNumber,density=$('density').valueAsNumber;
  return {id,date:selectedDate,meal,name,mode,grams,density,kcal:kcalByWeight(grams,density)};
 }
 return {id,date:selectedDate,meal,name,mode,kcal:$('directKcal').valueAsNumber};
}
function showPreview(){
 const entry=readEntry(),value=entry.kcal,valid=entry.mode==='kcal'?finiteAmount(value,0,999999):finiteAmount(entry.grams,0.1,100000)&&finiteAmount(entry.density,0,1000);
 $('entryPreview').textContent=valid?formatKcal(value):'—';
}
function showMode(){
 const grams=$('modeGrams').checked;
 $('weightFields').hidden=!grams;$('directFields').hidden=grams;
 for(const id of ['grams','density']){$(id).disabled=!grams;$(id).required=grams;}
 $('directKcal').disabled=grams;$('directKcal').required=!grams;showPreview();
}
function openEditor(meal='breakfast',id=null){
 if(readIssue)return;
 editingId=id;autoDensity=false;
 const existing=id?state.entries.find(entry=>entry.id===id):null;
 if(id&&!existing)return;
 $('entryForm').reset();$('editorTitle').textContent=existing?'Editar alimento':'Adicionar alimento';
 $('meal').value=existing?.meal||meal;
 if(existing){
  $('foodName').value=existing.name;
  $('modeGrams').checked=existing.mode==='grams';$('modeKcal').checked=existing.mode==='kcal';
  if(existing.mode==='grams'){$('grams').value=existing.grams;$('density').value=existing.density;}
  else $('directKcal').value=existing.kcal;
 }
 $('foodMatches').replaceChildren();$('foodMatches').hidden=true;editorMessage('');showMode();
 $('editor').showModal();
}
function newId(){
 if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
 return Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
}
function handleEntry(event){
 event.preventDefault();
 const item={...readEntry(),id:editingId||newId()};
 if(!validEntry(item)){editorMessage('Confira o alimento, a refeição e os valores informados.');return;}
 try{
  persist({...state,entries:editingId?state.entries.map(entry=>entry.id===editingId?item:entry):[...state.entries,item]});
  $('editor').close();renderDiary();announce('Alimento salvo.');
 }catch(e){editorMessage(e.message);}
}
function removeEntry(id){
 const entry=state.entries.find(item=>item.id===id);
 if(!entry||!confirm('Excluir “'+entry.name+'” do diário?'))return;
 try{persist({...state,entries:state.entries.filter(item=>item.id!==id)});renderDiary();announce('Alimento excluído.');}
 catch(e){setBanner(e.message);}
}
function exportBackup(){
 if(readIssue){$('backupStatus').textContent='Não foi possível abrir os registros para exportação.';return;}
 const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),href=URL.createObjectURL(blob);
 const link=node('a');link.href=href;link.download='diario-nutri-'+today()+'.json';document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(href),30000);
 $('backupStatus').textContent='Arquivo preparado para download. Guarde-o em um lugar privado.';
}
async function importBackup(){
 const control=$('backupFile'),file=control.files?.[0];if(!file)return;
 try{
  if(file.size>8*1024*1024)throw Error('O arquivo excede o limite de 8 MB.');
  let payload;
  try{payload=JSON.parse(await file.text());}catch{throw Error('O arquivo não é um JSON válido.');}
  const next=parseState(payload);
  if(!confirm('Substituir os registros deste diário pelos do backup?')){$('backupStatus').textContent='Importação cancelada. Nada foi alterado.';return;}
  persist(next,{replace:true});
  $('backupStatus').textContent='Backup restaurado. '+num.format(next.entries.length)+' registro(s) importado(s).';
 }catch(e){$('backupStatus').textContent=e.message;}finally{control.value='';}
}
function bind(){
 for(const {id,label} of MEALS){const option=node('option','',label);option.value=id;$('meal').append(option);}
 for(const title of document.querySelectorAll('main>section h1'))title.tabIndex=-1;
 for(const button of document.querySelectorAll('[data-tab]'))button.addEventListener('click',()=>tab(button.dataset.tab,{focus:true}));
 $('prevDay').addEventListener('click',()=>jump(shiftDay(selectedDate,-1)));
 $('nextDay').addEventListener('click',()=>jump(shiftDay(selectedDate,1)));
 $('goToday').addEventListener('click',()=>jump(today()));
 $('diaryDate').addEventListener('change',event=>jump(event.target.value));
 $('addFood').addEventListener('click',()=>openEditor());
 $('meals').addEventListener('click',event=>{
  if(!(event.target instanceof Element))return;
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.mealAdd)openEditor(button.dataset.mealAdd);
  if(button.dataset.edit)openEditor(null,button.dataset.edit);
  if(button.dataset.remove)removeEntry(button.dataset.remove);
 });
 $('history').addEventListener('click',event=>{
  if(!(event.target instanceof Element))return;
  const button=event.target.closest('[data-history-date]');if(!button)return;
  jump(button.dataset.historyDate);tab('diary',{focus:true});
 });
 $('closeEditor').addEventListener('click',()=>$('editor').close());
 $('foodName').addEventListener('input',renderSuggestions);
 $('foodName').addEventListener('keydown',event=>{
  if(event.key==='ArrowDown'&&!$('foodMatches').hidden){event.preventDefault();$('foodMatches').querySelector('button')?.focus();}
 });
 for(const id of ['modeGrams','modeKcal'])$(id).addEventListener('change',showMode);
 for(const id of ['grams','density','directKcal'])$(id).addEventListener('input',()=>{if(id==='density')autoDensity=false;showPreview();});
 $('entryForm').addEventListener('submit',handleEntry);
 $('exportData').addEventListener('click',exportBackup);
 $('importData').addEventListener('click',()=>$('backupFile').click());
 $('backupFile').addEventListener('change',importBackup);
 window.addEventListener('storage',event=>{
  if(event.key===KEY){readIssue=false;setBanner('');readLocal();renderDiary();renderHistory();}
 });
}
readLocal();bind();renderDiary();
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).catch(()=>{}));
