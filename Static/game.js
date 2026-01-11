(() => {
  const SPAM_THRESHOLD = 6;      
  const WINDOW_MS = 1800;        

  //constants
  const stage = document.getElementById('stage');
  const fakeBtn = document.getElementById('fakeButton');
  const revealBtn = document.getElementById('revealBtn');
  const notGame = document.getElementById('notGame');
  const world = document.getElementById('world');
  const msg = document.getElementById('message');
  const hs1 = document.getElementById('hs1');
  const hs2 = document.getElementById('hs2');
  const world1 = document.getElementById('world1');
  const world2 = document.getElementById('world2');
  const world3 = document.getElementById('world3');
  const end = document.getElementById('end');
  
  let clickTimes = [];

  // ---------- Back / Close behavior ----------
  fakeBtn.addEventListener('click', ()=> {
    if(window.history.length > 1) {
        window.history.back();
    } else {
        flashMessage("No previous page available.");
    }
  });

  // ---------- spam ----------
  if (revealBtn) {
    revealBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const now = Date.now();
      clickTimes.push(now);
      clickTimes = clickTimes.filter(t => now - t <= WINDOW_MS);

      console.debug('[reveal] clicks:', clickTimes.length);

      if (clickTimes.length < SPAM_THRESHOLD) {
        flashMessage(`Keep trying... (${clickTimes.length}/${SPAM_THRESHOLD})`);
      }

      if (clickTimes.length >= SPAM_THRESHOLD) {
        revealNextStage();
        clickTimes = [];
      }
    });

    // long-term fallback
    (function allowLongTermCheat() {
      let globalClicks = 0;
      revealBtn.addEventListener('click', () => {
        globalClicks++;
        if (globalClicks >= 30 && world && world.getAttribute('aria-hidden') === 'true') revealNextStage();
      });
    })();
  } else {
    console.warn('#revealBtn not found — spam-detection handler not attached');
  }

  // helper: flash message at optional coordinates
  let msgTimer = null;
  function flashMessage(text, x, y, ms = 1400) {
    if (!stage) return;

    // create new message element
    const bubble = document.createElement('div');
    bubble.className = 'msg';
    bubble.textContent = text;

    // set position at cursor
    bubble.style.left = x + "px";
    bubble.style.top = y + "px";
    bubble.style.transform = "translate(-50%, -100%)";

    // add to stage
    stage.appendChild(bubble);

    // force reflow for animation
    void bubble.offsetWidth;

    // trigger fade-in / slight slide
    bubble.classList.add('show');

    // remove after timeout
    setTimeout(() => {
      bubble.remove();
    }, ms);
  }

  // ---------- Reveal stages ----------
  const stages = [notGame, world, world1, world2, world3, end];
  let currentStageIndex = 0;

  function revealNextStage() {
    const current = stages[currentStageIndex];
    if (current) {
      current.setAttribute('aria-hidden', 'true');
      current.style.display = 'none';
    }

    if (currentStageIndex < stages.length - 1) {
      currentStageIndex++;
      const next = stages[currentStageIndex];
      if (next) {
        next.setAttribute('aria-hidden', 'false');
        next.style.display = 'block';
      }
    }
  }

  // ---------- random message ----------
  const Messages = ["You poke at the page. Nothing happens.","OUCH!!!","STOP!!","Nothing here, move along!","You wave at the screen. Hi!"];
  if (stage) {
    stage.addEventListener('click', (e) => {
      if (e.target === fakeBtn || e.target === revealBtn) return;
      // Show random message at cursor position
        if (currentStageIndex === 0 && notGame) {
          flashMessage(Messages[Math.floor(Math.random() * Messages.length)], e.clientX, e.clientY);}
    });
  }



  // ---------- world 0 ----------
  const darkness = document.querySelector('.darkness');
  

  const glowRadius = 100; // same as before
  const sunRadius = 0;   // size of the spotlight

  // Update mask at given coordinates
  function updateMask(x, y) {
      const inner = sunRadius;
      const outer = sunRadius + glowRadius;

      darkness.style.mask = `radial-gradient(circle ${outer}px at ${x}px ${y}px,
          transparent ${inner}px,
          rgba(0,0,0,0.5) ${inner + glowRadius * 0.5}px,
          black ${outer}px)`;
      darkness.style.webkitMask = darkness.style.mask;
  }

  // Track mouse
  document.addEventListener('mousemove', e => {
      const rect = world.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      updateMask(x, y);
  });


  // password input
  const input = [];
  const password = ["b","4","k","a","h","t"];

  document.addEventListener('keydown', (ev) => {
    if (world && world.getAttribute('aria-hidden') === 'false') {

      input.push(ev.key);

      
      if (input.length > password.length) {
        input.shift();
      }

     
      if (input.length === password.length &&
          input.every((v, i) => v === password[i])) {

        revealNextStage();
        input.length = 0; 
      }
    }
  });



  // ---------- world 1 ----------
  const cube = document.getElementById('cube');
  const faces = Array.from(document.querySelectorAll('.face'));
  const button = document.getElementById('teleportBtn');

  let cubeRotation = { x: 0, y: 0 };
  let dragging = false;
  let lastMouse = { x:0, y:0 };

  // rotation
  document.addEventListener('mousedown', e => {
    dragging = true;
    lastMouse = { x:e.clientX, y:e.clientY };
  });
  document.addEventListener('mouseup', () => dragging = false);
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    cubeRotation.y += (e.clientX - lastMouse.x) * 0.5;
    cubeRotation.x -= (e.clientY - lastMouse.y) * 0.5;
    cube.style.transform = `rotateX(${cubeRotation.x}deg) rotateY(${cubeRotation.y}deg)`;
    lastMouse = { x:e.clientX, y:e.clientY };
  });

  // teleport
  button.addEventListener('click', () => {
    const randomFace = faces[Math.floor(Math.random() * faces.length)];

    // Get button size in % relative to face


    // Pick top/left so the button stays fully inside the face
    const top = Math.random() * (95);
    const left = Math.random() * (95);

    button.style.position = 'absolute';
    button.style.top = top + "%";
    button.style.left = left + "%";

    randomFace.appendChild(button);
  });

