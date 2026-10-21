const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { registrarPagoCaja, autorizarExcepcionCaja } = require('../.test-visitas/caja-operaciones.js');
const { contratarVisita } = require('../.test-visitas/visitas-cotizacion.js');
const { resumenContratoVisita } = require('../.test-visitas/visitas-contrato.js');

const url = new URL(process.env.DATABASE_URL || 'http://invalid');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/visitas_test') throw new Error('Solo se permite la base desechable local visitas_test.');
const db = new PrismaClient();
const ctx = { clienteId: 'caja-test-cliente', inmuebleId: 'caja-test-casa', zonaId: 'caja-test-zona' };
const director = 'caja-test-director', admin = 'caja-test-admin';
let consecutivo = 0;
async function cotizacion(total = '100') {
  return db.cotizacion.create({ data: { ...ctx, folio: `CAJA-TEST-${++consecutivo}`, estado: 'AUTORIZADA', total } });
}
function entrada(c, monto = '20', usuarioId = admin) {
  return { cotizacionId: c.id, monto, usuarioId, operacionId: randomUUID(), referencia: ' REF ', metodoPago: ' Transferencia ', notas: ' Abono ' };
}
async function totales(c) {
  const registro = await db.cotizacion.findUniqueOrThrow({ where: { id: c.id } });
  const pagos = await db.pagoCotizacion.findMany({ where: { cotizacionId: c.id } });
  const suma = pagos.reduce((n, p) => n + Number(p.monto), 0);
  return { registro, pagos, suma };
}
test.before(async () => {
  await db.zona.create({ data: { id: ctx.zonaId, nombre: 'Caja pruebas', codigo: 'CTEST' } });
  await db.usuario.createMany({ data: [
    { id: director, nombre: 'Director prueba', email: 'dir@caja.invalid', passwordHash: 'test-not-login', rol: 'DIRECTOR' },
    { id: admin, nombre: 'Admin prueba', email: 'admin@caja.invalid', passwordHash: 'test-not-login', rol: 'ADMINISTRADOR', zonaId: ctx.zonaId },
    { id: 'caja-test-otra', nombre: 'Sin zona', email: 'otra@caja.invalid', passwordHash: 'test-not-login', rol: 'ADMINISTRADOR' },
    { id: 'caja-test-inactivo', nombre: 'Inactivo', email: 'inactivo@caja.invalid', passwordHash: 'test-not-login', rol: 'DIRECTOR', activo: false },
    { id: 'caja-test-inspector', nombre: 'Inspector', email: 'inspector@caja.invalid', passwordHash: 'test-not-login', rol: 'INSPECTOR', zonaId: ctx.zonaId },
  ] });
  await db.cliente.create({ data: { id: ctx.clienteId, folio: 'CAJA-CLI-TEST', nombre: 'Cliente ficticio' } });
  await db.inmueble.create({ data: { id: ctx.inmuebleId, clienteId: ctx.clienteId, alias: 'Casa prueba', tipo: 'Casa', direccion: 'Ficticia', ciudad: 'Prueba', estado: 'Prueba' } });
});
test.after(async () => db.$disconnect());

