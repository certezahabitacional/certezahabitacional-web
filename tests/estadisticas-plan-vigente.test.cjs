/* eslint-disable @typescript-eslint/no-require-imports -- Prueba de componente servidor con datos sintéticos. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const ruta='app/panel/inspecciones/[id]/campo-v1/RecorridoPlanConfirmado.tsx';
async function renderizar(cantidades, concluida=false, puedeCapturar=false) {
  const partidas=cantidades.map((cantidad,i)=>({orden:i+1,nombre:`Partida ${i+1}`,subpartidas:[{nombre:`Subpartida ${i+1}`,area:{id:`area-${i}`,resultado:null},items:Array.from({length:cantidad},(_,j)=>({id:`item-${i}-${j}`})),resueltos:i===0?cantidad:0,cerrada:i===0}]}));
  const codigo=ts.transpileModule(fs.readFileSync(ruta,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const vacio=()=>null;
  const mocks={
    'react/jsx-runtime':require('react/jsx-runtime'),
    'next/link':({href,children,...props})=>React.createElement('a',{href,...props},children),
    '@/lib/recorrido-plan-confirmado':{obtenerRecorridoConfirmado:async()=>partidas},
    '@/lib/prisma':{prisma:{$queryRaw:async (sql)=>sql.join('').includes('InspeccionControlV2')?[{inspeccionTecnicaConcluidaEn:concluida?new Date():null}]:sql.join('').includes('COUNT(*)')?[{fotos:0,hallazgos:0}]:[]}},
    '@/components/inspecciones/RecorridoConceptos':{__esModule:true,default:vacio,RetomarRecorrido:vacio},
    './ConceptoAreaCard':{__esModule:true,default:vacio},
  };
  const modulo={exports:{}};
  new Function('require','module','exports',codigo)((nombre)=>mocks[nombre]??{},modulo,modulo.exports);
  return renderToStaticMarkup(await modulo.exports.default({usuarioId:'usuario',inspeccionId:'inspeccion',folio:'PRUEBA',query:{},puedeCapturar}));
}
for(const cantidades of [[2,3],[3,4,5]]) {
  test(`estadísticas y navegación del plan ${cantidades.join('/')}`,async()=>{
    const html=await renderizar(cantidades);
    const total=cantidades.reduce((a,b)=>a+b,0),resueltos=cantidades[0];
    for(const [nombre,valor] of [['Partidas',cantidades.length],['Subpartidas',cantidades.length],['Conceptos',total],['Conceptos pendientes',total-resueltos],['Avance de conceptos',`${Math.round(resueltos/total*100)}%`]]) {
      assert.match(html,new RegExp(`<dt[^>]*>${nombre}</dt><dd[^>]*>${valor}</dd>`));
    }
    assert.match(html,/aria-label="Partidas del plan confirmado"/);
    assert.match(html,/aria-current="page"/);
    assert.doesNotMatch(html,/IR A PARTIDA|CONSULTAR PLAN DE|ETAPA INICIAL|43 PARTIDAS/);
  });
}
test('el panel de hermeticidad ya no presenta los tres controles retirados',()=>{
  const codigo=fs.readFileSync('app/panel/inspecciones/[id]/puntos-criticos/hermeticidad/page.tsx','utf8');
  assert.doesNotMatch(codigo,/IR A PARTIDA|CONSULTAR PLAN DE|ETAPA INICIAL|ETAPA FINAL/);
});

for(const puedeCapturar of [true,false]) {
  test(`la revisión de una inspección concluida vuelve al reporte (captura=${puedeCapturar})`,async()=>{
    const html=await renderizar([2,3],true,puedeCapturar);
    assert.match(html,/href="\/panel\/inspecciones\/inspeccion\/reporte-v1"[^>]*>VOLVER AL REPORTE<\/a>/);
    assert.match(html,/href="\/panel\/inspecciones\/inspeccion\/reporte-v1"[^>]*>TERMINAR REVISIÓN Y VOLVER AL REPORTE<\/a>/);
    assert.doesNotMatch(html,/CONCLUIR INSPECCIÓN TÉCNICA/);
  });
}
test('antes de concluir se conserva el cierre técnico con sus validaciones',async()=>{
  const html=await renderizar([2,3],false,true);
  assert.match(html,/disabled=""[^>]*>CONCLUIR INSPECCIÓN TÉCNICA/);
  assert.doesNotMatch(html,/TERMINAR REVISIÓN Y VOLVER AL REPORTE/);
});
