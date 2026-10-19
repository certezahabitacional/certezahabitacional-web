/* eslint-disable @typescript-eslint/no-require-imports -- Prueba Node en CommonJS. */
// Navegación real en Chromium con conceptos sintéticos, sin base de datos.
// node --test tests/recorrido-conceptos.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const ts = require('typescript');

test('recorrido guiado conserva posición y avanza sólo al confirmar un resultado', async () => {
  let playwright;
  try { playwright = require('playwright'); }
  catch {
    if (!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES) throw new Error('Instala Playwright para ejecutar esta prueba.');
    playwright = require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'playwright'));
  }
  const repo = path.resolve(__dirname, '..');
  const registros = [];
  const indices = new Map();
  function agregar(archivo, codigo) {
    if (indices.has(archivo)) return indices.get(archivo);
    const indice = registros.length;
    indices.set(archivo, indice);
    const texto = codigo ?? fs.readFileSync(archivo, 'utf8');
    const registro = { codigo: texto, deps: {} };
    registros.push(registro);
    for (const match of texto.matchAll(/require\(["']([^"']+)["']\)/g)) {
      const nombre = match[1];
      registro.deps[nombre] = agregar(require.resolve(nombre, { paths: [path.dirname(archivo)] }));
    }
    return indice;
  }
  const componente = path.join(repo, 'components/inspecciones/RecorridoConceptos.tsx');
  agregar(componente, ts.transpileModule(fs.readFileSync(componente, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  }}).outputText);
  const entrada = agregar(path.join(repo, 'prueba-recorrido.cjs'), `
    const React = require('react');
    const { createRoot } = require('react-dom/client');
    const { default: Recorrido, RetomarRecorrido } = require('./components/inspecciones/RecorridoConceptos.tsx');
    const root = createRoot(document.getElementById('root'));
    const iniciales = [{id:'a',concepto:'Piso',estadoV3:'REVISADO'},{id:'b',concepto:'Puerta',estadoV3:'PENDIENTE'},{id:'c',concepto:'Ventana',estadoV3:'PENDIENTE'}];
    window.datos = iniciales;
    window.renderizar = (datos = window.datos, usuario = 'inspector-1') => {
      window.datos = datos;
      root.render(React.createElement(React.StrictMode, null,
        React.createElement(RetomarRecorrido,{usuarioId:usuario,inspeccionId:'prueba'}),
        React.createElement(Recorrido,{key:usuario, usuarioId:usuario,inspeccionId:'prueba',partida:'Sala',ruta:'/panel/inspecciones/prueba/campo-v1?area=sala',conceptos:datos},
          datos.map(c => React.createElement('article',{key:c.id,id:'item-'+c.id},React.createElement('h2',null,c.concepto),React.createElement('input',{'aria-label':'Descripción '+c.id,defaultValue:''}))))));
    };
    window.renderizar();
  `);
  const modulos = registros.map((r) => `[function(require,module,exports){\n${r.codigo}\n},${JSON.stringify(r.deps)}]`).join(',');
  const bundle = `var process={env:{NODE_ENV:'development'}};var modules=[${modulos}],cache={};function load(id){if(cache[id])return cache[id].exports;var m=cache[id]={exports:{}};modules[id][0](n=>load(modules[id][1][n]),m,m.exports);return m.exports;}load(${entrada});`;
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', req.url === '/bundle.js' ? 'application/javascript' : 'text/html');
    res.end(req.url === '/bundle.js' ? bundle : '<!doctype html><html lang="es"><meta charset="utf-8"><div id="root"></div><script src="/bundle.js"></script></html>');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  let browser;
  try {
    browser = await playwright.chromium.launch({headless:true, executablePath:process.env.RECORRIDO_CHROMIUM_PATH || undefined, args:['--no-sandbox','--disable-dev-shm-usage']});
    const page = await browser.newPage({ viewport: { width:390,height:844 } });
    const errores=[];
    page.on('pageerror', e => errores.push(e.message));
    const url=`http://127.0.0.1:${server.address().port}/panel/inspecciones/prueba/campo-v1?area=sala`;
    await page.goto(url);
    await page.locator('#item-b').waitFor({state:'visible'});
    assert.equal(await page.locator('#item-a').isVisible(),false);
    await page.getByLabel('Descripción b').fill('Borrador en puerta');
    await page.getByRole('button',{name:'Siguiente',exact:true}).click();
    await page.getByRole('button',{name:'Anterior',exact:true}).click();
    assert.equal(await page.getByLabel('Descripción b').inputValue(),'Borrador en puerta');
    // Subir foto o generar IA no cambia el estado confirmado.
    await page.evaluate(()=>window.renderizar(window.datos.map(c=>({...c}))));
    assert.equal(await page.locator('#item-b').isVisible(),true);
    // Confirmación del servidor: avanza al pendiente c.
    await page.evaluate(()=>window.renderizar(window.datos.map(c=>c.id==='b'?{...c,estadoV3:'REVISADO'}:c)));
    await page.locator('#item-c').waitFor({state:'visible'});
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('certeza:recorrido:inspector-1:prueba')).itemId==='c');
    // Retomar sin fragmento recuerda la posición en este dispositivo.
    await page.goto(url);
    await page.locator('#item-c').waitFor({state:'visible'});
    // Un enlace explícito tiene prioridad sobre la posición recordada.
    await page.goto(url+'#item-a');
    await page.locator('#item-a').waitFor({state:'visible'});
    await page.getByRole('button',{name:'Ver todos',exact:true}).click();
    assert.equal(await page.locator('#item-c').isVisible(),true);
    // Otro inspector no hereda la posición del primero.
    await page.evaluate(()=>{history.replaceState(null,'',location.pathname+location.search);window.renderizar(undefined,'inspector-2');});
    await page.locator('#item-b').waitFor({state:'visible'});
    assert.deepEqual(errores,[]);
  } finally { if(browser) await browser.close(); await new Promise(r=>server.close(r)); }
});
