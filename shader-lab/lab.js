const launch=document.querySelector('#launch');const player=document.querySelector('#player');const shell=document.querySelector('#player-shell');const fullscreen=document.querySelector('#fullscreen');const message=document.querySelector('#player-message');
launch.addEventListener('click',()=>{player.src='player/index.html';player.hidden=false;document.querySelector('#cover').remove();fullscreen.hidden=false;message.textContent='실행 파일을 불러오는 중입니다. 로딩 후 목차에서 예제를 고르세요.';});
player.addEventListener('load',()=>{if(player.src)message.textContent='실험실 안의 목차·해설·슬라이더를 사용하세요.';});
fullscreen.addEventListener('click',async()=>{try{if(!document.fullscreenElement)await shell.requestFullscreen();else await document.exitFullscreen();}catch{message.textContent='오른쪽 ‘실험실만 열기’로 넓게 볼 수 있습니다.';}});
