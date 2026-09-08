import './extract-inline.mjs';
import { JSDOM } from 'jsdom'; import { readFileSync } from 'node:fs';
process.env.FIREBASE_SERVICE_ACCOUNT='{"private_key":"x"}'; process.env.APP_SECRET='s'.repeat(40); process.env.TEST_MODE='true';
process.env.ADMIN_PIN='1234'; process.env.ADMIN_EMAILS='admin@test.com'; process.env.STAFF_PIN='9999';
const { default: handler } = await import('../netlify/functions/api.mjs');
const html = readFileSync(new URL('../public/admin.html', import.meta.url),'utf8').replace(/<script[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link[^>]*>/g,'');
const dom = new JSDOM(html,{url:'https://adeci26.netlify.app/admin.html',pretendToBeVisual:true}); const w=dom.window;
for (const k of ['window','document','localStorage','location','FormData','Event','Blob','URL']) { try{Object.defineProperty(globalThis,k,{value:w[k],configurable:true,writable:true});}catch{} }
globalThis.fetch = async (url, opts) => handler(new Request('https://adeci26.netlify.app'+url, opts));
globalThis.confirm=()=>true;
// registrar dos usuarios y una visita para que haya datos
const post=async(a,b,t)=>(await fetch('/api/'+a,{method:'POST',headers:{'content-type':'application/json',...(t?{authorization:'Bearer '+t}:{})},body:JSON.stringify(b)})).json();
const u1=await post('register',{nombre:'Ana',apellido:'Pérez',email:'ana@t.com'}); await post('eposter',{titulo:'Trabajo sobre biofilm',comentario:'Interesante'},u1.token);
await post('register',{nombre:'Beto',apellido:'Gómez',email:'beto@t.com'});
let fails=0; const ok=(c,m)=>{if(!c){fails++;console.log('  ✗',m);}else console.log('  ✓',m);}; const tick=(ms=60)=>new Promise(r=>setTimeout(r,ms));
const $=(s)=>w.document.querySelector(s), $$=(s)=>[...w.document.querySelectorAll(s)], text=()=>w.document.body.textContent;
await import('./admin-inline.mjs'); await tick();
ok($('#f'),'login de admin');
$('[name=email]').value='admin@test.com'; $('[name=pin]').value='1234'; $('#f').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true})); await tick(150);
ok($('.kpi') && text().includes('Registrados'), 'métricas renderizan');
console.log('   kpis:', $$('.kpi b').map(b=>b.textContent).join(' / ')); ok($$('.kpi b')[0].textContent==='2', 'cuenta 2 registrados');
for (const t of ['avisos','trivia','sorteo','staff','programa','config']) { $(`[data-tab=${t}]`).dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await tick(150); ok(!$('#wrap .error') && $('#wrap').textContent.length>50, 'pestaña '+t+' renderiza'); }
// sorteo con criterio visitas: no hay visitas → mensaje
$('[data-tab=sorteo]').dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await tick(150);
$('#modo').value='visitas'; $('#btnSorteo').dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await tick(1200);
ok(text().includes('No hay participantes elegibles') || $('#toast').textContent.includes('No hay'), 'sorteo sin elegibles avisa');
// programa overrides count
$('[data-tab=programa]').dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await tick(150);
ok($$('.ov').length===23, 'programa: 23 sesiones editables (sin pausas ni pósters)');
console.log(fails?`\n${fails} FALLARON`:'\nTODO OK'); process.exit(fails?1:0);
