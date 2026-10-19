// Render the real card with synthetic records; no credentials or production writes.
// Run: node --test tests/descripcion-unica-concepto.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { renderToStaticMarkup } = require('react-dom/server');
const source = fs.readFileSync(path.resolve(__dirname, '../app/panel/inspecciones/[id]/campo-v1/ConceptoAreaCard.tsx'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
} }).outputText;
const actions = new Proxy({}, { get: () => async () => { throw new Error('Unexpected action execution'); } });
const widget = { __esModule: true, default: () => null };
const mocks = {
  '@/lib/prisma': { prisma: { $queryRaw: async () => [{ fotografiaId: 'synthetic-photo', orden: 1, ruta: 'synthetic-only', descripcion: null }] } },
  '@/lib/supabase-admin': { obtenerSupabaseAdminOpcional: () => null },
  './actions': actions, './conceptos-actions': actions,
  '../puntos-criticos/BotonGenerarIa': widget,
  '@/components/offline/OfflineNoAplicaForm': widget,
  '@/components/offline/OfflineManualConceptResult': widget,
  './CapturaConceptoArea': widget, './GaleriaConceptoArea': widget,
};
const mod = { exports: {} };
new Function('require', 'module', 'exports', compiled)((name) => Object.hasOwn(mocks, name) ? mocks[name] : require(name), mod, mod.exports);
const card = mod.exports.default;
const base = {
  id: 'synthetic-concept', concepto: 'Concepto de prueba', especificacion: null, grupo: 'FACHADAS',
  estadoV3: 'CON_HALLAZGO', origenV3: 'PLAN_PREVIO', obligatorio: true, herramientaSugerida: null,
  motivoNoAplica: null, requiereMedicion: false, requiereComparacionProyecto: false,
  valorMedido: null, valorProyecto: null, unidadMedida: null,
};
const internal = { justificacionIa: 'INTERNAL_CLASSIFICATION_REASON', justificacionCalificacionIa: 'INTERNAL_SCORE_REASON' };
async function render(obs, fields = {}, canEdit = true) {
  const punto = Object.freeze({ ...base, ...fields, observacion: typeof obs === 'string' ? obs : JSON.stringify(obs) });
  const before = JSON.stringify(punto);
  const html = renderToStaticMarkup(await card({ inspeccionId: 'synthetic-inspection', areaId: 'synthetic-area', punto, numeroConcepto: 17, puedeCapturar: canEdit, areaActiva: true }));
  assert.equal(JSON.stringify(punto), before, 'render must not mutate inspection data');
  assert.ok(!html.includes(internal.justificacionIa));
  assert.ok(!html.includes(internal.justificacionCalificacionIa));
  return html;
}
const occurrences = (html, value) => html.split(value).length - 1;
for (const [name, description, ai, expected] of [
  ['inspector edit takes precedence', 'FINAL_INSPECTOR_TEXT', 'ORIGINAL_AI_TEXT', 'FINAL_INSPECTOR_TEXT'],
  ['AI fallback when no final text', undefined, 'ORIGINAL_AI_TEXT', 'ORIGINAL_AI_TEXT'],
  ['AI fallback when final is blank', '   ', 'ORIGINAL_AI_TEXT', 'ORIGINAL_AI_TEXT'],
  ['identical texts appear once', 'SAME_DESCRIPTION', 'SAME_DESCRIPTION', 'SAME_DESCRIPTION'],
]) {
  for (const state of ['CON_HALLAZGO', 'PENDIENTE']) {
    test(`${name} - ${state}`, async () => {
      const html = await render({ ...internal, descripcionFinal: description, descripcionIa: ai, clasificacionFinal: 'NC', calificacionFinal: 70, prioridadFinal: 'P3', prioridadEvaluadaIa: 'P3' }, { estadoV3: state });
      assert.equal(occurrences(html, expected), 1);
      if (description?.trim() && description !== ai) assert.ok(!html.includes(ai));
      if (state === 'PENDIENTE') assert.equal(occurrences(html, 'name="descripcionFinal"'), 1);
      else {
        assert.equal(occurrences(html, 'data-descripcion-concepto="final"'), 1);
        assert.match(html, /70\/100/); assert.match(html, /P3/); assert.match(html, />NC</);
        assert.match(html, /EDITAR CONCEPTO CERRADO/);
      }
    });
  }
}
test('legacy plain-text observation remains visible once', async () => {
  const html = await render('LEGACY_DESCRIPTION');
  assert.equal(occurrences(html, 'LEGACY_DESCRIPTION'), 1);
});
test('No aplica keeps its reason and reactivation without adding a description', async () => {
  const html = await render({ ...internal, descripcionFinal: 'HIDDEN_PREVIOUS_TEXT' }, { estadoV3: 'NO_APLICA', motivoNoAplica: 'REASON_NO_APLICA' });
  assert.equal(occurrences(html, 'REASON_NO_APLICA'), 1);
  assert.ok(!html.includes('HIDDEN_PREVIOUS_TEXT')); assert.match(html, /REACTIVAR CONCEPTO/);
});
test('read-only user cannot reopen or delete evidence', async () => {
  const html = await render({ ...internal, descripcionFinal: 'READ_ONLY_TEXT' }, {}, false);
  assert.equal(occurrences(html, 'READ_ONLY_TEXT'), 1);
  assert.ok(!html.includes('EDITAR CONCEPTO CERRADO')); assert.ok(!html.includes('ELIMINAR FOTOGRAF'));
});
test('empty descriptions do not get replaced with the score reasoning', async () => {
  const html = await render({ ...internal, descripcionFinal: '', descripcionIa: '' });
  assert.ok(!html.includes('data-descripcion-concepto="final"'));
});
