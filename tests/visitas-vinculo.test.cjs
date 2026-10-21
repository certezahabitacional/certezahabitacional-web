const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { consultarVinculoVisita, contratarVisita } = require('../.test-visitas/visitas-cotizacion.js');
const { registrarPagoCaja, autorizarExcepcionCaja } = require('../.test-visitas/caja-operaciones.js');

function escenario(numero = 2) {
  const perfil = { clienteId: 'cliente', inmuebleId: 'casa', zonaId: 'zona' };
  const cotizaciones = new Map(), inspecciones = new Map(), enlaces = [];
  for (let n = 1; n <= numero; n++) {
    const id = `cot-${n}`;
    const i = { ...perfil, id: `ins-${n}`, cotizacionId: id, numeroInspeccion: n, inspeccionAnteriorId: n > 1 ? `ins-${n-1}` : null };
    const datos = { tipoRegistro: 'VISITA_CONTRATADA', cotizacionOrigenId: 'cot-1', folioOrigen: 'COT-123', numeroVisita: n, inspeccionAnteriorId: `ins-${n-1}` };
    cotizaciones.set(id, { ...perfil, id, folio: n === 1 ? 'COT-123' : `COT-123 - V${n}`, versiones: n > 1 ? [{ datos }] : [], inspeccion: n === numero && n > 1 ? null : { ...i } });
    inspecciones.set(i.id, i);
    if (n > 1) enlaces.push({ cotizacionOrigenId: 'cot-1', cotizacionVisitaId: id, inspeccionAnteriorId: `ins-${n-1}`, numeroVisita: n });
  }
  const s = { cotizaciones, inspecciones, enlaces, tabla: true, consultas: 0, numero };
  s.db = {
    cotizacion: { findUnique: async ({where}) => cotizaciones.get(where.id) || null },
    inspeccion: { findUnique: async ({where}) => inspecciones.get(where.id) || null },
    $queryRaw: async (parts, ...args) => {
      s.consultas++;
      const sql = parts.join('?');
      if (sql.includes('to_regclass')) return [{ existe: s.tabla }];
      assert.equal(s.tabla, true, 'No consultar tabla ausente');
      if (sql.includes('WHERE "cotizacionVisitaId"')) return s.enlaces.filter(v => v.cotizacionVisitaId === args[0]);
      throw new Error('Consulta no prevista en este sustituto de lectura');
    },
  };
  return s;
}
async function rechazada(s) { await assert.rejects(consultarVinculoVisita(s.db, `cot-${s.numero}`), { name: 'ErrorContratoVisita' }); }

test('V1 ordinaria funciona antes y despues de instalar la tabla', async () => {
  for (const tabla of [false, true]) { const s = escenario(); s.tabla = tabla; assert.equal(await consultarVinculoVisita(s.db, 'cot-1'), null); }
});
test('Una V2 declarada sin tabla no se convierte en V1', async () => {
  const s = escenario(); s.tabla = false; await rechazada(s); assert.equal(s.consultas, 1);
});
test('Una V2 sin su fila de vinculo se bloquea', async () => { const s = escenario(); s.enlaces = []; await rechazada(s); });
test('El folio detecta V2 aun cuando faltan los metadatos', async () => {
  const s = escenario(); s.cotizaciones.get('cot-2').versiones = []; s.enlaces = []; await rechazada(s);
});
test('La identidad contractual detecta una visita aunque cambie su folio', async () => {
  const s = escenario(); s.cotizaciones.get('cot-2').folio = 'MODIFICADO'; s.tabla = false; await rechazada(s);
});
test('V2 y visitas posteriores validas conservan origen y antecedente', async () => {
  for (const n of [2,3,4,20]) { const s = escenario(n); assert.deepEqual(await consultarVinculoVisita(s.db, `cot-${n}`), s.enlaces[n-2]); }
});
test('Se rechaza identidad contractual diferente del vinculo', async () => {
  for (const campo of ['tipoRegistro','cotizacionOrigenId','folioOrigen','numeroVisita','inspeccionAnteriorId']) {
    const s = escenario(); s.cotizaciones.get('cot-2').versiones[0].datos[campo] = 'OTRO'; await rechazada(s);
  }
});
test('Cliente inmueble y zona de la visita deben coincidir con V1', async () => {
  for (const campo of ['clienteId','inmuebleId','zonaId']) { const s = escenario(); s.cotizaciones.get('cot-2')[campo] = 'OTRO'; await rechazada(s); }
});
test('El antecedente no puede pertenecer a otro cliente inmueble o zona', async () => {
  for (const campo of ['clienteId','inmuebleId','zonaId']) { const s = escenario(3); s.inspecciones.get('ins-2')[campo] = 'OTRO'; await rechazada(s); }
});
test('V2 debe continuar la inspeccion V1 exacta de su cotizacion original', async () => {
  const s = escenario(); s.cotizaciones.get('cot-1').inspeccion.id = 'OTRA'; await rechazada(s);
});
test('V3 no admite un antecedente financiero de otra familia', async () => {
  const s = escenario(3); s.enlaces[0].cotizacionOrigenId = 'OTRO'; await rechazada(s);
});
test('Se bloquean numeraciones invalidas, filas duplicadas y autorreferencias', async () => {
  for (const n of [0,1,-1,2.5,2147483648]) { const s = escenario(); s.enlaces[0].numeroVisita = n; await rechazada(s); }
  const s = escenario(); s.enlaces.push({ ...s.enlaces[0] }); await rechazada(s);
  const a = escenario(); a.enlaces[0].cotizacionOrigenId = 'cot-2'; await rechazada(a);
});
test('Una inspeccion agendada no puede tener otro numero o antecedente', async () => {
  for (const campo of ['numeroInspeccion','inspeccionAnteriorId']) {
    const s = escenario(); s.cotizaciones.get('cot-2').inspeccion = { ...s.inspecciones.get('ins-2'), [campo]: 'OTRO' }; await rechazada(s);
  }
});
test('Fallo de lectura no se transforma en ausencia de seguimiento', async () => {
  const s = escenario(); s.db.$queryRaw = async () => { throw new Error('Fallo de lectura'); };
  await assert.rejects(consultarVinculoVisita(s.db, 'cot-2'), /Fallo de lectura/);
});
test('Consultar un vinculo no modifica registros y rechaza cotizacion inexistente', async () => {
  const s = escenario(3), antes = JSON.stringify([...s.cotizaciones]);
  await consultarVinculoVisita(s.db, 'cot-3'); assert.equal(JSON.stringify([...s.cotizaciones]), antes);
  await assert.rejects(consultarVinculoVisita(s.db, 'inexistente'), { name: 'ErrorContratoVisita' });
});