test('Caja rechaza roles, zona y usuario inactivo sin registrar abonos', async () => {
  const c = await cotizacion();
  for (const usuario of ['caja-test-otra', 'caja-test-inactivo', 'caja-test-inspector', 'no-existe']) await assert.rejects(registrarPagoCaja(db, entrada(c, '20', usuario)));
  assert.equal((await totales(c)).pagos.length, 0);
});
test('Caja exige centavos validos y clave de operacion', async () => {
  const c = await cotizacion();
  for (const monto of ['', '0', '-1', '0.001', '1e2', '1,000', 'NaN']) await assert.rejects(registrarPagoCaja(db, entrada(c, monto)));
  await assert.rejects(registrarPagoCaja(db, { ...entrada(c), operacionId: '' }));
  assert.equal((await totales(c)).registro.montoPagado.toFixed(2), '0.00');
});
test('Doble envio concurrente registra un solo pago y una sola auditoria', async () => {
  const c = await cotizacion(); const e = entrada(c);
  const r = await Promise.all([registrarPagoCaja(db, e), registrarPagoCaja(db, e), registrarPagoCaja(db, e)]);
  assert.equal(new Set(r.map(p => p.pagoId)).size, 1);
  assert.equal(r.filter(p => !p.repetido).length, 1);
  const t = await totales(c); assert.equal(t.pagos.length, 1); assert.equal(t.registro.montoPagado.toFixed(2), '20.00');
  assert.equal(await db.eventoAuditoria.count({ where: { entidad: 'PagoCotizacion', entidadId: r[0].pagoId } }), 1);
  await assert.rejects(registrarPagoCaja(db, { ...e, monto: '30' }));
  await assert.rejects(registrarPagoCaja(db, { ...e, usuarioId: director }));
  const otra = await cotizacion(); await assert.rejects(registrarPagoCaja(db, { ...e, cotizacionId: otra.id }));
  assert.equal((await totales(otra)).pagos.length, 0);
});
test('Abonos distintos simultaneos no pierden saldo ni exceden lo contratado', async () => {
  const c = await cotizacion();
  const r = await Promise.allSettled([registrarPagoCaja(db, entrada(c, '70')), registrarPagoCaja(db, entrada(c, '70'))]);
  assert.equal(r.filter(x => x.status === 'fulfilled').length, 1);
  const t = await totales(c); assert.equal(t.suma, 70); assert.equal(t.registro.montoPagado.toFixed(2), '70.00');
  const c2 = await cotizacion();
  await Promise.all([registrarPagoCaja(db, entrada(c2, '40')), registrarPagoCaja(db, entrada(c2, '60'))]);
  const t2 = await totales(c2); assert.equal(t2.suma, 100); assert.equal(t2.registro.montoPagado.toFixed(2), '100.00'); assert.equal(t2.registro.estadoPago, 'PAGADO');
});
test('Auditoria fallida revierte tanto el pago como el saldo', async () => {
  const c = await cotizacion();
  const clienteConFalla = { $transaction: (fn, opciones) => db.$transaction(tx => fn(new Proxy(tx, {
    get(target, key) {
      if (key === 'eventoAuditoria') return { create: async () => { throw new Error('Falla de auditoria simulada'); } };
      const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
    },
  })), opciones) };
  await assert.rejects(registrarPagoCaja(clienteConFalla, entrada(c)), /Falla de auditoria/);
  const t = await totales(c); assert.equal(t.pagos.length, 0); assert.equal(t.registro.montoPagado.toFixed(2), '0.00');
});
test('Cotizacion cancelada no permite pagos ni excepciones', async () => {
  const c = await cotizacion(); await db.cotizacion.update({ where: { id: c.id }, data: { estado: 'CANCELADA' } });
  await assert.rejects(registrarPagoCaja(db, entrada(c)));
  await assert.rejects(autorizarExcepcionCaja(db, { usuarioId: director, cotizacionId: c.id, tipo: 'INICIO', motivo: 'Prueba' }));
  assert.equal((await totales(c)).pagos.length, 0);
});
test('Solo Direccion autoriza excepciones y apertura no libera inicio', async () => {
  const c = await cotizacion(); const e = { cotizacionId: c.id, motivo: 'Motivo documentado', tipo: 'APERTURA' };
  for (const usuarioId of [admin, 'caja-test-inspector', 'caja-test-inactivo']) await assert.rejects(autorizarExcepcionCaja(db, { ...e, usuarioId }));
  await assert.rejects(autorizarExcepcionCaja(db, { ...e, usuarioId: director, motivo: ' ' }));
  await autorizarExcepcionCaja(db, { ...e, usuarioId: director });
  const t = (await totales(c)).registro; assert.equal(t.excepcionApertura, true); assert.equal(t.excepcionInicio, false); assert.equal(t.excepcionAperturaPorId, director);
  const antes = await db.eventoAuditoria.count({ where: { entidadId: c.id } });
  const r = await autorizarExcepcionCaja(db, { ...e, usuarioId: director, motivo: 'Otro motivo de reintento' }); assert.equal(r.repetido, true);
  assert.equal(await db.eventoAuditoria.count({ where: { entidadId: c.id } }), antes);
  assert.equal((await totales(c)).registro.motivoExcepcionApertura, e.motivo);
});
test('V2 contratada usa sus abonos 50/100 y conserva V1; excepcion exclusiva de su inspeccion', async () => {
  const v1 = await cotizacion('6000');
  await db.cotizacion.update({ where: { id: v1.id }, data: { montoPagado: '6000', estadoPago: 'PAGADO' } });
  const ins1 = await db.inspeccion.create({ data: { ...ctx, cotizacionId: v1.id, folio: 'CAJA-INS-V1', tipoServicio: 'Inspeccion', tipoInmueble: 'Casa', direccion: 'Ficticia', ciudad: 'Prueba', fechaProgramada: new Date(), numeroInspeccion: 1, estado: 'FINALIZADA' } });
  await db.revisionInspeccion.create({ data: { inspeccionId: ins1.id, usuarioId: director, rol: 'DIRECTOR', decision: 'APROBADO' } });
  const v2 = await contratarVisita(db, { usuarioId: director, cotizacionId: v1.id, inspeccionAnteriorId: ins1.id, importeContratado: '100.01', motivo: 'Seguimiento contratado', confirmada: true });
  await registrarPagoCaja(db, entrada(v2, '50.00'));
  let t = await totales(v2); assert.equal(resumenContratoVisita('100.01', t.registro.montoPagado.toFixed(2)).puedeAgendar, false);
  await registrarPagoCaja(db, entrada(v2, '0.01'));
  t = await totales(v2); assert.equal(resumenContratoVisita('100.01', t.registro.montoPagado.toFixed(2)).puedeAgendar, true); assert.equal(resumenContratoVisita('100.01', t.registro.montoPagado.toFixed(2)).puedeIniciar, false);
  const ins2 = await db.inspeccion.create({ data: { ...ctx, cotizacionId: v2.id, inspeccionAnteriorId: ins1.id, folio: 'CAJA-INS-V2', tipoServicio: 'Inspeccion', tipoInmueble: 'Casa', direccion: 'Ficticia', ciudad: 'Prueba', fechaProgramada: new Date(), numeroInspeccion: 2 } });
  await autorizarExcepcionCaja(db, { usuarioId: director, cotizacionId: v2.id, tipo: 'INICIO', motivo: 'Excepcion de V2 documentada' });
  assert.equal((await db.inspeccion.findUniqueOrThrow({ where: { id: ins2.id } })).inicioLiberadoSinPago, true);
  assert.equal((await db.inspeccion.findUniqueOrThrow({ where: { id: ins1.id } })).inicioLiberadoSinPago, false);
  await registrarPagoCaja(db, entrada(v2, '50.00'));
  t = await totales(v2); assert.equal(t.registro.estadoPago, 'PAGADO'); assert.equal(resumenContratoVisita('100.01', t.registro.montoPagado.toFixed(2)).puedeIniciar, true);
  const original = (await totales(v1)).registro; assert.equal(original.total.toFixed(2), '6000.00'); assert.equal(original.montoPagado.toFixed(2), '6000.00'); assert.equal(original.excepcionInicio, false);
});
