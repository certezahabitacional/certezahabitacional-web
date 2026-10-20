const test = require('node:test');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const { contratarVisita, consultarVinculoVisita } = require('../.test-visitas/visitas-cotizacion.js');
const { calcularResumenFinancieroCaja } = require('../.test-visitas/caja-finanzas.js');

const url = new URL(process.env.DATABASE_URL || 'http://invalid');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/visitas_test') throw new Error('Estas pruebas solo pueden usar la base local visitas_test.');
const db = new PrismaClient();
test.after(async () => db.$disconnect());
test('activacion de V2 y V3 con aislamiento de pagos, permisos e idempotencia', async () => {
  await db.zona.create({ data: { id: 'vtest-zona', nombre: 'Zona de prueba', codigo: 'VTEST' } });
  await db.usuario.createMany({ data: [
    { id: 'vtest-director', nombre: 'Director prueba', email: 'director@visitas.invalid', passwordHash: 'not-a-login-hash', rol: 'DIRECTOR' },
    { id: 'vtest-inspector', nombre: 'Inspector prueba', email: 'inspector@visitas.invalid', passwordHash: 'not-a-login-hash', rol: 'INSPECTOR', zonaId: 'vtest-zona' },
    { id: 'vtest-admin', nombre: 'Otra zona', email: 'admin@visitas.invalid', passwordHash: 'not-a-login-hash', rol: 'ADMINISTRADOR' },
  ] });
  await db.cliente.create({ data: { id: 'vtest-cliente', folio: 'TEST-CLIENTE', nombre: 'Cliente prueba' } });
  await db.inmueble.create({ data: { id: 'vtest-inmueble', clienteId: 'vtest-cliente', alias: 'Casa prueba', tipo: 'Casa', direccion: 'Domicilio ficticio', ciudad: 'Prueba', estado: 'Prueba' } });
  await db.cotizacion.create({ data: { id: 'vtest-cot', folio: 'TEST-COT-0001', clienteId: 'vtest-cliente', inmuebleId: 'vtest-inmueble', zonaId: 'vtest-zona', estado: 'AUTORIZADA', total: '6000', montoPagado: '6000', excepcionApertura: true, excepcionInicio: true } });
  const base = { clienteId: 'vtest-cliente', inmuebleId: 'vtest-inmueble', zonaId: 'vtest-zona', tipoServicio: 'Inspeccion', tipoInmueble: 'Casa', direccion: 'Domicilio ficticio', ciudad: 'Prueba', fechaProgramada: new Date(), estado: 'FINALIZADA' };
  await db.inspeccion.create({ data: { ...base, id: 'vtest-v1', folio: 'TEST-INS-V1', cotizacionId: 'vtest-cot', numeroInspeccion: 1 } });
  await db.revisionInspeccion.create({ data: { inspeccionId: 'vtest-v1', usuarioId: 'vtest-director', rol: 'DIRECTOR', decision: 'APROBADO' } });
  const entrada = { usuarioId: 'vtest-director', cotizacionId: 'vtest-cot', inspeccionAnteriorId: 'vtest-v1', importeContratado: '3000', motivo: 'Seguimiento contratado y confirmado con el cliente.', confirmada: true };
  await assert.rejects(contratarVisita(db, { ...entrada, importeContratado: '' }));
  await assert.rejects(contratarVisita(db, { ...entrada, usuarioId: 'vtest-inspector' }));
  await assert.rejects(contratarVisita(db, { ...entrada, usuarioId: 'vtest-admin' }));
  const resultados = await Promise.all([contratarVisita(db, entrada), contratarVisita(db, entrada)]);
  assert.equal(resultados[0].id, resultados[1].id);
  const v2 = await db.cotizacion.findUniqueOrThrow({ where: { id: resultados[0].id }, include: { inspeccion: true, pagos: true } });
  assert.equal(v2.folio, 'TEST-COT-0001 - V2');
  assert.equal(v2.total.toFixed(2), '3000.00');
  assert.equal(v2.montoPagado.toFixed(2), '0.00');
  assert.equal(v2.excepcionApertura, false);
  assert.equal(v2.excepcionInicio, false);
  assert.equal(v2.inspeccion, null);
  assert.equal(v2.pagos.length, 0);
  await assert.rejects(contratarVisita(db, { ...entrada, importeContratado: '4000' }));
  const enlace = await consultarVinculoVisita(db, v2.id);
  assert.equal(enlace.inspeccionAnteriorId, 'vtest-v1');
  assert.equal(enlace.cotizacionOrigenId, 'vtest-cot');
  for (const [pagado, agenda, inicio] of [['1499.99', false, false], ['1500', true, false], ['2999.99', true, false], ['3000', true, true]]) {
    const r = calcularResumenFinancieroCaja({ importe: Number(v2.total), pagado: Number(pagado) });
    assert.equal(r.puedeAgendar, agenda);
    assert.equal(r.puedeLiberarCampo, inicio);
  }
  await db.pagoCotizacion.create({ data: { cotizacionId: v2.id, monto: '1500', fechaPago: new Date(), registradoPorId: 'vtest-director' } });
  await db.cotizacion.update({ where: { id: v2.id }, data: { montoPagado: '1500', estadoPago: 'PARCIAL' } });
  const v1 = await db.cotizacion.findUniqueOrThrow({ where: { id: 'vtest-cot' } });
  assert.equal(v1.total.toFixed(2), '6000.00');
  assert.equal(v1.montoPagado.toFixed(2), '6000.00');
  const num = await db.cotizacion.count({ where: { folio: v2.folio } });
  assert.equal(num, 1);
  const auditoria = await db.eventoAuditoria.count({ where: { entidadId: v2.id } });
  assert.equal(auditoria, 3);
  await assert.rejects(db.inspeccion.create({ data: { ...base, folio: 'TEST-FORJADA', cotizacionId: v2.id, numeroInspeccion: 9, inspeccionAnteriorId: 'vtest-v1' } }));
  await db.inspeccion.create({ data: { ...base, id: 'vtest-v2', folio: 'TEST-INS-V2', cotizacionId: v2.id, numeroInspeccion: 2, inspeccionAnteriorId: 'vtest-v1' } });
  await assert.rejects(contratarVisita(db, { ...entrada, cotizacionId: v2.id, inspeccionAnteriorId: 'vtest-v2' }));
  await db.revisionInspeccion.create({ data: { inspeccionId: 'vtest-v2', usuarioId: 'vtest-director', rol: 'DIRECTOR', decision: 'APROBADO' } });
  const v3 = await contratarVisita(db, { ...entrada, cotizacionId: v2.id, inspeccionAnteriorId: 'vtest-v2', importeContratado: '2000' });
  assert.equal(v3.folio, 'TEST-COT-0001 - V3');
  assert.equal((await consultarVinculoVisita(db, v3.id)).inspeccionAnteriorId, 'vtest-v2');
  const rls = await db.$queryRaw`SELECT relrowsecurity FROM pg_class WHERE oid = 'public."CotizacionVisita"'::regclass`;
  assert.equal(rls[0].relrowsecurity, true);
});
