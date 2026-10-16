// Usage: npx tsx tests/helpers/make-repo.ts <dir>
// Creates a sample marketplace repo with components and releases for manual checks:
//   DD_REPO_ROOT=<dir> npm run dev
import { resolve } from 'node:path';
import { createPrototypeRepo } from './repo';

const dir = process.argv[2];
if (!dir) throw new Error('usage: make-repo.ts <dir>');
createPrototypeRepo(resolve(dir));
console.log(`sample repo created at ${resolve(dir)}`);
