/* eslint-disable @typescript-eslint/no-require-imports -- Pruebas Node de páginas del servidor. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { EstadoInspeccion, RolUsuario } = require('@prisma/client');

// Ejecuta las páginas reales con registros sintéticos. No usa credenciales,
// inspecciones reales ni escrituras sobre una base de datos.
function cargarPagina(ruta, opciones = {}) {
  const contexto = { planConsultado: false, consultasLegadas: 0 };
  const codigo = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', ruta), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const usuario = { id: 'director', activo: true, rol: opciones.rol ?? RolUsuario.DIRECTOR, inspector: null };
  const inspeccion = { id: 'expediente', numeroInspeccion: opciones.visita ?? 1, estado: EstadoInspeccion.EN_PROCESO };
  const mocks = {
    'react/jsx-runtime': require('react/jsx-runtime'),
    '@prisma/client': { EstadoInspeccion, RolUsuario },
    '@/auth': { auth: async () => ({ user: { id: 'director' } }) },
    'next/navigation': {
      redirect: (url) => { throw new Error(`REDIRECT:${url}`); },
      notFound: () => { throw new Error('NOT_FOUND'); },
    },
    '@/lib/prisma': { prisma: {
      usuario: { findUnique: async () => usuario },
      inspeccion: { findUnique: async () => inspeccion },
      $queryRaw: async () => { contexto.consultasLegadas++; throw new Error('CONSULTA_LEGADA'); },
    } },
    '@/lib/recorrido-plan-confirmado': { obtenerPlanConfirmado: async () => {
      contexto.planConsultado = true;
      return opciones.sinPlan ? null : [{ nombre: 'Plan confirmado' }];
    } },
  };
  const modulo = { exports: {} };
  new Function('require', 'module', 'exports', codigo)((nombre) => mocks[nombre] ?? {}, modulo, modulo.exports);
  return { pagina: modulo.exports.default, contexto };
}

for (const ruta of [
  'app/panel/inspecciones/[id]/puntos-criticos/hermeticidad/page.tsx',
  'app/panel/inspecciones/[id]/revision-final-inspector/page.tsx',
]) {
  const ejecutar = (pagina) => pagina({ params: Promise.resolve({ id: 'expediente' }), searchParams: Promise.resolve({ fase: 'inicio' }) });
  test(`${ruta}: un plan confirmado abre el recorrido vigente antes de leer el catálogo antiguo`, async () => {
    const { pagina, contexto } = cargarPagina(ruta);
    await assert.rejects(ejecutar(pagina), /REDIRECT:\/panel\/inspecciones\/expediente\/campo-v1$/);
    assert.equal(contexto.consultasLegadas, 0);
  });
  test(`${ruta}: el redireccionamiento conserva la autorización`, async () => {
    const { pagina, contexto } = cargarPagina(ruta, { rol: RolUsuario.CLIENTE });
    await assert.rejects(ejecutar(pagina), /REDIRECT:\/acceso$/);
    assert.equal(contexto.planConsultado, false);
  });
  test(`${ruta}: los expedientes sin plan conservan su flujo previo`, async () => {
    const { pagina, contexto } = cargarPagina(ruta, { sinPlan: true });
    await assert.rejects(ejecutar(pagina), /CONSULTA_LEGADA/);
    assert.equal(contexto.consultasLegadas, 1);
  });
  test(`${ruta}: una visita de seguimiento no entra al recorrido V1`, async () => {
    const { pagina, contexto } = cargarPagina(ruta, { visita: 2 });
    await assert.rejects(ejecutar(pagina), /REDIRECT:\/panel\/inspecciones\/expediente(?:\/captura)?$/);
    assert.equal(contexto.planConsultado, false);
  });
}
