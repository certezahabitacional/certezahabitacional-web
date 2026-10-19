// Isolated PostgreSQL integration test. Never accepts a remote or production database.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const {Client}=require('pg');
const root=path.resolve(__dirname,'..');
const url=new URL(process.env.CATALOGO_TEST_DATABASE_URL||'');
assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
assert.equal(url.pathname,'/catalogo_test');
const client=new Client({connectionString:url.href});
const tagged=(strings,values)=>({text:strings.reduce((s,p,i)=>s+(i?'$'+i:'')+p,''),values});
const db={
 $queryRaw:async(strings,...values)=>(await client.query(tagged(strings,values))).rows,
 $executeRaw:async(strings,...values)=>(await client.query(tagged(strings,values))).rowCount,
};
const cache=new Map();
function load(file){
 const absolute=path.resolve(root,file);
 if(cache.has(absolute))return cache.get(absolute).exports;
 const mod={exports:{}};cache.set(absolute,mod);
 const output=ts.transpileModule(fs.readFileSync(absolute,'utf8'),{fileName:absolute,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 new Function('require','module','exports',output)((name)=>{
  if(name==='@/lib/prisma')return{prisma:db};
  if(name.startsWith('@/'))return load(name.slice(2)+'.ts');
  return require(name);
 },mod,mod.exports);return mod.exports;
}
const setup=`
CREATE ROLE anon; CREATE ROLE authenticated;
CREATE TABLE "Inspeccion"("id" text PRIMARY KEY,"estado" text NOT NULL DEFAULT 'EN_PROCESO',"numeroInspeccion" int NOT NULL DEFAULT 1);
CREATE TABLE "PlanPrevioInspeccion"("inspeccionId" text PRIMARY KEY REFERENCES "Inspeccion", "version" int DEFAULT 1,"partidas" jsonb NOT NULL,"confirmadoEn" timestamp,"confirmadoPorId" text,"actualizadoPorId" text,"actualizadoEn" timestamp DEFAULT now());
GRANT ALL ON "PlanPrevioInspeccion" TO anon,authenticated;
CREATE TABLE "AreaInspeccion"("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),"inspeccionId" text NOT NULL REFERENCES "Inspeccion","codigo" text NOT NULL,"nombre" text NOT NULL,"tipo" text NOT NULL DEFAULT 'INTERIOR',"orden" int DEFAULT 0,"origen" text NOT NULL DEFAULT 'PLANTILLA',"obligatoria" bool DEFAULT true,"estado" text DEFAULT 'PENDIENTE',"resultado" text,"comentarioFinal" text,"revisadaEn" timestamptz,"cerradaEn" timestamptz,UNIQUE("inspeccionId","codigo"));
CREATE TABLE "GuiaInspeccionItem"("id" text PRIMARY KEY,"inspeccionId" text NOT NULL REFERENCES "Inspeccion","areaId" uuid REFERENCES "AreaInspeccion","area" text NOT NULL,"concepto" text NOT NULL,"origen" text NOT NULL CHECK("origen" IN ('PROYECTO','COTIZACION','ESTANDAR','MANUAL','BIBLIOTECA_CERTEZA','INSPECTOR','PUNTO_CRITICO','EQUIPO_COTIZADO')),"origenV3" text DEFAULT 'BIBLIOTECA',"orden" int DEFAULT 0,"obligatorio" bool DEFAULT true,"completado" bool DEFAULT false,"estadoV3" text DEFAULT 'PENDIENTE',"motivoNoAplica" text,"creadoPorId" text,"requiereMedicion" bool DEFAULT false,"observacion" text,"valorMedido" text,"unidadMedida" text,"creadoEn" timestamp DEFAULT now(),"actualizadoEn" timestamp DEFAULT now());
CREATE TABLE "InspeccionControlV2"("inspeccionId" text PRIMARY KEY REFERENCES "Inspeccion","proyectoConfirmado" bool DEFAULT false,"areasConfirmadas" bool DEFAULT false,"actualizadoEn" timestamptz DEFAULT now());
CREATE TABLE "Hallazgo"("id" text PRIMARY KEY,"inspeccionId" text REFERENCES "Inspeccion","descripcion" text);
CREATE TABLE "Fotografia"("id" text PRIMARY KEY,"inspeccionId" text REFERENCES "Inspeccion","hallazgoId" text REFERENCES "Hallazgo","url" text DEFAULT 'fixture-not-a-real-file');
CREATE TABLE "FotografiaArea"("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),"fotografiaId" text UNIQUE REFERENCES "Fotografia","areaId" uuid REFERENCES "AreaInspeccion","guiaItemId" text REFERENCES "GuiaInspeccionItem","candidataPortada" bool DEFAULT false,"seleccionadaReporte" bool DEFAULT false);
CREATE TABLE "OperacionCampoSync"("id" text PRIMARY KEY,"inspeccionId" text REFERENCES "Inspeccion","estado" text);
CREATE TABLE "ProtocoloInspeccionPaso"("id" text PRIMARY KEY,"inspeccionId" text REFERENCES "Inspeccion","obligatorio" bool DEFAULT true,"estado" text DEFAULT 'PENDIENTE');
`;
let checks=0;
const pass=name=>{checks++;console.log('PASS '+checks+': '+name);};
async function main(){
 await client.connect();
 assert.equal((await client.query('select current_database() as db')).rows[0].db,'catalogo_test');
 await client.query(setup);
 await client.query(fs.readFileSync(path.join(root,'prisma/migrations/20260923110500_v1_fachada_minima_autorizacion/migration.sql'),'utf8'));
 await client.query('CREATE TRIGGER fixture_cierre BEFORE UPDATE OF "estado" ON "Inspeccion" FOR EACH ROW EXECUTE FUNCTION public.validar_evidencia_minima_cierre_inspeccion()');
 const migration=fs.readFileSync(path.join(root,'sql/revision-manual/catalogo-confirmado-compatible.sql'),'utf8');
 await client.query('BEGIN');await client.query(migration);await client.query('COMMIT');
 pass('migration compiles with the original closure function on PostgreSQL');
 await client.query(migration);pass('migration is repeatable without double-wrapping the legacy trigger');
 const {CATALOGO_16_PARTIDAS}=load('lib/catalogo-16-partidas.ts');
 const plan=CATALOGO_16_PARTIDAS.map(p=>({...p,subpartidas:p.subpartidas.map(s=>({...s,conceptos:s.conceptos.map(nombre=>({nombre,aplica:!(p.orden===1&&['Instalación hidráulica','Instalación de gas'].includes(s.nombre)&&['Lectura inicial y foto','Lectura final y foto'].includes(nombre)),motivoNoAplica:'Decision previa de prueba CI'}))}))}));
 const id='CI-CATALOGO-NO-PRODUCCION';
 await client.query('INSERT INTO "Inspeccion"("id") VALUES($1)',[id]);
 const cover=(await client.query('INSERT INTO "AreaInspeccion"("inspeccionId","codigo","nombre") VALUES($1,\'FACHADA_PRINCIPAL\',\'Fachada principal\') RETURNING "id"',[id])).rows[0].id;
 await client.query('INSERT INTO "Fotografia"("id","inspeccionId") VALUES(\'cover-ci\',$1)',[id]);
 await client.query('INSERT INTO "FotografiaArea"("fotografiaId","areaId","candidataPortada") VALUES(\'cover-ci\',$1,true)',[cover]);
 for(let i=0;i<4;i++)await client.query('INSERT INTO "GuiaInspeccionItem"("id","inspeccionId","areaId","area","concepto","origen","estadoV3","motivoNoAplica") VALUES($1,$2,$3,\'LEGACY\',$4,\'PUNTO_CRITICO\',\'NO_APLICA\',\'Decision original CI\')',['old-'+i,id,cover,'Original '+i]);
 await client.query('INSERT INTO "ProtocoloInspeccionPaso"("id","inspeccionId") VALUES(\'legacy-ci\',$1)',[id]);
 await client.query('INSERT INTO "PlanPrevioInspeccion"("inspeccionId","partidas","confirmadoEn") VALUES($1,$2::jsonb,now())',[id,JSON.stringify(plan)]);
 const before=JSON.stringify((await client.query('SELECT * FROM "GuiaInspeccionItem" WHERE "origen"=\'PUNTO_CRITICO\' ORDER BY "id"')).rows);
 const materialize=load('lib/materializar-plan-confirmado.ts').materializarPlanConfirmado;
 const recorrido=load('lib/recorrido-plan-confirmado.ts');
 await client.query('BEGIN');await materialize(db,id,'director-ci',true);await client.query('ROLLBACK');
 assert.equal((await client.query('SELECT count(*)::int AS n FROM "AreaInspeccion" WHERE "origen"=\'PLAN_PREVIO\'')).rows[0].n,0);
 pass('real transaction rollback leaves the original inspection intact');
 await client.query('BEGIN');const created=await materialize(db,id,'director-ci',true);await client.query('COMMIT');
 const subs=plan.flatMap(p=>p.subpartidas),expected=subs.reduce((n,s)=>n+s.conceptos.length,0);
 assert.equal(created.areas,subs.length);assert.equal(created.conceptos,expected);
 assert.equal((await recorrido.obtenerRecorridoConfirmado(id)).length,17);
 pass('actual TypeScript materializer stores and reads the complete approved catalog');
 assert.equal(JSON.stringify((await client.query('SELECT * FROM "GuiaInspeccionItem" WHERE "origen"=\'PUNTO_CRITICO\' ORDER BY "id"')).rows),before);
 assert.equal((await client.query('SELECT count(*)::int AS n FROM "Fotografia"')).rows[0].n,1);
 assert.equal((await client.query('SELECT count(*)::int AS n FROM "GuiaInspeccionItem" WHERE "origenV3"=\'PLAN_PREVIO\' AND "estadoV3"=\'NO_APLICA\'')).rows[0].n,4);
 pass('one original cover and four No aplica decisions are preserved without claiming execution');
 const repeated=await materialize(db,id,'director-ci',true);assert.deepEqual(repeated,{areas:0,conceptos:0});pass('materialization is idempotent');
 assert.match(await recorrido.validarCierrePlanConfirmado(id),/Faltan/);pass('pending subareas block application closure');
 await client.query('UPDATE "GuiaInspeccionItem" SET "estadoV3"=\'NO_APLICA\',"motivoNoAplica"=\'Synthetic CI decision\' WHERE "origenV3"=\'PLAN_PREVIO\'');
 await client.query('UPDATE "AreaInspeccion" SET "estado"=\'REVISADA\',"resultado"=\'NO_APLICA\' WHERE "origen"=\'PLAN_PREVIO\'');
 assert.equal(await recorrido.validarCierrePlanConfirmado(id),null);
 await client.query('UPDATE "Inspeccion" SET "estado"=\'REPORTE_PENDIENTE\' WHERE "id"=$1',[id]);
 pass('confirmed plan can close without completing unrelated legacy steps');
 await client.query('UPDATE "Inspeccion" SET "estado"=\'EN_PROCESO\' WHERE "id"=$1',[id]);
 const item=(await client.query('SELECT "id","areaId" FROM "GuiaInspeccionItem" WHERE "origenV3"=\'PLAN_PREVIO\' AND "requiereMedicion" LIMIT 1')).rows[0];
 await client.query('UPDATE "GuiaInspeccionItem" SET "estadoV3"=\'PENDIENTE\' WHERE "id"=$1',[item.id]);
 const close=()=>client.query('UPDATE "Inspeccion" SET "estado"=\'REPORTE_PENDIENTE\' WHERE "id"=$1',[id]);
 await assert.rejects(close,e=>e.code==='23514');pass('database trigger rejects a pending concept');
 await client.query('UPDATE "GuiaInspeccionItem" SET "estadoV3"=\'NO_APLICA\',"motivoNoAplica"=null WHERE "id"=$1',[item.id]);
 await assert.rejects(close,e=>e.code==='23514');pass('database trigger rejects No aplica without a reason');
 await client.query('UPDATE "GuiaInspeccionItem" SET "estadoV3"=\'REVISADO\',"observacion"=\'Synthetic CI reading\' WHERE "id"=$1',[item.id]);
 await assert.rejects(close,e=>e.code==='23514');pass('database trigger rejects a result without reading and evidence');
 await client.query('UPDATE "GuiaInspeccionItem" SET "valorMedido"=\'20\',"unidadMedida"=\'psi\' WHERE "id"=$1',[item.id]);
 await client.query('INSERT INTO "Fotografia"("id","inspeccionId") VALUES(\'reading-ci\',$1)',[id]);
 await client.query('INSERT INTO "FotografiaArea"("fotografiaId","areaId","guiaItemId") VALUES(\'reading-ci\',$1,$2)',[item.areaId,item.id]);
 assert.equal(await recorrido.validarCierrePlanConfirmado(id),null);await close();pass('a documented synthetic result passes both application and trigger checks');
 await client.query('INSERT INTO "Inspeccion"("id") VALUES(\'CI-LEGACY\');INSERT INTO "InspeccionControlV2"("inspeccionId") VALUES(\'CI-LEGACY\')');
 await assert.rejects(()=>client.query('UPDATE "Inspeccion" SET "estado"=\'REPORTE_PENDIENTE\' WHERE "id"=\'CI-LEGACY\''),e=>e.code==='23514');pass('legacy closure protections remain enforced');
 await client.query('SET ROLE anon');try{await assert.rejects(()=>client.query('SELECT * FROM "PlanPrevioInspeccion"'),e=>e.code==='42501');}finally{await client.query('RESET ROLE');}
 assert.equal((await client.query('SELECT has_table_privilege(\'anon\',\'public."PlanPrevioInspeccion"\',\'TRUNCATE\') AS allowed')).rows[0].allowed,false);
 pass('anonymous direct access and truncate are denied while server owner access works');
 console.log(JSON.stringify({checks,partidas:plan.length,subpartidas:subs.length,conceptos:expected,productionRecordsTouched:0}));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>client.end());
