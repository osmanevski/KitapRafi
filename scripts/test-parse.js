// 1000kitap liste HTML'inden kitap ayıklama mantığını test et
const sample = `
1
[/kitap/esir-sehrin-mahpusu--363986](https://1000kitap.com/kitap/esir-sehrin-mahpusu--363986)
### [Esir Şehrin Mahpusu](https://1000kitap.com/kitap/esir-sehrin-mahpusu--363986)
[Kemal Tahir](https://1000kitap.com/yazar/kemal-tahir)
8.5/10 · 17 Şub 09:06 · Puan vermedi
2
[/kitap/istanbul-hatirasi--186386](https://1000kitap.com/kitap/istanbul-hatirasi--186386)
### [İstanbul Hatırası](https://1000kitap.com/kitap/istanbul-hatirasi--186386)
[Ahmet Ümit](https://1000kitap.com/yazar/ahmet-umit)
`;

// Markdown formatında: "### [Kitap Adı](link)" hemen altında "[Yazar](yazar-link)"
function parseBooks(md) {
  const books = [];
  const lines = md.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const titleMatch = lines[i].match(/^### \[(.+?)\]\((https:\/\/1000kitap\.com\/kitap\/[^)]+)\)/);
    if (titleMatch) {
      const title = titleMatch[1].trim();
      const bookUrl = titleMatch[2].trim();
      // sonraki birkaç satırda yazarı ara
      let author = '';
      for (let j = i+1; j < Math.min(i+4, lines.length); j++) {
        const am = lines[j].match(/^\[(.+?)\]\(https:\/\/1000kitap\.com\/yazar\/[^)]+\)/);
        if (am) { author = am[1].trim(); break; }
      }
      books.push({ title, author, bookUrl });
    }
  }
  return books;
}

console.log(JSON.stringify(parseBooks(sample), null, 2));
