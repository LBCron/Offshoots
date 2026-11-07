// The wiki's chrome: a contents list for the page in the sidebar, built from its h2 and h3
// headings; an id and an anchor link on each heading so a section can be linked to; and
// the contents entry for the section on screen marked as you scroll. Nothing here touches
// the catalog or its data; that is wiki.js.
'use strict';
(function(){
  const main = document.getElementById('main');
  const side = document.querySelector('.sidebar');
  if (!main || !side) return;
  const slug = s => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const seen = new Set();
  const heads = [...main.querySelectorAll('h2, h3')].filter(h => !h.closest('#detail, .infobox'));
  for (const h of heads) {
    if (!h.id) { let id = slug(h.textContent) || 'section', n = 2; while (seen.has(id) || document.getElementById(id)) id = slug(h.textContent) + '-' + n++; h.id = id; }
    seen.add(h.id);
    const a = document.createElement('a');
    a.className = 'anchor'; a.href = '#' + h.id; a.textContent = '#'; a.setAttribute('aria-label', 'Link to this section');
    h.append(a);
  }
  if (heads.length < 2) return;
  const toc = document.createElement('div'); toc.className = 'toc';
  const label = document.createElement('small'); label.textContent = 'On this page';
  const ol = document.createElement('ol');
  const links = new Map();
  for (const h of heads) {
    const li = document.createElement('li'); li.className = h.tagName.toLowerCase();
    const a = document.createElement('a'); a.href = '#' + h.id; a.textContent = h.firstChild.textContent.trim();
    li.append(a); ol.append(li); links.set(h, a);
  }
  toc.append(label, ol); side.append(toc);
  // the entry for the section whose heading was last to pass the top of the window
  let ticking = false;
  const mark = () => { ticking = false;
    let cur = heads[0];
    for (const h of heads) { if (h.getBoundingClientRect().top <= 80) cur = h; else break; }
    links.forEach((a, h) => a.classList.toggle('on', h === cur)); };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(mark); } }, {passive:true});
  mark();
})();
