import assert from 'node:assert/strict';
import {normalizeCatalog,selectBooks,groupBooks,fold,formatDate} from '../public/vt/catalog.mjs';
const source={books:[
  {title:'İttihatçılık',author:'',status:'Planlandı',year:'',genre:'Tarih',lang:'Türkçe'},
  {title:'Dava',author:'Franz Kafka',status:'Okundu',year:'2024',genre:'Roman',lang:'Almanca',pages:216,date:'2024-03-08'},
  {title:'Yol Ayrımı',author:'Kemal Tahir',status:'Okunuyor',year:'2023',genre:'Roman',lang:'Türkçe'},
  {title:'<img src=x onerror=alert(1)>',author:'Test',status:'Okundu',year:'',pages:null},
]};
const before=JSON.stringify(source),books=normalizeCatalog(source);
const base={q:'',status:'',genre:'',lang:'',sort:'year',dir:-1};
assert.equal(fold('İTTİHATÇILIK'),fold('ittihatcilik'));
assert.equal(selectBooks(books,{...base,q:'ittihatcilik'})[0].id,'1');
assert.equal(selectBooks(books,{...base,q:'kafka',status:'Okundu',lang:'Almanca'}).length,1);
assert.equal(selectBooks(books,{...base,q:'kafka',status:'Planlandı'}).length,0);
assert.equal(selectBooks(books,base)[0].title,'Dava');
assert.equal(selectBooks(books,{...base,dir:1})[0].title,'Yol Ayrımı');
assert.equal(selectBooks(books,{...base,sort:'author',dir:-1}).at(-1).id,'1');
const grouped=groupBooks(books,'lang');
assert.equal(new Set(grouped.flatMap(([_,items])=>items.map(b=>b.id))).size,4);
assert.ok(grouped.some(([label])=>label==='Belirtilmedi'));
assert.equal(formatDate('2024-03-08'),'08.03.2024');
assert.equal(formatDate(''),'—');
assert.equal(JSON.stringify(source),before);
assert.equal(books[3].title,'<img src=x onerror=alert(1)>'); // The renderer uses textContent, not markup.
assert.throws(()=>normalizeCatalog({}),/geçersiz/);
assert.deepEqual(normalizeCatalog({books:[null,{}, {title:''}]}),[]);
console.log('Terminal catalog: normalization, Turkish search, combined filters, sorting and groups passed.');
