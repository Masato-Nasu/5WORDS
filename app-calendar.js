function renderCalendar(){
  const y=calCursor.getFullYear(),m=calCursor.getMonth(); $('#monthTitle').textContent=`${y}年 ${m+1}月`;
  const first=new Date(y,m,1),last=new Date(y,m+1,0); let jsDay=first.getDay(); let mondayIndex=(jsDay+6)%7; const cells=[];
  for(let i=0;i<mondayIndex;i++)cells.push('<div class="day blank"></div>');
  for(let d=1;d<=last.getDate();d++){
    const date=new Date(y,m,d),k=localDateKey(date),future=k>todayKey(),course=withinCourse(k),st=state.stickers[k],sun=date.getDay()===0,today=k===todayKey();
    const selectable=course&&!future; const missed=selectable&&!st&&k<todayKey();
    cells.push(`<button class="day ${future?'future':''} ${sun?'sunday':''} ${today?'today':''} ${selectable?'selectable':''} ${missed?'missed':''}" data-date="${k}" ${selectable?'':'disabled'}><span class="day-num">${d}</span>${st?`<span class="sticker" style="background:${st.bg}">${st.emoji}</span>`:''}</button>`);
  }
  $('#calendarGrid').innerHTML=cells.join('');
  $('#calendarGrid').querySelectorAll('.selectable').forEach(b=>b.onclick=()=>{selectedDate=b.dataset.date;showView('today');renderLessonIntro();if(state.lessons[selectedDate])renderLesson(state.lessons[selectedDate],selectedDate)});
  $('#nextMonth').disabled=(y>2028||(y===2028&&m>=8)); $('#prevMonth').disabled=(y<2026||(y===2026&&m<=7));
}
$('#prevMonth').onclick=()=>{calCursor.setMonth(calCursor.getMonth()-1);renderCalendar()};
$('#nextMonth').onclick=()=>{calCursor.setMonth(calCursor.getMonth()+1);renderCalendar()};

$('#apiKeyBtn').onclick=openApiModal;
$('#closeKeyBtn').onclick=closeApiModal;
$('#apiModal').onclick=e=>{if(e.target===$('#apiModal'))closeApiModal()};
$('#toggleKeyBtn').onclick=()=>{const i=$('#apiKeyInput');const show=i.type==='password';i.type=show?'text':'password';$('#toggleKeyBtn').textContent=show?'隠す':'表示'};
$('#saveKeyBtn').onclick=()=>{
  const key=$('#apiKeyInput').value.trim();
  if(key.length<20){toast('APIキーを入力してください');return}
  localStorage.setItem(API_KEY_STORAGE,key);updateKeyStatus();closeApiModal();toast('APIキーをこの端末に保存しました');
};
$('#deleteKeyBtn').onclick=()=>{localStorage.removeItem(API_KEY_STORAGE);$('#apiKeyInput').value='';updateKeyStatus();closeApiModal();toast('保存したAPIキーを削除しました')};

// If today is outside the course during development/preview, open the course start date.
if(!withinCourse(selectedDate)) selectedDate=START;
renderLessonIntro(); updateStats(); updateKeyStatus(); renderCalendar();
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