let times_pressed = 0;
const timerDisplay = document.querySelector('.timer');

function createCountdown(seconds) {
  let remaining = seconds * 100; // store in hundredths
  let running = false;
  let intervalId = null;

  function updateDisplay() {
    // convert back to seconds with 2 decimal places
    timerDisplay.textContent = (remaining / 100).toFixed(2);
  }

  function tick() {
    remaining--;
    updateDisplay();

    if (remaining <= 0) {
      clearInterval(intervalId);
      intervalId = null;
      running = false;

      // FAILED state
      timerDisplay.textContent = "FAILED";
      times_pressed = 0;

      console.log("Countdown finished!");
    }
  }

  function start() {
    if (intervalId) clearInterval(intervalId);

    remaining = seconds * 100;
    running = true;
    updateDisplay();

    intervalId = setInterval(tick, 10); // update every 10ms (0.01s)
  }

  function reset() {
    clearInterval(intervalId);
    intervalId = null;

    remaining = seconds * 100;
    running = true;
    updateDisplay();

    intervalId = setInterval(tick, 10);
  }

  return {
    start,
    reset,
    isRunning: () => running,
    getRemaining: () => (remaining / 100)
  };
}

const timer = createCountdown(3);
timer.start();

button.addEventListener('click', () => {
    timer.reset();
    times_pressed++;
    console.log("Countdown reset to:", timer.getRemaining().toFixed(2));

    if (times_pressed > 10) {
        revealNextStage();
        times_pressed = 0;
    }
});



// world 2

const dieEls = [document.getElementById('die1'), document.getElementById('die2')];
const valEls = [document.getElementById('val1'), document.getElementById('val2')];
const rollBtn = document.getElementById('rollBtn');
const clearBtn = document.getElementById('clearBtn');
const totalEl = document.getElementById('total');
const lastEl = document.getElementById('last');
const historyEl = document.getElementById('history');


function randDie(){ return Math.floor(Math.random()*20) + 1; }


function rollAll(){
const d1 = randDie();
const d2 = randDie();
valEls[0].textContent = d1;
valEls[1].textContent = d2;
const total = d1 + d2;
totalEl.textContent = total;
lastEl.textContent = `${d1} & ${d2}`;
addHistory(d1, d2);

if (total === 40){revealNextStage();}
}


function addHistory(a,b){
const div = document.createElement('div');
div.className = 'history-item';
div.textContent = `${a} + ${b} = ${a+b}`;
historyEl.prepend(div);
}


rollBtn.addEventListener('click', rollAll);
clearBtn.addEventListener('click', () => {
historyEl.innerHTML = '';
valEls.forEach(v => v.textContent = '—');
totalEl.textContent = '—';
lastEl.textContent = '—';
});


window.addEventListener('keydown', e => {
if(e.code === 'Space'){
e.preventDefault();
rollAll();
}
});

// world 3
const runcode = document.getElementById('runcode');
const codeInput = document.getElementById('codeInput');
const outputEl = document.getElementById('output');

codeInput.addEventListener('keydown', function(event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        alert("Not the easy way! 🚫");
    }
});

codeInput.addEventListener('contextmenu', function(event) {
    event.preventDefault();
});

codeInput.addEventListener('paste', function(event) {
    event.preventDefault();
    alert('Nice try!');
});


runcode.addEventListener('click', () => {
  const code = codeInput.value;
    if (code.trim() === "++++++++++[>+++++++>++++++++++>+++>+<<<<-]>++.>+.+++++++..+++.>++.<<+++++++++++++++.>.+++.------.--------.>+.>.") {
 
      revealNextStage();
    }})


// dev skip

//document.addEventListener('keydown', (ev) => {
//  if (ev.key === "s"){
//    revealNextStage();}
// });
  

})();
