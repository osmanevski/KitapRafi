import {normalizeCatalog, selectBooks, groupBooks, fold, formatDate} from './catalog.mjs';
const $ = selector => document.querySelector(selector);
const state = {q:'', status:'', genre:'', lang:'', group:'', sort:'year', dir:-1};
let books = [], visible = [], selected = '', loadFailed = false, loading = false;
const dialog = $('#detail-dialog');
const number = value => value.toLocaleString('tr-TR');
function el(tag, cls, value) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (value != null) node.textContent = value;
  return node;
}
function button(label, action, cls) {
  const node = el('button', cls, label); node.type = 'button';
  node.addEventListener('click', action); return node;
}
function stateName(status) {
  const icon = {'Okundu':'✓', 'Okunuyor':'◐', 'Planlandı':'○'}[status] || '·';
  return icon + ' ' + (status || 'Belirtilmedi');
}
function stateClass(status) { return {'Okundu':'read', 'Okunuyor':'reading', 'Planlandı':'planned'}[status] || 'planned'; }
function announce(message) { $('#feedback').textContent = message; }
function populate(selector, key) {
  const select = $(selector);
  select.replaceChildren(el('option', null, 'Tümü')); select.firstChild.value = '';
  [...new Set(books.map(b => b[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr')).forEach(value => {
    const option = el('option', null, value); option.value = value; select.append(option);
  });
}
function sync() {
  $('#genre').value = state.genre; $('#language').value = state.lang; $('#group').value = state.group;
  $('#statuses').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.status === state.status)));
  document.querySelectorAll('th[data-key]').forEach(th => {
    const active = th.dataset.key === state.sort;
    th.setAttribute('aria-sort', active ? (state.dir === 1 ? 'ascending' : 'descending') : 'none');
    th.querySelector('.sort-arrow').textContent = active ? (state.dir === 1 ? '↑' : '↓') : '';
  });
}
function render() {
  sync(); visible = selectBooks(books, state);
  const fragment = document.createDocumentFragment();
  for (const [group, list] of groupBooks(visible, state.group)) {
    if (group) {
      const row = el('tr','group-row'), cell = el('td', null, '┌ ' + group); cell.colSpan = 6;
      cell.append(el('span',null,list.length + ' kitap')); row.append(cell); fragment.append(row);
    }
    for (const book of list) {
      const row = el('tr', selected === book.id ? 'selected' : ''); row.dataset.book = book.id;
      const titleCell = el('td'), title = button('',()=>openBook(book),'book-title');
      title.setAttribute('aria-label', book.title + ' — ayrıntıları aç');
      const index = el('span','number', book.id.padStart(3,'0')); index.setAttribute('aria-hidden','true');
      title.append(index,el('span','name',book.title)); titleCell.append(title);
      const status = el('td'); status.append(el('span','state ' + stateClass(book.status), stateName(book.status)));
      row.append(titleCell,el('td','year',book.year || '—'),el('td','author',book.author || '—'),status,
        el('td','genre',book.genre || '—'),el('td','lang',book.lang || '—'));
      fragment.append(row);
    }
  }
  $('#rows').replaceChildren(fragment);
  $('#result-count').textContent = `${visible.length} / ${books.length} kitap`;
  const flags = [];
  if (state.q) flags.push('ara=' + state.q);
  if (state.status) flags.push('durum=' + state.status);
  if (state.genre) flags.push('tür=' + state.genre);
  if (state.lang) flags.push('dil=' + state.lang);
  if (state.group) flags.push('grup=' + ({author:'yazar',genre:'tür',lang:'dil'}[state.group]));
  $('#list-command').textContent = 'ls kitaplar' + (flags.length ? ' · ' + flags.join(' · ') : '');
  $('#empty').hidden = visible.length > 0;
  $('#empty-text').textContent = books.length ? 'Bu arama ve filtrelere uyan kitap yok.' : 'Katalogda henüz kitap yok.';
  $('#empty-action').hidden = !books.length;
  $('#empty-action').textContent = 'Aramayı ve filtreleri temizle';
}
function refresh() { render(); $('#catalog').scrollTop = 0; }
function reset() {
  Object.assign(state,{q:'',status:'',genre:'',lang:'',group:'',sort:'year',dir:-1});
  $('#command').value = ''; announce(''); refresh();
}
function openDialog() { if (!dialog.open) dialog.showModal(); }
function openBook(book) {
  selected = book.id;
  $('#rows').querySelectorAll('[data-book]').forEach(row => row.classList.toggle('selected',row.dataset.book === selected));
  $('#detail-path').textContent = '~/kitaplar/' + book.id.padStart(3,'0');
  const detail = $('#detail'); detail.replaceChildren();
  detail.append(el('p','detail-command','❯ kitap ' + JSON.stringify(book.title)));
  const title = el('h2',null,book.title); title.id = 'detail-title'; detail.append(title);
  detail.append(el('p','author-name',book.author || 'Yazar belirtilmedi'));
  const meta = el('dl','metadata');
  [['Durum',stateName(book.status)],['Yıl',book.year],['Tür',book.genre],['Dil',book.lang],
   ['Sayfa',book.pages ? number(book.pages) : ''],['Bitirme tarihi',formatDate(book.date)]].forEach(([key,value])=>{
    const line = el('div'); line.append(el('dt',null,key),el('dd',key === 'Durum' ? 'state ' + stateClass(book.status) : '',value || '—')); meta.append(line);
  });
  detail.append(meta);
  const actions = el('div','detail-actions');
  if (book.author) actions.append(button('↳ Bu yazarın kitapları',()=>{
    dialog.close(); reset(); state.q = book.author; $('#command').value = state.q; refresh(); $('#command').focus();
  }));
  if (book.genre) actions.append(button('↳ Bu türdeki kitaplar',()=>{
    dialog.close(); reset(); state.genre = book.genre; refresh(); $('#genre').focus();
  }));
  detail.append(actions); openDialog();
}
function help() {
  $('#detail-path').textContent = '~/yardım';
  const title = el('h2',null,'Katalog komutları'); title.id = 'detail-title';
  $('#detail').replaceChildren(el('p','detail-command','❯ /yardım'),title);
  const description = el('p','dim','Kitap veya yazar adı yazarak ara. Filtreleri yukarıdan da seçebilirsin.');
  const list = el('dl','help-list');
  const commands = [
    ['/okundu · /okunuyor · /planlandı','Okuma durumuna göre filtrele.'],
    ['/tümü','Okuma durumu filtresini kaldır.'],
    ['/tür Roman','Bir tür seç. /tür tümü ile kaldır.'],
    ['/dil Türkçe','Bir dil seç. /dil tümü ile kaldır.'],
    ['/sırala yıl · kitap · yazar','Listeyi sırala. Sütun başlıkları yönü değiştirir.'],
    ['/grup yazar · tür · dil · yok','Listeyi gruplara ayır.'],
    ['/aç 12','Kayıt numarasıyla ayrıntıyı aç. Kitap adı da yazabilirsin.'],
    ['/temizle','Aramayı, filtreleri ve sıralamayı sıfırla.'],
    ['↑ ↓ · Enter · Esc','Satırlar arasında gezin, ayrıntıyı aç ve kapat. / veya ⌘K ile aramaya geç.']
  ];
  for (const [cmd,body] of commands) { list.append(el('dt',null,cmd),el('dd',null,body)); }
  $('#detail').append(description,list); openDialog();
}
function command(value) {
  const match = value.match(/^\/(\S+)\s*(.*)$/);
  if (!match) {
    state.q = value; refresh();
    if (visible.length) openBook(visible[0]);
    else announce('Eşleşen kitap yok. Başka bir kitap veya yazar adı dene.');
    return;
  }
  const cmd = fold(match[1]), arg = match[2].trim(), argFold = fold(arg);
  const statuses = {okundu:'Okundu',okunuyor:'Okunuyor',planlandi:'Planlandı',tumu:''};
  if (Object.hasOwn(statuses,cmd)) state.status = statuses[cmd];
  else if (cmd === 'yardim' || cmd === 'help') { help(); return; }
  else if (cmd === 'temizle') { reset(); return; }
  else if (cmd === 'tur' || cmd === 'dil') {
    const key = cmd === 'tur' ? 'genre' : 'lang';
    const choice = books.find(book => fold(book[key]) === argFold);
    if (!arg || argFold === 'tumu') state[key] = '';
    else if (choice) state[key] = choice[key];
    else { announce('Bu ' + (cmd === 'tur' ? 'tür' : 'dil') + ' katalogda yok; üstteki filtreden seçebilirsin.'); return; }
  } else if (cmd === 'sirala') {
    const key = {yil:'year',kitap:'title',yazar:'author'}[argFold];
    if (!key) { announce('Kullanım: /sırala yıl, /sırala kitap veya /sırala yazar'); return; }
    state.sort = key; state.dir = key === 'year' ? -1 : 1;
  } else if (cmd === 'grup') {
    const key = {yazar:'author',tur:'genre',dil:'lang',yok:''}[argFold];
    if (key === undefined) { announce('Kullanım: /grup yazar, tür, dil veya yok'); return; }
    state.group = key;
  } else if (cmd === 'ac') {
    const book = /^\d+$/.test(arg) ? books.find(b => Number(b.id) === Number(arg)) :
      arg && (books.find(b => fold(b.title) === argFold) || books.find(b => fold(b.title).includes(argFold)));
    if (!book) { announce('Kitap bulunamadı. /aç komutundan sonra kayıt numarası veya kitap adı yaz.'); return; }
    openBook(book); return;
  } else { announce('Bilinmeyen komut. /yardım ile komutları görebilirsin.'); return; }
  $('#command').value = state.q; announce(''); refresh();
}
async function load() {
  if (loading) return;
  loading = true; loadFailed = false;
  $('#catalog').setAttribute('aria-busy','true');
  $('#empty-action').hidden = true; $('#empty-text').textContent = 'Kitaplar getiriliyor…';
  const abort = new AbortController(); const timeout = setTimeout(()=>abort.abort(),15000);
  try {
    const response = await fetch('/kitaprafi/books.json',{cache:'no-cache',signal:abort.signal});
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json(); books = normalizeCatalog(data);
    populate('#genre','genre'); populate('#language','lang');
    const read = books.filter(b=>b.status === 'Okundu');
    const pages = read.reduce((sum,b)=>sum+(b.pages || 0),0);
    $('#summary').replaceChildren(el('strong',null,books.length + ' kitap'),document.createTextNode(' · '),
      el('span','count-read',read.length + ' okundu'),document.createTextNode(' · '),
      el('span','count-reading',books.filter(b=>b.status==='Okunuyor').length + ' okunuyor'),
      document.createTextNode(' · ' + number(pages) + ' sayfa'));
    $('#statuses').querySelectorAll('button').forEach(button=>{
      button.querySelector('span').textContent = button.dataset.status ? books.filter(b=>b.status === button.dataset.status).length : books.length;
    });
    const date = String(data.meta?.exported || '').slice(0,10);
    $('#status').textContent = date ? 'veri: ' + formatDate(date) : 'katalog hazır';
    render();
  } catch (_) {
    loadFailed = true; $('#summary').textContent = 'Katalog şu an yüklenemedi.';
    $('#status').textContent = 'bağlantı bekleniyor';
    $('#empty').hidden = false; $('#empty-text').textContent = 'Kitap listesine ulaşılamadı. Bağlantını kontrol edip yeniden dene.';
    $('#empty-action').hidden = false; $('#empty-action').textContent = 'Yeniden dene';
  } finally { clearTimeout(timeout); loading = false; $('#catalog').setAttribute('aria-busy','false'); }
}
$('#statuses').addEventListener('click',event=>{
  const button = event.target.closest('[data-status]'); if (!button || loading || loadFailed) return;
  state.status = button.dataset.status; announce(''); refresh();
});
for (const [id,key] of [['#genre','genre'],['#language','lang'],['#group','group']]) $(id).addEventListener('change',event=>{
  if (loading || loadFailed) return; state[key] = event.target.value; announce(''); refresh();
});
document.querySelectorAll('[data-sort]').forEach(button=>button.addEventListener('click',()=>{
  if (loading || loadFailed) return;
  if (state.sort === button.dataset.sort) state.dir *= -1;
  else { state.sort = button.dataset.sort; state.dir = state.sort === 'year' ? -1 : 1; }
  refresh();
}));
$('#reset').addEventListener('click',()=>{ if (!loading && !loadFailed) reset(); });
$('#empty-action').addEventListener('click',()=>loadFailed ? load() : reset());
$('#command').addEventListener('input',event=>{
  if (loading || loadFailed) return;
  announce(''); if (!event.target.value.startsWith('/')) { state.q=event.target.value.trim(); refresh(); }
});
$('#command-form').addEventListener('submit',event=>{
  event.preventDefault(); if (loading || loadFailed) { announce('Önce katalog yüklenmeli.'); return; }
  command($('#command').value.trim());
});
$('#help').addEventListener('click',help);
$('#close-detail').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{
  if (event.target !== dialog) return;
  const r = dialog.getBoundingClientRect();
  if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
});
$('#rows').addEventListener('keydown',event=>{
  if (!['ArrowDown','ArrowUp','Home','End'].includes(event.key)) return;
  const buttons = [...$('#rows').querySelectorAll('.book-title')], index = buttons.indexOf(document.activeElement);
  if (index < 0) return;
  event.preventDefault();
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length-1 : Math.max(0,Math.min(buttons.length-1,index+(event.key==='ArrowDown'?1:-1)));
  buttons[next].focus();
});
document.addEventListener('keydown',event=>{
  if (dialog.open) return;
  const editing = /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || '');
  if ((event.key === '/' && !editing) || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase()==='k')) {
    event.preventDefault(); $('#command').focus();
  } else if (document.activeElement === $('#command') && event.key === 'ArrowDown') {
    const first = $('#rows .book-title'); if (first) { event.preventDefault(); first.focus(); }
  } else if (document.activeElement === $('#command') && event.key === 'Escape') { reset(); }
});
load();
