/* eslint-disable @typescript-eslint/no-require-imports -- Regresión de permisos con registros sintéticos. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {renderToStaticMarkup}=require('react-dom/server');
const prismaTipos=require('@prisma/client');
const {RolUsuario,EstadoInspeccion}=prismaTipos;
const ruta='app/panel/inspecciones/[id]/reporte-v1/page.tsx';
const fuente=fs.readFileSync(ruta,'utf8');
const ast=ts.createSourceFile(ruta,fuente,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function compilar(codigo,mocks) {
  const js=ts.transpileModule(codigo,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const mod={exports:{}};
  new Function('require','module','exports',js)(n=>mocks[n]??{},mod,mod.exports);
  return mod.exports;
}
// Renderiza el condicional real y las declaraciones de permisos de la página.
let condicional;
const permisos=[];
function visitar(n) {
  if(ts.isVariableDeclaration(n)&&['esInspector','esDirector','puedeOperarPreReporte'].includes(n.name.getText(ast))) permisos.push(`const ${n.getText(ast)};`);
  if(ts.isConditionalExpression(n)&&n.whenTrue.getText(ast).includes('action={enviarReporteDireccionV1}')) condicional=n.getText(ast);
  ts.forEachChild(n,visitar);
}
visitar(ast);
assert.ok(condicional,'Debe localizarse el control real de envío');
const {boton}=compilar(`import {RolUsuario} from '@prisma/client'; export function boton(usuario,inspeccion) { ${permisos.join('\n')} const id='prueba'; const enviarReporteDireccionV1=async()=>{}; return (${condicional}); }`,{'@prisma/client':prismaTipos,'react/jsx-runtime':require('react/jsx-runtime')});
for(const [rol,asignado,visible] of [[RolUsuario.DIRECTOR,false,true],[RolUsuario.INSPECTOR,true,true],[RolUsuario.INSPECTOR,false,false],[RolUsuario.GERENTE,false,false],[RolUsuario.CLIENTE,false,false]]) {
  test(`botón de solicitud: ${rol}, asignado=${asignado}`,()=>{
    const html=renderToStaticMarkup(boton({rol,inspector:{id:asignado?'asignado':'otro'}},{inspectorId:'asignado'}));
    assert.equal(html.includes('SOLICITAR AUTORIZACIÓN DEL REPORTE'),visible);
  });
}
function accion({rol=RolUsuario.DIRECTOR,asignado=true,firmas=true,activo=true}={}) {
  const escrituras=[];
  const usuario={id:'usuario',rol,activo,inspector:{id:asignado?'asignado':'otro',activo:true}};
  const inspeccion={id:'prueba',folio:'PRUEBA',numeroInspeccion:1,estado:EstadoInspeccion.EN_PROCESO,inspectorId:'asignado',firmas:firmas?[{tipo:'INSPECTOR',firmadaEn:new Date()},{tipo:'CLIENTE',firmadaEn:new Date()}]:[]};
  const prisma={usuario:{findUnique:async()=>usuario},inspeccion:{findUnique:async()=>inspeccion},$queryRaw:async()=>[{preReporteGeneradoEn:new Date(),reabiertaEn:null,reporteLimiteEn:null}],$transaction:async fn=>fn({inspeccion:{update:async data=>escrituras.push(data)},revisionInspeccion:{updateMany:async()=>{}},$executeRaw:async()=>{}})};
  const modulo=compilar(fs.readFileSync('app/panel/inspecciones/[id]/cierre-v1/actions.ts','utf8'),{
    '@prisma/client':prismaTipos,'@/auth':{auth:async()=>({user:{id:'usuario'}})},'@/lib/prisma':{prisma},'next/navigation':{redirect:url=>{throw new Error(`REDIRECT:${url}`);}},'next/cache':{revalidatePath:()=>{}},'@/lib/auditoria':{registrarAuditoria:async()=>{}}
  });
  const datos=new FormData();datos.set('inspeccionId','prueba');
  return {ejecutar:()=>modulo.enviarReporteDireccionV1(datos),escrituras};
}
for(const rol of [RolUsuario.DIRECTOR,RolUsuario.INSPECTOR]) {
  test(`servidor permite solicitar a ${rol} sin autorizar automáticamente`,async()=>{
    const {ejecutar,escrituras}=accion({rol});
    await assert.rejects(ejecutar(),new RegExp(`REDIRECT:/panel/inspecciones/prueba/${rol===RolUsuario.DIRECTOR?'revision':'reporte-v1'}\\?ok=`));
    assert.equal(escrituras.length,1);
    assert.equal(escrituras[0].data.estado,EstadoInspeccion.REPORTE_PENDIENTE);
  });
}
for(const opciones of [{rol:RolUsuario.GERENTE},{rol:RolUsuario.INSPECTOR,asignado:false},{activo:false},{firmas:false}]) {
  test(`servidor conserva restricciones ${JSON.stringify(opciones)}`,async()=>{
    const {ejecutar,escrituras}=accion(opciones);
    await assert.rejects(ejecutar(),/REDIRECT:.*(?:acceso|error=)/);
    assert.equal(escrituras.length,0);
  });
}