// Ejecuta el modulo real de validacion de agenda/inicio con lecturas sustituidas.
// No sustituye una prueba HTTP autenticada ni una conexion a produccion.
function validaciones(pagado, falloVinculo) {
  const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
  const { ErrorContratoVisita } = require('../.test-visitas/visitas-contrato.js');
  const fuente = fs.readFileSync(path.join(__dirname, '../lib/caja-validaciones.ts'), 'utf8');
  const codigo = ts.transpileModule(fuente, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
  const c = { id:'cot-2', folio:'COT-123 - V2', estado:'AUTORIZADA', clienteId:'cliente', inmuebleId:'casa', total:100, montoPagado:pagado, excepcionApertura:false, excepcionInicio:false, inspeccion:null };
  const dependencias = {
    '@prisma/client': require('@prisma/client'),
    '@/lib/caja-finanzas': require('../.test-visitas/caja-finanzas.js'),
    '@/lib/prisma': { prisma: { cotizacion: { findUnique: async () => c } } },
    '@/lib/visitas-cotizacion': { consultarVinculoVisita: async () => { if(falloVinculo) throw falloVinculo === 'dominio' ? new ErrorContratoVisita('Vinculo inconsistente') : new Error('Lectura fallida'); return null; } },
    '@/lib/visitas-contrato': { ErrorContratoVisita },
  };
  const modulo = { exports:{} };
  new Function('require','module','exports',codigo)((nombre) => { if(!(nombre in dependencias)) throw new Error('Importacion no prevista: '+nombre); return dependencias[nombre]; }, modulo, modulo.exports);
  return modulo.exports;
}
test('Agenda e inicio se bloquean por vinculo inconsistente aun al 100%', async () => {
  const v = validaciones(100,'dominio');
  for(const funcion of ['validarAperturaDesdeCaja','validarLiberacionCampoDesdeCaja']) { const r=await v[funcion]('cot-2'); assert.equal(r.ok,false); assert.match(r.error,/Vinculo/); }
});
test('Validadores reales conservan limites 49.99, 50, 99.99 y 100', async () => {
  for(const [pagado,agenda,inicio] of [[49.99,false,false],[50,true,false],[99.99,true,false],[100,true,true]]) {
    const v=validaciones(pagado); assert.equal((await v.validarAperturaDesdeCaja('cot-2')).ok,agenda); assert.equal((await v.validarLiberacionCampoDesdeCaja('cot-2')).ok,inicio);
  }
});
test('Error inesperado del vinculo no libera agenda ni campo', async () => {
  const v=validaciones(100,'inesperado');
  await assert.rejects(v.validarAperturaDesdeCaja('cot-2'),/Lectura fallida/);
  await assert.rejects(v.validarLiberacionCampoDesdeCaja('cot-2'),/Lectura fallida/);
});

test('PostgreSQL: vinculo ausente bloquea pagos y excepciones sin modificar V1 ni V2', async () => {
  const url = new URL(process.env.DATABASE_URL || 'http://invalid');
  assert.ok(['localhost','127.0.0.1'].includes(url.hostname) && url.pathname === '/visitas_test', 'Solo base local desechable');
  const db = new PrismaClient();
  try {
    const perfil = { clienteId: 'vinc-test-cliente', inmuebleId: 'vinc-test-casa', zonaId: 'vinc-test-zona' };
    const usuarioId = 'vinc-test-director';
    await db.zona.create({ data: { id: perfil.zonaId, nombre: 'Vinculo prueba', codigo: 'VINC-TEST' } });
    await db.usuario.create({ data: { id: usuarioId, nombre: 'Director prueba', email: 'director@vinculo.invalid', passwordHash: 'not-a-login', rol: 'DIRECTOR' } });
    await db.cliente.create({ data: { id: perfil.clienteId, folio: 'VINC-CLI-TEST', nombre: 'Cliente ficticio' } });
    await db.inmueble.create({ data: { id: perfil.inmuebleId, clienteId: perfil.clienteId, alias: 'Prueba', tipo: 'Casa', direccion: 'Ficticia', ciudad: 'Prueba', estado: 'Prueba' } });
    const v1 = await db.cotizacion.create({ data: { ...perfil, folio: 'VINC-COT-TEST', estado: 'AUTORIZADA', total: '6000', montoPagado: '6000', estadoPago: 'PAGADO' } });
    const i1 = await db.inspeccion.create({ data: { ...perfil, cotizacionId: v1.id, folio: 'VINC-INS-TEST', tipoServicio: 'Inspeccion', tipoInmueble: 'Casa', direccion: 'Ficticia', ciudad: 'Prueba', fechaProgramada: new Date(), numeroInspeccion: 1, estado: 'FINALIZADA' } });
    await db.revisionInspeccion.create({ data: { inspeccionId: i1.id, usuarioId, rol: 'DIRECTOR', decision: 'APROBADO' } });
    const v2 = await contratarVisita(db, { usuarioId, cotizacionId: v1.id, inspeccionAnteriorId: i1.id, importeContratado: '100', motivo: 'Seguimiento contratado', confirmada: true });
    await registrarPagoCaja(db, { usuarioId, cotizacionId: v2.id, monto: '50', operacionId: randomUUID() });
    await db.cotizacionVersion.create({ data: { cotizacionId: v2.id, version: 2, total: '100', datos: { documento: 'Revision posterior' } } });
    assert.equal((await consultarVinculoVisita(db, v2.id)).numeroVisita, 2);
    const antes = await db.cotizacion.findUniqueOrThrow({ where: { id: v2.id } });
    const pagosAntes = await db.pagoCotizacion.count({ where: { cotizacionId: v2.id } });
    const auditoriaAntes = await db.eventoAuditoria.count({ where: { usuarioId } });
    await db.$executeRaw`DELETE FROM "CotizacionVisita" WHERE "cotizacionVisitaId" = ${v2.id}`;
    await assert.rejects(consultarVinculoVisita(db, v2.id), { name: 'ErrorContratoVisita' });
    await assert.rejects(registrarPagoCaja(db, { usuarioId, cotizacionId: v2.id, monto: '50', operacionId: randomUUID() }), { name: 'ErrorOperacionCaja' });
    for (const tipo of ['APERTURA','INICIO']) await assert.rejects(autorizarExcepcionCaja(db, { usuarioId, cotizacionId: v2.id, tipo, motivo: 'No debe liberar una visita inconsistente' }), { name: 'ErrorOperacionCaja' });
    const despues = await db.cotizacion.findUniqueOrThrow({ where: { id: v2.id } });
    assert.equal(despues.montoPagado.toFixed(2), antes.montoPagado.toFixed(2));
    assert.equal(despues.excepcionInicio, false); assert.equal(despues.excepcionApertura, false);
    assert.equal(await db.pagoCotizacion.count({ where: { cotizacionId: v2.id } }), pagosAntes);
    assert.equal(await db.eventoAuditoria.count({ where: { usuarioId } }), auditoriaAntes);
    const original = await db.cotizacion.findUniqueOrThrow({ where: { id: v1.id } });
    assert.equal(original.total.toFixed(2), '6000.00'); assert.equal(original.montoPagado.toFixed(2), '6000.00');
  } finally { await db.$disconnect(); }
});
