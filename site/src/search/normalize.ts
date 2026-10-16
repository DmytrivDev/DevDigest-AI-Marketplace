// Normalization, tokenization and light stemming (spec 6.2, steps 1, 2, 6).

/** Lowercase, NFKC, `ё` -> `е`, apostrophes removed so "рев'ю" and "ревю" are the same word. */
export function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[’ʼ'`‘]/g, '');
}

/** Words on Unicode letter/digit boundaries; `pull-request` gives `pull-request`, `pull`, `request`. */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const chunk of normalize(text).split(/[^\p{L}\p{N}-]+/u)) {
    const word = chunk.replace(/^-+|-+$/g, '');
    if (!word) continue;
    out.push(word);
    if (word.includes('-')) for (const part of word.split('-')) if (part) out.push(part);
  }
  return out;
}

const ENDINGS = ['ами', 'ями', 'ові', 'еві', 'ого', 'ому', 'ів', 'їв', 'ом', 'ем', 'єм', 'ою', 'ею', 'ах', 'ях', 'ий', 'а', 'я', 'и', 'і', 'ї', 'у', 'ю', 'е', 'є', 'ь']
  .sort((a, b) => b.length - a.length);

const CYRILLIC = /^[\u0400-\u04FF]+$/;

/** Strips one common Ukrainian ending while the stem keeps at least 3 characters. Latin terms are untouched. */
export function stem(word: string): string {
  if (!CYRILLIC.test(word)) return word;
  for (const end of ENDINGS) {
    if (word.endsWith(end) && word.length - end.length >= 3) return word.slice(0, -end.length);
  }
  return word;
}
