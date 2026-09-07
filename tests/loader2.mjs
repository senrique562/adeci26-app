import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url'; import { dirname, join } from 'node:path';
const PUB = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
export async function resolve(specifier, context, next) {
  if (specifier === 'firebase-admin/firestore') return { url: new URL('./mock-firestore.mjs', import.meta.url).href, shortCircuit: true };
  if (specifier === 'firebase-admin/app') return { url: new URL('./mock-app.mjs', import.meta.url).href, shortCircuit: true };
  if (specifier.startsWith('/data/') || specifier.startsWith('/js/')) return { url: pathToFileURL(PUB + specifier).href, shortCircuit: true };
  return next(specifier, context);
}
