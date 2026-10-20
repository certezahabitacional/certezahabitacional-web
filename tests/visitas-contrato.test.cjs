const test = require('node:test');
const assert = require('node:assert/strict');
const { importeACentavos, centavosAImporte, resumenContratoVisita, folioDeVisita, validarContratacionVisita } = require('../.test-visitas/visitas-contrato.js');

for (const valor of ['', ' ', '0', '-1', 'NaN', 'Infinity', '1e3', '1,000', '1.001', '10000000000', undefined, null, 3000]) {
  test(`rechaza importe invalido ${String(valor)}`, () => assert.throws(() => importeACentavos(valor)));
}
test('normaliza decimales sin perder centavos', () => {
  assert.equal(importeACentavos(' 3000.1 '), 300010);
  assert.equal(centavosAImporte(300010), '3000.10');
  assert.equal(importeACentavos('9999999999.99'), 999999999999);
});
test('50% exacto habilita agenda; menos de 50% no', () => {
  assert.equal(resumenContratoVisita('3000', '1499.99').puedeAgendar, false);
  assert.equal(resumenContratoVisita('3000', '1500').puedeAgendar, true);
  assert.equal(resumenContratoVisita('3000', '1500').puedeIniciar, false);
});
test('99.99% no inicia; 100% inicia', () => {
  assert.equal(resumenContratoVisita('3000', '2999.99').puedeIniciar, false);
  assert.equal(resumenContratoVisita('3000', '3000').puedeIniciar, true);
});
test('anticipo redondeado hacia arriba cuando hay medio centavo', () => {
  assert.equal(resumenContratoVisita('100.01', '50').puedeAgendar, false);
  assert.equal(resumenContratoVisita('100.01', '50.01').puedeAgendar, true);
  assert.equal(resumenContratoVisita('100.01').anticipoMinimo, '50.01');
});
test('pagos de V1 no forman parte de la nueva visita', () => {
  const v1 = resumenContratoVisita('6000', '6000');
  const v2 = resumenContratoVisita('3000');
  assert.equal(v1.puedeIniciar, true);
  assert.equal(v2.pagado, '0.00');
  assert.equal(v2.puedeAgendar, false);
  assert.equal(v2.puedeIniciar, false);
});
test('anular o reducir pagos vuelve a bloquear inicio', () => {
  assert.equal(resumenContratoVisita('3000', '3000').puedeIniciar, true);
  assert.equal(resumenContratoVisita('3000', '1500').puedeIniciar, false);
});
test('conserva folio origen y no acumula sufijos', () => {
  assert.equal(folioDeVisita('COT-000123', 2), 'COT-000123 - V2');
  assert.equal(folioDeVisita('COT-000123', 10), 'COT-000123 - V10');
  assert.throws(() => folioDeVisita('', 2));
  assert.throws(() => folioDeVisita('COT-000123', 1));
});
test('contratacion exige importe, motivo y confirmacion', () => {
  assert.throws(() => validarContratacionVisita('3000', 'Seguimiento', false));
  assert.throws(() => validarContratacionVisita('3000', '', true));
  assert.deepEqual(validarContratacionVisita('3000.00', ' Seguimiento contratado ', true), { importe: '3000.00', motivo: 'Seguimiento contratado' });
});
