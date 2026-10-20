/* eslint-disable @typescript-eslint/no-require-imports -- Páginas reales con datos sintéticos. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {renderToStaticMarkup}=require('react-dom/server');
const React=require('react');
const tipos=require('@prisma/client');
function compilar(codigo,mocks) {
  const js=ts.transpileModule(codigo,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const modulo={exports:{}};new Function('require','module','exports',js)(n=>mocks[n]??{},modulo,modulo.exports);return modulo.exports;
}
function cargar(ruta,{estado='EN_PROCESO',concluida=false,plan=true,rol=tipos.RolUsuario.DIRECTOR,controlAntiguo=false}={}) {
  let consultas=0;
  const usuario={id:'usuario',activo:true,rol,inspector:{id:'asignado'}};
  const inspeccion={id:'prueba',numeroInspeccion:1,estado,inspectorId:'asignado'};
  const pagina=compilar(fs.readFileSync(`app/panel/inspecciones/[id]/${ruta}/page.tsx`,'utf8'),{
    '@prisma/client':tipos,'@/auth':{auth:async()=>({user:{id:'usuario'}})},'@/lib/acceso-v1-final':{bloquearContenidoTecnicoV1Finalizado:async()=>{}},
    'next/navigation':{redirect:url=>{throw new Error(`REDIRECT:${url}`);},notFound:()=>{throw new Error('NOT_FOUND');}},
    '@/lib/recorrido-plan-confirmado':{obtenerPlanConfirmado:async()=>plan?[{}]:null},
    '@/lib/prisma':{prisma:{usuario:{findUnique:async()=>usuario},inspeccion:{findUnique:async()=>inspeccion},$queryRaw:async sql=>{
      consultas++;if(sql.join('').includes('COUNT(')) throw new Error('CATALOGO_ANTIGUO');
      return [{inspeccionTecnicaConcluidaEn:concluida?new Date():null,campoFinalizadoEn:controlAntiguo?new Date():null,preReporteGeneradoEn:controlAntiguo?new Date():null}];
    }}}
  }).default;
  return {ejecutar:()=>pagina({params:Promise.resolve({id:'prueba'}),searchParams:Promise.resolve({error:'Mensaje conservado'})}),consultas:()=>consultas};
}
for(const estado of ['REPORTE_PENDIENTE','FINALIZADA']) test(`flujo ${estado} abre reporte antes de consultar cierres antiguos`,async()=>{
  const p=cargar('flujo',{estado});await assert.rejects(p.ejecutar(),/REDIRECT:\/panel\/inspecciones\/prueba\/reporte-v1$/);assert.equal(p.consultas(),0);
});
for(const concluida of [true,false]) test(`plan confirmado, concluida=${concluida}, evita el cierre anterior`,async()=>{
  const p=cargar('flujo',{concluida,controlAntiguo:true});await assert.rejects(p.ejecutar(),new RegExp(`REDIRECT:/panel/inspecciones/prueba/${concluida?'reporte-v1':'campo-v1'}$`));assert.equal(p.consultas(),1);
});
test('cierre anterior redirige al reporte vigente y conserva el mensaje',async()=>{
  const p=cargar('cierre-v1');await assert.rejects(p.ejecutar(),/REDIRECT:\/panel\/inspecciones\/prueba\/reporte-v1\?error=Mensaje\+conservado$/);assert.equal(p.consultas(),0);
});
test('cierre valida permisos antes de redirigir',async()=>{
  const p=cargar('cierre-v1',{rol:tipos.RolUsuario.CLIENTE});await assert.rejects(p.ejecutar(),/REDIRECT:\/acceso$/);assert.equal(p.consultas(),0);
});
test('expediente sin plan conserva su cierre previo',async()=>{
  const p=cargar('cierre-v1',{plan:false});await assert.rejects(p.ejecutar(),/CATALOGO_ANTIGUO/);
});
// Renderiza los controles reales del expediente: comprueba que las tres secciones
// antiguas quedan fuera del plan confirmado y que los enlaces nuevos son vigentes.
const ruta='app/panel/inspecciones/[id]/page.tsx';const fuente=fs.readFileSync(ruta,'utf8');const ast=ts.createSourceFile(ruta,fuente,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const bloques=[];
function visitar(n) {
  if(ts.isBinaryExpression(n)&&['!usaPlanConfirmado','usaPlanConfirmado'].includes(n.left.getText(ast))) bloques.push(n.getText(ast));
  ts.forEachChild(n,visitar);
}
visitar(ast);
assert.equal(bloques.length,4);
const {controles:renderControles}=compilar(`import {EstadoInspeccion} from '@prisma/client'; import Link from 'next/link'; export function controles(esDirector) { const usaPlanConfirmado=true,id='prueba',inspeccion={estado:'REPORTE_PENDIENTE'},expedienteFinalizado=false,expedienteCancelado=false; return <>${bloques.map(b=>`{${b}}`).join('')}</>; }`,{'@prisma/client':tipos,'react/jsx-runtime':require('react/jsx-runtime'),'next/link':({href,children,...props})=>React.createElement('a',{href,...props},children)});
for(const director of [true,false]) test(`acciones del plan vigente, dirección=${director}`,()=>{
  const html=renderToStaticMarkup(renderControles(director));
  assert.match(html,/href="\/panel\/inspecciones\/prueba\/reporte-v1"/);
  assert.equal(html.includes('REVISAR Y AUTORIZAR REPORTE'),director);
  assert.doesNotMatch(html,/Capturar Método|Hallazgo rápido|Control de cierre|Estado del expediente|cierre-v1|43/);
});
for(const rol of [tipos.RolUsuario.DIRECTOR,tipos.RolUsuario.INSPECTOR]) test(`revisión recibida por ${rol} conserva reporte y autorización por rol`,async()=>{
  const pagina=compilar(fs.readFileSync('app/panel/inspecciones/[id]/revision/page.tsx','utf8'),{
    '@prisma/client':tipos,'react/jsx-runtime':require('react/jsx-runtime'),
    'next/link':({href,children,...props})=>React.createElement('a',{href,...props},children),
    '@/lib/alcance-zona':{obtenerUsuarioConAlcanceZona:async()=>({id:'usuario',rol})},
    '@/lib/asignaciones-inspeccion':{usuarioAsignadoAInspeccion:async()=>true},
    '@/lib/prisma':{prisma:{inspeccion:{findUnique:async()=>({id:'prueba',folio:'PRUEBA',estado:'REPORTE_PENDIENTE',numeroInspeccion:1,revisiones:[],inspector:null})}}},
    '@/lib/validacion-expediente-certeza':{obtenerEstadoExpedienteRevision:async()=>({completo:true,capturaTecnicaCompleta:true,firmaInspector:true,firmaCliente:true,usaMetodoCerteza:true,faltantes:[]})}
  }).default;
  const html=renderToStaticMarkup(await pagina({params:Promise.resolve({id:'prueba'}),searchParams:Promise.resolve({})}));
  assert.match(html,/href="\/panel\/inspecciones\/prueba\/reporte-v1"/);
  assert.equal(html.includes('AUTORIZAR Y LIBERAR REPORTE + CERTIFICADO'),rol===tipos.RolUsuario.DIRECTOR);
  assert.doesNotMatch(html,/cierre-v1|43|Hallazgo rápido|Capturar Método/);
});
