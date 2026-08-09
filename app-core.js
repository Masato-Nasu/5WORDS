const START = '2026-08-09';
const GOAL = '2028-09-30';
const STICKERS = [
  ['⭐','#ffe08a'],['📘','#cce3ff'],['🍎','#ffd0c8'],['🚀','#d8d1ff'],['🌱','#d8efc9'],
  ['☀️','#ffe8a8'],['🎈','#ffd6e7'],['🧩','#d4ede8'],['🐣','#fff0b8'],['🏆','#f1d59a'],
  ['🌙','#d8dcff'],['✏️','#ffe1b8'],['🍀','#cceccf'],['🎵','#e5d6f5'],['🐳','#cde9f3']
];
const $ = s => document.querySelector(s);
const state = JSON.parse(localStorage.getItem('fiveWordsState') || '{"lessons":{},"stickers":{},"reviewLog":{}}');
let selectedDate = localDateKey(new Date());
let calCursor = new Date(); calCursor.setDate(1);
const API_KEY_STORAGE = 'fiveWordsOpenAIKey';
const IMAGE_CACHE = 'five-words-generated-images-v1';
function imageCacheRequest(k){ return new Request(`${location.origin}/__five_words_image__/${encodeURIComponent(k)}`); }
async function saveLessonImage(k,b64,mime='image/webp'){
  const bin=atob(b64), bytes=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  const cache=await caches.open(IMAGE_CACHE); await cache.put(imageCacheRequest(k),new Response(bytes,{headers:{'Content-Type':mime}}));
}
async function loadLessonImage(k){
  try{const cache=await caches.open(IMAGE_CACHE),res=await cache.match(imageCacheRequest(k));if(!res)return null;return URL.createObjectURL(await res.blob())}catch{return null}
}
async function paintLessonImage(k){
  const box=$('#sceneBox'),btn=$('#imageBtn'); if(!box||!btn)return; const url=await loadLessonImage(k);
  if(url){box.innerHTML=`<img alt="今日の英文の情景" src="${url}">`;btn.textContent='画像を再生成'}
}
function getApiKey(){ return (localStorage.getItem(API_KEY_STORAGE)||'').trim(); }
function updateKeyStatus(){
  const ready=!!getApiKey();
  $('#keyStatus').textContent=ready?'API KEY 設定済み':'API KEY 未設定';
  $('#apiKeyBtn').classList.toggle('ready',ready);
}
function openApiModal(){
  $('#apiKeyInput').value=getApiKey();
  $('#apiKeyInput').type='password';
  $('#toggleKeyBtn').textContent='表示';
  $('#apiModal').classList.add('open');
  setTimeout(()=>$('#apiKeyInput').focus(),50);
}
function closeApiModal(){ $('#apiModal').classList.remove('open'); }
async function byokFetch(url,options={}){
  const key=getApiKey();
  if(!key){ openApiModal(); throw new Error('OpenAI APIキーを設定してください。'); }
  const headers=new Headers(options.headers||{});
  headers.set('Authorization',`Bearer ${key}`);
  return fetch(url,{...options,headers});
}

function save(){ localStorage.setItem('fiveWordsState', JSON.stringify(state)); updateStats(); }
function localDateKey(d){ const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }
function parseDate(k){ const [y,m,d]=k.split('-').map(Number); return new Date(y,m-1,d); }
function dayDiff(a,b){ return Math.round((parseDate(b)-parseDate(a))/86400000); }
function isSunday(k){ return parseDate(k).getDay()===0; }
function isNewWordDay(k){ return k===START || !isSunday(k); }
function withinCourse(k){ return k>=START && k<=GOAL; }
function phaseFor(k){
  if(k<'2027-04-01') return {id:'h1',label:'高1 基礎',level:'高校基礎〜共通テスト基礎。頻出の基本語を優先'};
  if(k<'2028-04-01') return {id:'h2',label:'高2 標準',level:'共通テスト〜標準私大・国公立。抽象語・論説語彙を増やす'};
  return {id:'h3',label:'高3 実戦',level:'標準〜難関大。長文で重要な抽象語・多義語・語法を優先'};
}
function courseStudyDayNumber(k){
  let n=0; const end=parseDate(k); for(let d=parseDate(START);d<=end;d.setDate(d.getDate()+1)){ const dk=localDateKey(d); if(isNewWordDay(dk))n++; } return n;
}
function todayKey(){return localDateKey(new Date())}
function allLearnedWords(){ return Object.values(state.lessons).flatMap(l=>l.words||[]); }
function learnedCount(){ return Object.values(state.lessons).filter(l=>!l.reviewOnly && l.completed).reduce((n,l)=>n+(l.words?.length||0),0); }
function completedDays(){ return Object.keys(state.stickers).length; }
function deterministicSticker(k){ let h=0; for(const c of k) h=(h*31+c.charCodeAt(0))>>>0; return STICKERS[h%STICKERS.length]; }
function updateStats(){
  $('#learnedCount').textContent=learnedCount().toLocaleString(); $('#stickerCount').textContent=completedDays();
  const left=Math.max(0,dayDiff(todayKey(),GOAL)); $('#daysLeft').textContent=left.toLocaleString();
  $('#phasePill').textContent=phaseFor(todayKey()).label;
  const total=3365, done=learnedCount(); $('#roadText').textContent=`${done.toLocaleString()} / ${total.toLocaleString()}語`; $('#roadProgress').style.width=`${Math.min(100,done/total*100)}%`;
}
function toast(t){const el=$('#toast');el.textContent=t;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1800)}
function escapeHtml(s=''){return s.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

function showView(name){ document.querySelectorAll('.view').forEach(v=>v.classList.remove('active')); document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.view===name)); $(`#${name}View`).classList.add('active'); if(name==='calendar')renderCalendar(); }
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>showView(b.dataset.view));
