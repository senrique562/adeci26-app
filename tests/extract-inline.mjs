import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync(new URL('../public/admin.html', import.meta.url), 'utf8');
const m = [...html.matchAll(/<script(?: type="module")?>([\s\S]*?)<\/script>/g)];
writeFileSync(new URL('./admin-inline.mjs', import.meta.url), m[m.length - 1][1]);
