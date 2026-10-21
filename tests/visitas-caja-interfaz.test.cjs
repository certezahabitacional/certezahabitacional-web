const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Ejecuta la pagina y las acciones reales con dependencias sustituidas.
// No es un navegador ni una prueba de autenticacion NextAuth.
function cargar(archivo, dependencias) {
  const fuente = fs.readFileSync(path.join(__dirname, '..', archivo), 'utf8');
  const compilado = ts.transpileModule(fuente, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const modulo = { exports: {} };
  const sandbox = { module: modulo, exports: modulo.exports, console, URLSearchParams,
    require(nombre) {
      if (!(nombre in dependencias)) throw new Error(`Dependencia no sustituida: ${nombre}`);
      return dependencias[nombre];
    },
  };
  vm.runInNewContext(compilado, sandbox, { filename: archivo });
  return modulo.exports;
}
function redirigir(destino) { const error = new Error('NEXT_REDIRECT'); error.destino = destino; throw error; }
function elementos(nodo, condicion, salida = []) {
  if (Array.isArray(nodo)) { for (const hijo of nodo) elementos(hijo, condicion, salida); }
  else if (nodo && typeof nodo === 'object') {
    if (condicion(nodo)) salida.push(nodo);
    elementos(nodo.props?.children, condicion, salida);
  }
  return salida;
}
const roles = { DIRECTOR: 'DIRECTOR', ADMINISTRADOR: 'ADMINISTRADOR', INSPECTOR: 'INSPECTOR' };
const acciones = { registrarPagoLibre() {}, autorizarExcepcionApertura() {}, autorizarExcepcionInicio() {} };
async function pagina(rol) {
  const jsx = (type, props) => ({ type, props });
  const resumen = { importe: 100, pagado: 0, saldo: 100, porcentajePagado: 0, estadoOperativo: 'SIN_AGENDAR', puedeAgendar: false, puedeLiberarCampo: false, cumpleApertura50: false, cumpleLiberacion100: false, alertaSobrepago: false };
  const datos = [{ id: 'cot-v2', folio: 'COT-TEST - V2', total: 100, montoPagado: 0, cliente: { nombre: 'Cliente ficticio' }, inmueble: { alias: 'Casa ficticia' }, versiones: [], pagos: [], inspeccion: null, excepcionApertura: false, excepcionInicio: false }];
  const modulo = cargar('app/panel/caja/page.tsx', {
    'node:crypto': { randomUUID: () => '01234567-1234-4123-8123-0123456789ab' },
    'next/link': { __esModule: true, default: 'a' },
    '@prisma/client': { RolUsuario: roles, EstadoCotizacion: { AUTORIZADA: 'AUTORIZADA' } },
    'next/navigation': { redirect: redirigir },
    '@/lib/alcance-zona': { obtenerUsuarioConAlcanceZona: async () => ({ id: 'usuario', rol, zonaId: 'zona', zona: { nombre: 'Prueba' } }), zonaEfectivaId: () => 'zona' },
    '@/lib/caja-finanzas': { calcularResumenFinancieroCaja: () => resumen },
    '@/lib/prisma': { prisma: { zona: { findMany: async () => [] }, cotizacion: { findMany: async () => datos } } },
    './actions': acciones,
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
  });
  return modulo.default({ searchParams: Promise.resolve({}) });
}
test('Los dos formularios de pago comparten la misma clave y cotizacion de V2', async () => {
  const html = await pagina('ADMINISTRADOR');
  const formularios = elementos(html, n => n.type === 'form' && n.props.action === acciones.registrarPagoLibre);
  assert.equal(formularios.length, 2);
  for (const form of formularios) {
    const campos = elementos(form, n => n.type === 'input');
    assert.equal(campos.find(n => n.props.name === 'operacionId').props.value, '01234567-1234-4123-8123-0123456789ab');
    assert.equal(campos.find(n => n.props.name === 'cotizacionId').props.value, 'cot-v2');
  }
});
test('Administracion no recibe formularios para autorizar excepciones', async () => {
  const html = await pagina('ADMINISTRADOR');
  assert.equal(elementos(html, n => n.type === 'form' && [acciones.autorizarExcepcionApertura, acciones.autorizarExcepcionInicio].includes(n.props.action)).length, 0);
});
test('Direccion recibe ambas excepciones en escritorio y celular', async () => {
  const html = await pagina('DIRECTOR');
  assert.equal(elementos(html, n => n.type === 'form' && n.props.action === acciones.autorizarExcepcionApertura).length, 2);
  assert.equal(elementos(html, n => n.type === 'form' && n.props.action === acciones.autorizarExcepcionInicio).length, 2);
});
test('Inspector no puede abrir Caja', async () => {
  await assert.rejects(pagina('INSPECTOR'), e => e.destino === '/acceso');
});
function moduloAcciones(rol, overrides = {}) {
  const llamadas = [], rutas = [];
  class ErrorOperacionCaja extends Error {}
  const modulo = cargar('app/panel/caja/actions.ts', {
    '@prisma/client': { RolUsuario: roles },
    'next/cache': { revalidatePath: ruta => rutas.push(ruta) },
    'next/navigation': { redirect: redirigir },
    '@/lib/alcance-zona': { obtenerUsuarioConAlcanceZona: async () => ({ id: 'usuario-real', rol }) },
    '@/lib/prisma': { prisma: { aislado: true } },
    '@/lib/caja-operaciones': { ErrorOperacionCaja,
      registrarPagoCaja: async (db, entrada) => { llamadas.push(entrada); return { inspeccionId: 'ins-v2', repetido: true }; },
      autorizarExcepcionCaja: async () => { llamadas.push('excepcion'); return { inspeccionId: null, repetido: false }; },
      ...overrides,
    },
  });
  return { modulo, llamadas, rutas, ErrorOperacionCaja };
}
test('Accion de pago utiliza el usuario autenticado y actualiza Inspecciones y Agenda', async () => {
  const { modulo, llamadas, rutas } = moduloAcciones('ADMINISTRADOR');
  const form = new FormData();
  for (const [k, v] of Object.entries({ usuarioId: 'director-falso', cotizacionId: 'cot-v2', monto: '50.01', operacionId: '01234567-1234-4123-8123-0123456789ab' })) form.set(k, v);
  await assert.rejects(modulo.registrarPagoLibre(form), e => e.message === 'NEXT_REDIRECT' && new URL(e.destino, 'https://test.invalid').searchParams.get('ok').includes('No se duplic'));
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].usuarioId, 'usuario-real');
  assert.equal(llamadas[0].cotizacionId, 'cot-v2');
  assert.ok(rutas.includes('/panel/agenda'));
  assert.ok(rutas.includes('/panel/inspecciones/ins-v2'));
});
test('Llamada directa de Administracion no puede autorizar excepciones', async () => {
  const { modulo, llamadas } = moduloAcciones('ADMINISTRADOR');
  await assert.rejects(modulo.autorizarExcepcionInicio(new FormData()), e => e.destino.includes('error='));
  await assert.rejects(modulo.autorizarExcepcionApertura(new FormData()), e => e.destino.includes('error='));
  assert.equal(llamadas.length, 0);
});
test('Accion de pago no transforma un fallo inesperado en confirmacion', async () => {
  const fallo = new Error('Falla simulada');
  const { modulo, rutas } = moduloAcciones('DIRECTOR', { registrarPagoCaja: async () => { throw fallo; } });
  await assert.rejects(modulo.registrarPagoLibre(new FormData()), e => e === fallo);
  assert.equal(rutas.length, 0);
});
