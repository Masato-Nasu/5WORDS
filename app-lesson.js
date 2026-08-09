function renderLessonIntro(){
  const k=selectedDate, future=k>todayKey(), sunday=isSunday(k)&&k!==START, past=k<todayKey();
  $('#lessonTitle').textContent = k===todayKey() ? (sunday?'日曜の復習':'今日のレッスン') : `${k.replaceAll('-','/')} のレッスン`;
  let meta='';
  if(!withinCourse(k)) meta='コース期間外です。';
  else if(sunday) meta='日曜は新出単語を増やさず、過去10語を復習します。';
  else meta=`DAY ${courseStudyDayNumber(k)} ・ ${k===START?'新出5語（初日）':'新出5語 + 復習5語'} ・ ${phaseFor(k).label}`;
  if(past && withinCourse(k) && !state.stickers[k]) meta += '　空白の日は、あとから学習してシールを貼れます。';
  $('#lessonMeta').textContent=meta;
  const btn=$('#startBtn'); btn.disabled=future||!withinCourse(k); btn.textContent=state.lessons[k]?.completed?'この日の5語をもう一度見る':(sunday?'10語を復習する':'5語を開く');
  $('#lessonArea').innerHTML='';
}

async function startLesson(){
  const k=selectedDate; if(k>todayKey()||!withinCourse(k)) return;
  if(isSunday(k)&&k!==START){ showView('review'); startReview(k,true); return; }
  let lesson=state.lessons[k];
  if(!lesson){
    $('#startBtn').disabled=true; $('#startBtn').textContent='5語を準備しています…';
    try{
      const seen=[...new Set(allLearnedWords().map(w=>w.word))];
      const res=await byokFetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:k,phase:phaseFor(k),day:courseStudyDayNumber(k),seenWords:seen})});
      const data=await res.json(); if(!res.ok) throw new Error(data.error||'生成に失敗しました');
      lesson={...data,date:k,completed:false,reviewOnly:false}; state.lessons[k]=lesson; save();
    }catch(e){
      $('#lessonArea').innerHTML=`<div class="card"><b>生成できませんでした。</b><div class="sub" style="margin-top:8px">${escapeHtml(e.message)}<br>右上の「API KEY」から、ご自身のOpenAI APIキーを設定してください。</div></div>`;
      $('#startBtn').disabled=false; $('#startBtn').textContent='もう一度試す'; return;
    }
  }
  renderLesson(lesson,k);
}

function renderLesson(lesson,k){
  const words=lesson.words||[];
  $('#lessonArea').innerHTML=`
    <div class="card">
      <div class="eyebrow">5 NEW WORDS</div>
      <div class="word-grid">${words.map(w=>`<div class="word"><div class="word-top"><strong>${escapeHtml(w.word)}</strong><span class="pos">${escapeHtml(w.pos||'')}</span></div><div class="meaning">${escapeHtml(w.meaning)}</div><div class="note">${escapeHtml(w.note||'')}</div></div>`).join('')}</div>
    </div>
    <div class="card">
      <div class="eyebrow">ONE SENTENCE</div>
      <div class="sentence">${escapeHtml(lesson.sentence||'')}</div>
      <div class="translation">${escapeHtml(lesson.translation||'')}</div>
      <div class="scene" id="sceneBox"><div class="placeholder"><span>🖼️</span>5語の情景をAIで1枚にします</div></div>
      <button class="secondary" id="imageBtn">AI画像を生成</button>
    </div>
    <div class="card">
      <h2>仕上げの10問</h2>
      <div class="sub">${k===START?'初日は新出5語の5問。':'新出5語 + 過去から5語の10問。'}最後まで終えると今日のシールが貼られます。</div>
      <button class="primary" id="quizBtn">クイズを始める</button>
      <div id="quizArea"></div>
    </div>`;
  $('#imageBtn').onclick=()=>generateImage(lesson,k);
  $('#quizBtn').onclick=()=>startQuiz(lesson,k);
  paintLessonImage(k);
}

