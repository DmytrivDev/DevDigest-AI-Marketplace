// EN + UK stop words (spec 6.2 step 3). Seeded from the design prototype.

const EN = 'i need a an the for to of me my some that which with want looking find something help please in on and or is are be it this want show get give';
const UK = 'мені мене треба потрібен потрібна потрібно потрібні для хочу знайти який яка яке які я щось щоб на в у і та або це є мій моя моє дай покажи допоможи будь ласка про з із до від';

export const STOP_WORDS: ReadonlySet<string> = new Set([...EN.split(' '), ...UK.split(' ')]);
