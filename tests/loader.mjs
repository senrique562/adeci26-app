export async function resolve(specifier, context, next) {
  if (specifier === 'firebase-admin/firestore') return { url: new URL('./mock-firestore.mjs', import.meta.url).href, shortCircuit: true };
  if (specifier === 'firebase-admin/app') return { url: new URL('./mock-app.mjs', import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
}
