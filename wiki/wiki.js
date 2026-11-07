'use strict';

const byId = id => document.getElementById(id);
const normalize = value => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replaceAll('ø', 'o');
const make = (tag, content, className) => {
  const element = document.createElement(tag);
  if (content) element.textContent = content;
  if (className) element.className = className;
  return element;
};
const link = (name, href, className) => {
  const element = make('a', name, className);
  element.href = href;
  return element;
};
const classUrl = id => '/wiki/catalog/?class=' + encodeURIComponent(id);

function palettePage(families) {
  const entries = [
    ['Map', family => family.map],
    ['Dark panel ground', family => family.panel?.[0]],
    ['Dark panel ink', family => family.panel?.[1]],
    ['Dark panel accent', family => family.panel?.[2]],
    ['Light panel ground', family => family.panel?.[3]],
    ['Light panel ink', family => family.panel?.[4]],
    ['Light panel accent', family => family.panel?.[5]],
  ];
  byId('palette').replaceChildren(...Object.values(families).map(family => {
    const card = make('article', '', 'swatchcard');
    card.append(make('h3', family.name));
    for (const [label, read] of entries) {
      const color = read(family);
      if (!color) continue;
      const sample = make('div', '', 'sample');
      const chip = make('span', '', 'chip');
      chip.setAttribute('aria-hidden', 'true');
      chip.style.backgroundColor = color;
      sample.append(chip, document.createTextNode(label), make('code', color.toUpperCase()));
      card.append(sample);
    }
    return card;
  }));
}

function classPage(record, families) {
  byId('catalog').hidden = true;
  const detail = byId('detail');
  detail.hidden = false;
  document.title = record.title + ' | Music Atlas Wiki';
  detail.append(link('← Class catalog', '/wiki/catalog/'));
  const header = make('header');
  if (record.art) {
    const cover = make('img', '', 'cover');
    cover.src = record.art;
    cover.alt = '';
    cover.addEventListener('error', () => cover.remove(), {once: true});
    header.append(cover);
  }
  const heading = make('div');
  heading.append(make('p', families[record.family]?.name || 'School of Listening', 'eyebrow'), make('h1', record.title));
  header.append(heading);
  detail.append(header);
  if (record.description) detail.append(make('p', record.description, 'lede'));
  const actions = make('div', '', 'actions');
  for (const [name, url] of Object.entries(record.links)) actions.append(link(name, url, 'pill'));
  if (record.style) actions.append(link('On Music Atlas', '/#' + encodeURIComponent(record.style), 'pill'));
  detail.append(actions);
  if (record.parents.length) detail.append(make('p', 'From · ' + record.parents.join(', ')));
  if (record.children.length) detail.append(make('p', 'Led to · ' + record.children.join(', ')));
  if (record.lineage) detail.append(make('p', record.lineage));
  const sequences = Object.entries(record.sequences);
  detail.append(make('h2', 'Track list'));
  if (!sequences.length) {
    detail.append(make('p', 'Open a playlist to see its tracks.', 'muted'));
    return;
  }
  const select = make('select');
  select.id = 'sequence';
  const label = make('label', 'Track source');
  label.htmlFor = select.id;
  const list = make('ol', '', 'track-list');
  for (const [source] of sequences) select.add(new Option(source, source));
  if (sequences.length > 1) detail.append(label, select);
  detail.append(make('p', 'Ordered track entries from the curriculum snapshot. A service may show a newer or more complete list.', 'muted'));
  function draw() {
    list.replaceChildren(...record.sequences[select.value].map(([artist, song, album, position], index) => {
      const row = make('li');
      const info = make('div');
      info.append(make('b', song), make('small', album ? artist + ' · ' + album : artist));
      row.append(make('span', String(position ?? index + 1), 'seq'), info);
      return row;
    }));
  }
  select.addEventListener('change', draw);
  detail.append(list);
  draw();
}

function catalogPage(classes, families) {
  const params = new URLSearchParams(location.search);
  const id = params.get('class');
  if (id) {
    const record = classes.find(entry => entry.id === id);
    if (record) return classPage(record, families);
  }
  const query = byId('query');
  const family = byId('family');
  for (const [key, value] of Object.entries(families)) family.add(new Option(value.name, key));
  query.value = params.get('q') || '';
  const compare = new Intl.Collator('en', {numeric:true, sensitivity:'base'});
  const index = classes.map(record => {
    const songs = Object.values(record.sequences).flat();
    return {record, songs, text: normalize([record.title, record.description, ...songs.flat()].join(' '))};
  }).sort((a, b) => compare.compare(a.record.title, b.record.title));
  function draw() {
    const words = normalize(query.value.trim()).split(/\s+/).filter(Boolean);
    const matches = index.filter(item => (!family.value || item.record.family === family.value) &&
      words.every(word => item.text.includes(word)));
    byId('count').textContent = matches.length + (matches.length === 1 ? ' class' : ' classes') +
      (id ? ' · The requested class could not be found' : '');
    byId('results').replaceChildren(...matches.map(({record, songs}) => {
      const row = make('li');
      row.append(link(record.title, classUrl(record.id)));
      const match = words.length && songs.find(pair => words.every(word => normalize(pair.slice(0,2).join(' ')).includes(word)));
      if (match) row.append(make('small', match[0] + ' · ' + match[1]));
      else if (record.description) row.append(make('small', record.description));
      return row;
    }));
  }
  query.addEventListener('input', draw);
  family.addEventListener('change', draw);
  draw();
}

fetch('/wiki/catalog.json').then(response => {
  if (!response.ok) throw Error('Catalog unavailable');
  return response.json();
}).then(({classes, families}) => {
  if (byId('palette')) palettePage(families);
  else catalogPage(classes, families);
}).catch(() => {
  const status = byId('count') || byId('palette');
  status.textContent = 'The wiki data could not load. Refresh to try again.';
});
