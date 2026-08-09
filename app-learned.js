function completedWordEntries(){
  const entries=[];
  const seen=new Set();
  const lessons=Object.entries(state.lessons)
    .filter(([,lesson])=>lesson?.completed && !lesson?.reviewOnly && Array.isArray(lesson.words))
    .sort(([a],[b])=>b.localeCompare(a));

  for(const [date,lesson] of lessons){
    for(const w of lesson.words){
      const key=String(w.word||'').toLowerCase();
      if(!key || seen.has(key)) continue;
      seen.add(key);
      entries.push({...w,date});
    }
  }
  return entries;
}

function filteredLearnedEntries(){
  const q=($('#wordSearch')?.value||'').trim().toLowerCase();
  const entries=completedWordEntries();
  if(!q) return entries;
  return entries.filter(w=>[
    w.word,w.meaning,w.pos,w.note,w.date
  ].some(v=>String(v||'').toLowerCase().includes(q)));
}

function renderLearnedWords(){
  const all=completedWordEntries();
  const entries=filteredLearnedEntries();
  const list=$('#learnedWordList');
  const summary=$('#learnedSummary');
  const testBtn=$('#learnedTestBtn');
  if(!list||!summary||!testBtn) return;

  const searching=($('#wordSearch')?.value||'').trim().length>0;
  summary.textContent=searching
    ? `${all.length.toLocaleString()}語中 ${entries.length.toLocaleString()}語を表示しています。`
    : `${all.length.toLocaleString()}語を覚えました。学習完了した単語だけを表示しています。`;

  const testCount=Math.min(10,entries.length);
  testBtn.textContent=entries.length>=4?`一覧から${testCount}問テスト`:'一覧からテスト';
  testBtn.disabled=entries.length<4;

  if(!entries.length){
    list.innerHTML=`<div class="empty-words">${all.length?'条件に合う単語がありません。':'まだ覚えた単語がありません。今日の5語を完了すると、ここに追加されます。'}</div>`;
    return;
  }

  list.innerHTML=entries.map(w=>`
    <div class="learned-row">
      <div class="learned-copy">
        <div class="learned-word-top">
          <strong>${escapeHtml(w.word||'')}</strong>
          <span class="pos">${escapeHtml(w.pos||'')}</span>
        </div>
        <div class="learned-meaning">${escapeHtml(w.meaning||'')}</div>
        ${w.note?`<div class="learned-note">${escapeHtml(w.note)}</div>`:''}
      </div>
      <div class="learned-date">${escapeHtml(String(w.date||'').replaceAll('-','/'))}</div>
    </div>`).join('');
}

function buildLearnedQuiz(words,bank){
  const uniqueMeanings=[...new Set(bank.map(w=>w.meaning).filter(Boolean))];
  const uniqueWords=[...new Set(bank.map(w=>w.word).filter(Boolean))];

  return words.map((w,i)=>{
    const reverse=i%2===1;
    if(reverse){
      const distract=uniqueWords.filter(x=>x!==w.word); shuffle(distract);
      const options=[w.word,...distract.slice(0,3)]; shuffle(options);
      return {q:`「${w.meaning}」に最も近い英単語は？`,answer:w.word,options};
    }
    const distract=uniqueMeanings.filter(x=>x!==w.meaning); shuffle(distract);
    const options=[w.meaning,...distract.slice(0,3)]; shuffle(options);
    return {q:`「${w.word}」に最も近い意味は？`,answer:w.meaning,options};
  });
}

function startLearnedListTest(){
  const bank=filteredLearnedEntries();
  const root=$('#learnedTestArea');
  if(bank.length<4){
    toast('テストには4語以上必要です');
    return;
  }
  const picked=[...bank]; shuffle(picked); picked.splice(Math.min(10,picked.length));
  const quiz=buildLearnedQuiz(picked,bank);
  root.innerHTML='';
  renderQuiz(quiz,root,(score,total)=>{
    state.reviewLog[`list-${Date.now()}`]={completed:true,score,total,at:new Date().toISOString()};
    save();
  });
  root.scrollIntoView({behavior:'smooth',block:'nearest'});
}

$('#wordSearch').addEventListener('input',()=>{
  $('#learnedTestArea').innerHTML='';
  renderLearnedWords();
});
$('#learnedTestBtn').onclick=startLearnedListTest;
const learnedTab=document.querySelector('[data-view="learned"]');
if(learnedTab) learnedTab.addEventListener('click',renderLearnedWords);
renderLearnedWords();
