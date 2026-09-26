// Read-only catalog operations, shared by the UI and deterministic checks.
export const text = value => typeof value === 'string' ? value.trim() : '';
export const fold = value => String(value ?? '').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
export function normalizeCatalog(data) {
  if (!data || !Array.isArray(data.books)) throw new Error('Katalog biçimi geçersiz.');
  return data.books.flatMap((book, index) => {
    if (!book || !text(book.title)) return [];
    return [{id: String(index + 1), title: text(book.title), author: text(book.author),
      status: text(book.status), genre: text(book.genre), lang: text(book.lang),
      year: text(String(book.year ?? '')), date: text(book.date),
      pages: Number.isFinite(book.pages) && book.pages > 0 ? book.pages : null}];
  });
}
export function selectBooks(books, state) {
  const words = fold(state.q).split(/\s+/).filter(Boolean);
  const list = books.filter(book => words.every(word => fold(book.title + ' ' + book.author).includes(word)) &&
    (!state.status || book.status === state.status) && (!state.genre || book.genre === state.genre) &&
    (!state.lang || book.lang === state.lang));
  const collator = new Intl.Collator('tr', {numeric: true, sensitivity: 'base'});
  return list.sort((a,b) => {
    const av = a[state.sort], bv = b[state.sort];
    if (!av && bv) return 1;
    if (av && !bv) return -1;
    const order = state.sort === 'year' ? (Number(av) || 0) - (Number(bv) || 0) : collator.compare(av, bv);
    return order * state.dir || collator.compare(a.title,b.title) || Number(a.id)-Number(b.id);
  });
}
export function groupBooks(books, key) {
  if (!key) return [['', books]];
  const groups = new Map();
  for (const book of books) {
    const label = book[key] || 'Belirtilmedi';
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(book);
  }
  return [...groups].sort(([a],[b]) => a.localeCompare(b, 'tr'));
}
export function formatDate(value) {
  if (!value) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.split('-').reverse().join('.');
  return value;
}
