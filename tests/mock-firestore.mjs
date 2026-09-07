// Firestore en memoria para probar api.mjs sin red.
const store = new Map(); // "col/doc" -> data
const INC = Symbol('inc');
export const FieldValue = { increment: (n) => ({ [INC]: n }) };
function applyMerge(prev, data) {
  const out = { ...(prev || {}) };
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && INC in v) out[k] = (out[k] || 0) + v[INC];
    else if (v && typeof v === 'object' && !Array.isArray(v) && prev && prev[k] && typeof prev[k] === 'object' && !Array.isArray(prev[k])) out[k] = { ...prev[k], ...v };
    else out[k] = v;
  }
  return out;
}
class Doc {
  constructor(col, id) { this.col = col; this.id = id; this.key = col + '/' + id; }
  async get() { const d = store.get(this.key); return { exists: !!d, id: this.id, data: () => d ? JSON.parse(JSON.stringify(d)) : undefined }; }
  async set(data, opts) { store.set(this.key, opts?.merge ? applyMerge(store.get(this.key), data) : JSON.parse(JSON.stringify(data))); }
  async update(data) { store.set(this.key, applyMerge(store.get(this.key), data)); }
  async delete() { store.delete(this.key); }
}
class Query {
  constructor(col) { this.col = col; this._order = null; this._limit = null; }
  orderBy(f, dir) { this._order = [f, dir]; return this; }
  limit(n) { this._limit = n; return this; }
  async get() {
    let docs = [...store.entries()].filter(([k]) => k.startsWith(this.col + '/')).map(([k, v]) => ({ id: k.split('/')[1], data: () => JSON.parse(JSON.stringify(v)) }));
    if (this._order) { const [f, dir] = this._order; docs.sort((a, b) => (a.data()[f] - b.data()[f]) * (dir === 'desc' ? -1 : 1)); }
    if (this._limit) docs = docs.slice(0, this._limit);
    return { docs, forEach: (fn) => docs.forEach(fn), size: docs.length };
  }
}
class Col extends Query {
  doc(id) { return new Doc(this.col, id); }
  async add(data) { const id = 'auto' + Math.random().toString(36).slice(2, 8); await new Doc(this.col, id).set(data); return { id }; }
}
const fs = {
  collection: (c) => new Col(c),
  batch: () => { const ops = []; return { set: (ref, d) => ops.push(() => ref.set(d)), commit: async () => { for (const o of ops) await o(); } }; },
};
export const getFirestore = () => fs;
export const _store = store;