async function generateImage(lesson,k){
  const btn=$('#imageBtn');btn.disabled=true;btn.textContent='画像を生成しています…';
  try{
    const res=await byokFetch('/api/image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:lesson.imagePrompt,sentence:lesson.sentence,words:lesson.words.map(w=>w.word)})});
    const data=await res.json(); if(!res.ok) throw new Error(data.error||'画像生成に失敗しました');
    await saveLessonImage(k,data.b64,data.mime||'image/webp');
    const url=await loadLessonImage(k); if(url)$('#sceneBox').innerHTML=`<img alt="今日の英文の情景" src="${url}">`; btn.textContent='画像を再生成';
  }catch(e){toast(e.message);btn.textContent='AI画像を生成';} finally{btn.disabled=false}
}

function pickReviewWords(exclude=[],n=5){ const ex=new Set(exclude.map(x=>x.toLowerCase())); const pool=allLearnedWords().filter(w=>!ex.has(w.word.toLowerCase())); shuffle(pool); const uniq=[]; const used=new Set(); for(const w of pool){if(!used.has(w.word)){used.add(w.word);uniq.push(w)}if(uniq.length>=n)break} return uniq; }
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function buildQuiz(words){
  const bank=allLearnedWords();
  return words.map((w,i)=>{
    const distract=[...new Set(bank.filter(x=>x.word!==w.word).map(x=>x.meaning))]; shuffle(distract);
    let opts=[w.meaning,...distract.slice(0,3)];
    const fallback=['〜を達成する','重要な','〜を避ける','影響','〜を認める','適切な']; for(const f of fallback){if(opts.length<4&&!opts.includes(f))opts.push(f)} shuffle(opts);
    return {q:`「${w.word}」に最も近い意味は？`,answer:w.meaning,options:opts};
  });
}
function startQuiz(lesson,k){
  const review=pickReviewWords(lesson.words.map(w=>w.word),5); const quiz=buildQuiz([...lesson.words,...review]); renderQuiz(quiz,$('#quizArea'),()=>completeLesson(lesson,k));
  $('#quizBtn').classList.add('hidden');
}
function renderQuiz(quiz,root,onDone){
  let idx=0,score=0; root.innerHTML='';
  function one(){
    if(idx>=quiz.length){root.innerHTML=`<div class="score"><div class="big">${score}/${quiz.length}</div><div class="sub">おつかれさまでした。</div></div>`;onDone(score,quiz.length);return}
    const q=quiz[idx]; root.innerHTML=`<div class="quiz-q"><div class="eyebrow">QUESTION ${idx+1} / ${quiz.length}</div><h3>${escapeHtml(q.q)}</h3><div class="answers">${q.options.map(o=>`<button class="answer" data-a="${escapeHtml(o)}">${escapeHtml(o)}</button>`).join('')}</div></div>`;
    root.querySelectorAll('.answer').forEach(b=>b.onclick=()=>{const ok=b.dataset.a===q.answer;if(ok)score++;root.querySelectorAll('.answer').forEach(x=>{x.disabled=true;if(x.dataset.a===q.answer)x.classList.add('correct')});if(!ok)b.classList.add('wrong');setTimeout(()=>{idx++;one()},650)});
  } one();
}
function completeLesson(lesson,k){ lesson.completed=true;state.lessons[k]=lesson;if(!state.stickers[k]){const [emoji,bg]=deterministicSticker(k);state.stickers[k]={emoji,bg,at:new Date().toISOString()};toast(`${emoji} シールを貼りました！`)}save();renderCalendar(); }

function startReview(k=todayKey(),sunday=false){
  const words=pickReviewWords([],10); const root=$('#reviewArea');
  if(words.length<4){root.innerHTML='<div class="sub" style="margin-top:14px">まず新出単語を学ぶと、ここに復習問題がたまります。</div>';return}
  const quiz=buildQuiz(words);renderQuiz(quiz,root,()=>{state.reviewLog[k]={completed:true,at:new Date().toISOString()};if(sunday&&!state.stickers[k]){const [emoji,bg]=deterministicSticker(k);state.stickers[k]={emoji,bg,at:new Date().toISOString()};toast(`${emoji} 復習シールを貼りました！`)}save();renderCalendar()});
}
$('#reviewBtn').onclick=()=>startReview();
$('#startBtn').onclick=startLesson;
