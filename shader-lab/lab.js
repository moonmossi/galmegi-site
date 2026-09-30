const player=document.querySelector('#player'),shell=document.querySelector('#player-shell'),fullscreen=document.querySelector('#fullscreen'),message=document.querySelector('#player-message');
function launch(lesson='explosion'){player.src='player/index.html?lesson='+encodeURIComponent(lesson);player.hidden=false;document.querySelector('#cover')?.remove();fullscreen.hidden=false;message.textContent='실행 파일을 불러오는 중입니다. 시간 막대와 레이어 버튼으로 분해해 보세요.';shell.scrollIntoView({behavior:'smooth',block:'center'});}
document.querySelector('#launch').addEventListener('click',()=>launch());
document.querySelectorAll('[data-lesson]').forEach(button=>button.addEventListener('click',()=>launch(button.dataset.lesson)));
player.addEventListener('load',()=>{if(player.src)message.textContent='실험실: 목차 · 시간 탐색 · 레이어 켜기/끄기 · 원본 가이드';});
fullscreen.addEventListener('click',async()=>{try{if(!document.fullscreenElement)await shell.requestFullscreen();else await document.exitFullscreen();}catch{message.textContent='‘실험실만 열기’로 넓게 볼 수 있습니다.';}});
