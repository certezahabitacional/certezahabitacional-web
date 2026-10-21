// Run: TZ=UTC node --test tests/agenda-zona-horaria.test.cjs
// Exercise the real page/action; only auth, persistence and side effects are mocked.
// No production records, credentials or database connections are used.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');
const { fromZonedTime } = require('date-fns-tz');
const root = resolve(__dirname, '..');
const values = (names) => Object.fromEntries(names.map((name) => [name, name]));
const enums = {
  EstadoInspeccion: values(['PROGRAMADA', 'EN_PROCESO', 'FINALIZADA', 'CANCELADA']),
  RolUsuario: values(['DIRECTOR', 'ADMINISTRADOR', 'VENDEDOR', 'GERENTE', 'COORDINADOR', 'INSPECTOR', 'CLIENTE']),
  TipoEvento: { EDITAR: 'EDITAR' },
};
function fixture(zone, instant, options = {}) {
  const row = {
    id: 'test-inspection', folio: 'TEST-001', numeroInspeccion: 1, estado: 'PROGRAMADA',
    fechaProgramada: new Date(instant), direccion: 'Test address',
    zonaId: 'test-zone', zonaHoraria: options.fallback || zone,
    zona: zone ? { nombre: 'Test zone', codigo: 'TEST', zonaHoraria: zone } : null,
    cliente: { nombre: 'Test client' }, inmueble: { alias: 'Test property' },
    cotizacion: { folio: 'TEST-QUOTE' }, cotizacionId: 'test-quote',
  };
  const writes = [], audits = [], invalidated = [];
  const mocks = {
    '@prisma/client': enums,
    'next/link': { __esModule: true, default: () => null },
    'next/navigation': { redirect(url) { throw Object.assign(new Error('redirect'), { url }); } },
    'next/cache': { revalidatePath(path) { invalidated.push(path); } },
    '@/lib/alcance-zona': {
      obtenerUsuarioConAlcanceZona: async () => ({ id: 'test-user', rol: options.role || 'DIRECTOR' }),
      zonaEfectivaId: () => null,
      puedeAccederZona: () => options.allowed !== false,
    },
    '@/lib/prisma': { prisma: {
      zona: { findMany: async () => row.zona ? [{ id: row.zonaId, ...row.zona }] : [] },
      inspeccion: {
        findMany: async () => [row],
        findUnique: async (args) => {
          assert.equal(args.select.zonaHoraria, true);
          assert.equal(args.select.zona.select.zonaHoraria, true);
          return row;
        },
        update: async (args) => { writes.push(args); return row; },
      },
    } },
    '@/lib/auditoria': { registrarAuditoria: async (args) => audits.push(args) },
    '@/lib/visitas-etiqueta': {
      etiquetaVisita: (folio, numero = 1) =>
        numero <= 1 ? `${folio} — V1 — Inspección inicial` : `${folio} — V${numero} — Seguimiento de V${numero - 1}`,
    },
    './actions': { actualizarAgenda() {} },
  };
  function load(file) {
    const source = readFileSync(resolve(root, file), 'utf8');
    const output = ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText;
    const mod = { exports: {} };
    new Function('require', 'module', 'exports', output)(
      (id) => Object.hasOwn(mocks, id) ? mocks[id] : require(id), mod, mod.exports,
    );
    return mod.exports;
  }
  return { row, writes, audits, invalidated, load };
}
function inputs(node, result = []) {
  if (Array.isArray(node)) { for (const child of node) inputs(child, result); }
  else if (node && typeof node === 'object' && node.props) {
    if (node.type === 'input' && node.props.type === 'datetime-local') result.push(node.props.defaultValue);
    inputs(node.props.children, result);
  }
  return result;
}
function form(local) {
  const data = new FormData();
  data.set('inspeccionId', 'test-inspection'); data.set('fechaProgramada', local);
  data.set('estado', 'PROGRAMADA');
  // A client cannot override the server-side inspection time zone.
  data.set('zonaHoraria', 'UTC');
  return data;
}
const cases = [
  ['America/Ciudad_Juarez', '2026-10-19T14:00', '2026-10-19T20:00:00.000Z'],
  ['America/Ciudad_Juarez', '2026-01-19T14:00', '2026-01-19T21:00:00.000Z'],
  ['America/Ciudad_Juarez', '2026-10-19T23:30', '2026-10-20T05:30:00.000Z'],
  ['America/Tijuana', '2026-10-19T14:00', '2026-10-19T21:00:00.000Z'],
  ['America/Tijuana', '2026-01-19T14:00', '2026-01-19T22:00:00.000Z'],
  ['America/Mexico_City', '2026-10-19T14:00', '2026-10-19T20:00:00.000Z'],
];
for (const [zone, local, utc] of cases) {
  test(`create -> agenda desktop/mobile -> save: ${zone} ${local} (server ${process.env.TZ})`, async () => {
    assert.equal(fromZonedTime(local, zone).toISOString(), utc);
    const f = fixture(zone, utc);
    const page = await f.load('app/panel/agenda/page.tsx').default({ searchParams: Promise.resolve({}) });
    assert.deepEqual(inputs(page), [local, local]);
    await assert.rejects(f.load('app/panel/agenda/actions.ts').actualizarAgenda(form(local)), (error) => error.url?.startsWith('/panel/agenda?ok='));
    assert.equal(f.writes.length, 1);
    assert.equal(f.writes[0].data.fechaProgramada.toISOString(), utc);
    assert.equal(f.audits.length, 1);
    assert.ok(f.invalidated.includes('/panel/agenda'));
  });
}
test('rescheduling interprets new time in the inspection zone', async () => {
  const f = fixture('America/Ciudad_Juarez', '2026-10-19T20:00:00.000Z');
  await assert.rejects(f.load('app/panel/agenda/actions.ts').actualizarAgenda(form('2026-10-19T15:30')), (e) => e.url?.includes('?ok='));
  assert.equal(f.writes[0].data.fechaProgramada.toISOString(), '2026-10-19T21:30:00.000Z');
});
for (const [zone, fallback] of [[null, 'America/Tijuana'], ['America/Tijuana', 'America/Ciudad_Juarez'], [null, null]]) {
  test(`read/write share zone selection: ${zone}/${fallback}`, async () => {
    const effective = zone || fallback || 'America/Ciudad_Juarez';
    const utc = fromZonedTime('2026-10-19T14:00', effective).toISOString();
    const f = fixture(zone, utc, { fallback });
    const page = await f.load('app/panel/agenda/page.tsx').default({ searchParams: Promise.resolve({}) });
    assert.deepEqual(inputs(page), ['2026-10-19T14:00', '2026-10-19T14:00']);
    await assert.rejects(f.load('app/panel/agenda/actions.ts').actualizarAgenda(form('2026-10-19T14:00')), (e) => e.url?.includes('?ok='));
    assert.equal(f.writes[0].data.fechaProgramada.toISOString(), utc);
  });
}
for (const options of [{ allowed: false }, { role: 'INSPECTOR' }]) {
  test(`authorization stays intact: ${JSON.stringify(options)}`, async () => {
    const f = fixture('America/Ciudad_Juarez', '2026-10-19T20:00:00Z', options);
    await assert.rejects(f.load('app/panel/agenda/actions.ts').actualizarAgenda(form('2026-10-19T14:00')));
    assert.equal(f.writes.length, 0); assert.equal(f.audits.length, 0);
  });
}
test('invalid date is rejected without a write', async () => {
  const f = fixture('America/Ciudad_Juarez', '2026-10-19T20:00:00Z');
  await assert.rejects(f.load('app/panel/agenda/actions.ts').actualizarAgenda(form('not-a-date')), (e) => e.url?.includes('?error='));
  assert.equal(f.writes.length, 0);
});
