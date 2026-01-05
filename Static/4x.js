
const stage = document.getElementById('stage');


function TileFinder(x, y) {
  let el = document.elementFromPoint(x, y);
  while (el && el !== document.body) {
    if (el.classList && el.classList.contains('tile')) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}


function div(tile) {
  if (!tile) return;


  if (tile.classList.contains('tile-wrapper')) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'tile-wrapper';

  
  for (let i = 0; i < 4; i++) {
    const child = document.createElement('div');
    child.className = 'tile show-border';
    wrapper.appendChild(child);
  }

  tile.replaceWith(wrapper);
}


stage.addEventListener('click', (e) => {
  
  const x = e.clientX;
  const y = e.clientY;

  const leaf = TileFinder(x, y);
  if (!leaf) return; 

  div(leaf);
});
