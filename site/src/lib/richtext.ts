// Inline text with `code` spans, used for short strings (descriptions, release notes, guide tables).

export interface TextPart {
  text: string;
  code: boolean;
}

export function richParts(text: string): TextPart[] {
  const out: TextPart[] = [];
  text.split('`').forEach((p, i) => {
    if (p) out.push({ text: p, code: i % 2 === 1 });
  });
  return out;
}

export const stripCode = (text: string): string => text.replace(/`/g, '');
