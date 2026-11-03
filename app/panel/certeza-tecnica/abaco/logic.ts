import JSZip from "jszip";

export type BudgetRow = {
  descripcion:string;
  partida:string;
  unidad:string;
  cantidad:number;
  importe:number;
  sec:number|null;
  cuadrilla:string;
  rendimiento:number;
  reglaRendimiento:string;
};

export type SeqRow = {
  orden:number;
  sec:number;
  etapa:string;
  guia:string;
  importe:number;
  equivalencia:number;
  cuadrilla:string;
  revisar:boolean;
  cantidad:number;
  unidad:string;
  jornadasBase:number;
  conceptosSinRendimiento:number;
  cuadrillas:number;
  predecesora:number|null;
  traslape:number;
};

export type ProgramRow = SeqRow & {
  dias:number;
  inicio:string;
  termino:string;
  avance:number;
  metodoDuracion:"RENDIMIENTO"|"MIXTO"|"PARAMETRICO";
};

type StageRule={
  sec:number;
  etapa:string;
  guia:string;
  cuadrilla:string;
  rx:RegExp[];
};

export type ProductivityRule={
  nombre:string;
  cuadrilla:string;
  unidad:string;
  rendimiento:number;
  rx:RegExp[];
};

export const STAGE_RULES:StageRule[]=[
{sec:0,etapa:"PLATAFORMA",guia:"ENTREGA-RECEPCIÓN DE PLATAFORMA CON SERVICIOS",cuadrilla:"Terracerías",rx:[/PLATAFORMA/,/ENTREGA.*TERRENO/]},
{sec:1,etapa:"CIMENTACIÓN ETAPA 1",guia:"TRAZO Y NIVELACIÓN PARA CIMENTACIÓN",cuadrilla:"Topografía / albañilería",rx:[/TRAZO.*CIMENT/,/NIVEL.*CIMENT/]},
{sec:2,etapa:"CIMENTACIÓN ETAPA 2",guia:"RENIVELACIÓN DE TERRENO PARA CIMENTACIÓN",cuadrilla:"Terracerías",rx:[/RENIVEL/,/RELLENO.*CIMENT/,/COMPACT.*CIMENT/,/EXCAV.*CIMENT/]},
{sec:3,etapa:"CIMENTACIÓN ETAPA 3",guia:"HABILITADOS Y PROGRAMACIÓN DE CONCRETO PARA CIMENTACIÓN",cuadrilla:"Fierreros / instalaciones",rx:[/ACERO.*CIMENT/,/HABILIT.*CIMENT/,/CIMBRA.*CIMENT/,/INSTAL.*CIMENT/]},
{sec:4,etapa:"CIMENTACIÓN ETAPA 4",guia:"SUMINISTRO Y COLOCACIÓN DE CONCRETO EN CIMENTACIÓN",cuadrilla:"Concreto",rx:[/CONCRETO.*CIMENT/,/COLADO.*CIMENT/,/LOSA.*CIMENT/]},
{sec:5,etapa:"MOLDE P.B. ETAPA 1",guia:"HABILITADO DE ACERO E INSTALACIONES",cuadrilla:"Fierreros / instalaciones",rx:[/HABILIT.*P.?B/,/INSTAL.*P.?B/]},
{sec:6,etapa:"MOLDE P.B.",guia:"TRAZO Y NIVELACIÓN MOLDE P.B.",cuadrilla:"Molde / topografía",rx:[/TRAZO.*MOLDE.*P.?B/,/NIVEL.*MOLDE.*P.?B/]},
{sec:7,etapa:"MOLDE 1N ETAPA 1",guia:"HABILITADO Y ARMADO DE MOLDE P.B.",cuadrilla:"Molde / fierreros",rx:[/ARMAD.*MOLDE.*P.?B/,/HABILIT.*MOLDE.*P.?B/]},
{sec:8,etapa:"MOLDE 1N ETAPA 2",guia:"SUMINISTRO Y COLOCACIÓN DE CONCRETO MOLDE P.B.",cuadrilla:"Concreto",rx:[/CONCRETO.*MOLDE.*P.?B/,/COLADO.*MOLDE.*P.?B/]},
{sec:9,etapa:"MOLDE 1N ETAPA 3",guia:"TRAZO Y NIVELACIÓN MOLDE 1N.",cuadrilla:"Molde / topografía",rx:[/TRAZO.*MOLDE.*1N/,/NIVEL.*MOLDE.*1N/]},
{sec:10,etapa:"MOLDE 1N ETAPA 4",guia:"HABILITADO Y ARMADO DE MOLDE 1N.",cuadrilla:"Molde / fierreros",rx:[/ARMAD.*MOLDE.*1N/,/HABILIT.*MOLDE.*1N/]},
{sec:11,etapa:"MOLDE 1N ETAPA 5",guia:"SUMINISTRO Y COLOCACIÓN DE CONCRETO MOLDE 1N.",cuadrilla:"Concreto",rx:[/CONCRETO.*MOLDE.*1N/,/COLADO.*MOLDE.*1N/]},
{sec:12,etapa:"MOLDE 2N ETAPA 1",guia:"TRAZO Y NIVELACIÓN MOLDE 2N.",cuadrilla:"Molde / topografía",rx:[/TRAZO.*MOLDE.*2N/,/NIVEL.*MOLDE.*2N/]},
{sec:13,etapa:"MOLDE 2N ETAPA 2",guia:"HABILITADO Y ARMADO DE MOLDE 2N.",cuadrilla:"Molde / fierreros",rx:[/ARMAD.*MOLDE.*2N/,/HABILIT.*MOLDE.*2N/]},
{sec:14,etapa:"MOLDE 2N ETAPA 3",guia:"SUMINISTRO Y COLOCACIÓN DE CONCRETO MOLDE 2N.",cuadrilla:"Concreto",rx:[/CONCRETO.*MOLDE.*2N/,/COLADO.*MOLDE.*2N/]},
{sec:15,etapa:"MOLDE 3N ETAPA 1",guia:"TRAZO Y NIVELACIÓN MOLDE 3N.",cuadrilla:"Molde / topografía",rx:[/TRAZO.*MOLDE.*3N/,/NIVEL.*MOLDE.*3N/]},
{sec:16,etapa:"MOLDE 3N ETAPA 2",guia:"HABILITADO Y ARMADO DE MOLDE 3N.",cuadrilla:"Molde / fierreros",rx:[/ARMAD.*MOLDE.*3N/,/HABILIT.*MOLDE.*3N/]},
{sec:17,etapa:"MOLDE 3N ETAPA 3",guia:"SUMINISTRO Y COLOCACIÓN DE CONCRETO MOLDE 3N.",cuadrilla:"Concreto",rx:[/CONCRETO.*MOLDE.*3N/,/COLADO.*MOLDE.*3N/]},
{sec:20,etapa:"ALBAÑILERÍAS",guia:"ALBAÑILERÍAS Y MUROS",cuadrilla:"Albañilería",rx:[/ALBANILER/,/MURO.*BLOCK/]},
{sec:25,etapa:"INSTALACIÓN ELÉCTRICA",guia:"INSTALACIONES ELÉCTRICAS",cuadrilla:"Electricistas",rx:[/ELECTRIC/,/CABLE/,/CONTACTO/,/APAGADOR/,/TABLERO/]},
{sec:26,etapa:"INSTALACIONES HIDROSANITARIAS",guia:"INSTALACIONES HIDRÁULICAS, SANITARIAS Y GAS",cuadrilla:"Plomeros",rx:[/HIDRAUL/,/SANITAR/,/DRENAJE/,/TUBERIA/,/GAS/]},
{sec:30,etapa:"ACABADOS BASE",guia:"APLANADOS, YESOS Y PASTAS",cuadrilla:"Acabados",rx:[/APLANAD/,/YESO/,/PASTA/]},
{sec:35,etapa:"PISOS Y RECUBRIMIENTOS",guia:"PISOS, LOSETAS Y AZULEJOS",cuadrilla:"Pisos",rx:[/PISO/,/LOSETA/,/AZULEJO/,/RECUBRIMIENTO/]},
{sec:40,etapa:"CARPINTERÍA Y CANCELERÍA",guia:"PUERTAS, VENTANAS Y CANCELERÍA",cuadrilla:"Carpintería / cancelería",rx:[/PUERTA/,/VENTANA/,/CANCEL/,/CARPINTER/]},
{sec:45,etapa:"PINTURA",guia:"PINTURA Y TERMINACIONES",cuadrilla:"Pintores",rx:[/PINTURA/]},
{sec:50,etapa:"DETALLES Y ENTREGA",guia:"LIMPIEZA, DETALLES Y ENTREGA",cuadrilla:"Detalles / limpieza",rx:[/LIMPIEZA GRUESA/,/LIMPIEZA FINA/,/LIMPIEZA FINAL/,/DETALLE/,/ENTREGA/]}
];

export const PRODUCTIVITY_RULES:ProductivityRule[]=[
{nombre:"Trazo y nivelación",cuadrilla:"Topografía / albañilería",unidad:"M2",rendimiento:800,rx:[/TRAZO/,/NIVELACION/]},
{nombre:"Excavación manual",cuadrilla:"Terracerías",unidad:"M3",rendimiento:10,rx:[/EXCAVACION/]},
{nombre:"Relleno y compactación",cuadrilla:"Terracerías",unidad:"M3",rendimiento:15,rx:[/RELLENO/,/COMPACT/]},
{nombre:"Acero de refuerzo",cuadrilla:"Fierreros",unidad:"KG",rendimiento:250,rx:[/ACERO/,/VARILLA/,/ARMADO/]},
{nombre:"Cimbra o molde",cuadrilla:"Carpintería / molde",unidad:"M2",rendimiento:55,rx:[/CIMBRA/,/MOLDE/]},
{nombre:"Concreto",cuadrilla:"Concreto",unidad:"M3",rendimiento:25,rx:[/CONCRETO/,/COLADO/]},
{nombre:"Muro de block",cuadrilla:"Albañilería",unidad:"M2",rendimiento:28,rx:[/MURO/,/BLOCK/,/ALBANILER/]},
{nombre:"Tubería hidrosanitaria",cuadrilla:"Plomeros",unidad:"ML",rendimiento:60,rx:[/TUBERIA/,/DRENAJE/,/HIDRAUL/,/SANITAR/]},
{nombre:"Cableado eléctrico",cuadrilla:"Electricistas",unidad:"ML",rendimiento:80,rx:[/CABLE/,/CONDUIT/,/POLIDUCTO/]},
{nombre:"Aparatos eléctricos",cuadrilla:"Electricistas",unidad:"PZA",rendimiento:20,rx:[/CONTACTO/,/APAGADOR/,/LUMINARIA/,/TABLERO/]},
{nombre:"Aplanado, yeso o pasta",cuadrilla:"Acabados",unidad:"M2",rendimiento:45,rx:[/APLANADO/,/YESO/,/PASTA/]},
{nombre:"Impermeabilización",cuadrilla:"Impermeabilización",unidad:"M2",rendimiento:90,rx:[/IMPERMEABIL/]},
{nombre:"Piso y recubrimiento",cuadrilla:"Pisos",unidad:"M2",rendimiento:20,rx:[/PISO/,/LOSETA/,/AZULEJO/,/RECUBRIMIENTO/]},
{nombre:"Pintura",cuadrilla:"Pintores",unidad:"M2",rendimiento:95,rx:[/PINTURA/]},
{nombre:"Puertas y ventanas",cuadrilla:"Carpintería / cancelería",unidad:"PZA",rendimiento:6,rx:[/PUERTA/,/VENTANA/,/CANCEL/]},
{nombre:"Limpieza final",cuadrilla:"Detalles / limpieza",unidad:"M2",rendimiento:250,rx:[/LIMPIEZA GRUESA/,/LIMPIEZA FINA/,/LIMPIEZA FINAL/]}
];

export const norm=(v:unknown)=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toUpperCase();
const num=(v:unknown)=>{if(typeof v==="number"&&Number.isFinite(v))return v;const n=Number(String(v??"").replace(/[$,%\s]/g,"").replace(/,/g,""));return Number.isFinite(n)?n:0};
export const money=(v:number)=>new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",maximumFractionDigits:0}).format(v);
export const pct=(v:number)=>new Intl.NumberFormat("es-MX",{style:"percent",minimumFractionDigits:2,maximumFractionDigits:2}).format(v);

function colToIndex(ref:string){const letters=(ref.match(/[A-Z]+/)?.[0]??"A");let n=0;for(const c of letters)n=n*26+(c.charCodeAt(0)-64);return n-1}
function xmlText(cell:Element,shared:string[]){const t=cell.getAttribute("t");if(t==="inlineStr")return cell.querySelector("is t")?.textContent??"";const v=cell.querySelector("v")?.textContent??"";if(t==="s")return shared[Number(v)]??"";return v}
function sheetMatrix(xml:string,shared:string[]){const doc=new DOMParser().parseFromString(xml,"application/xml");const out:unknown[][]=[];doc.querySelectorAll("sheetData row").forEach((row)=>{const arr:unknown[]=[];row.querySelectorAll("c").forEach((cell)=>{const ref=cell.getAttribute("r")??"A1";arr[colToIndex(ref)]=xmlText(cell,shared)});out.push(arr)});return out}
function locateHeader(rows:unknown[][]){for(let i=0;i<Math.min(rows.length,40);i++){const r=rows[i].map(norm);const score=["DESCRIPCION","CANTIDAD","PRECIO","IMPORTE","PARTIDA","UNIDAD"].filter((x)=>r.includes(x)).length;if(score>=3)return i}return-1}

function classifyStage(descripcion:string,partida:string){
 const t=norm(partida+" "+descripcion);
 for(const rule of STAGE_RULES)if(rule.rx.some((rx)=>rx.test(t)))return rule.sec;
 return null;
}

function classifyProductivity(descripcion:string,unidad:string){
 const t=norm(descripcion);
 const u=norm(unidad).replace(/./g,"");
 for(const rule of PRODUCTIVITY_RULES){
   const sameUnit=u===rule.unidad || (rule.unidad==="PZA" && ["PZA","PZ","PZAS","PIEZA","PIEZAS"].includes(u)) || (rule.unidad==="ML" && ["ML","M","M L"].includes(u));
   if(sameUnit && rule.rx.some((rx)=>rx.test(t)))return rule;
 }
 return null;
}

export async function readBudgetFile(file:File):Promise<BudgetRow[]>{
 let rows:unknown[][]=[];
 if(file.name.toLowerCase().endsWith(".csv")){
   const text=await file.text();const sep=text.includes(";")?";":",";rows=text.split(/\r?\n/).filter(Boolean).map((line)=>line.split(sep));
 } else {
   const zip=await JSZip.loadAsync(await file.arrayBuffer());
   const sharedXml=await zip.file("xl/sharedStrings.xml")?.async("string");
   const shared:string[]=[];
   if(sharedXml){const d=new DOMParser().parseFromString(sharedXml,"application/xml");d.querySelectorAll("si").forEach((si)=>shared.push(Array.from(si.querySelectorAll("t")).map((t)=>t.textContent??"").join("")))}
   const sheets=Object.keys(zip.files).filter((p)=>/^xl\/worksheets\/sheet\d+\.xml$/.test(p)).sort();
   for(const path of sheets){const xml=await zip.file(path)?.async("string");if(!xml)continue;const candidate=sheetMatrix(xml,shared);if(locateHeader(candidate)>=0){rows=candidate;break}}
 }
 const h=locateHeader(rows);if(h<0)throw new Error("No encontré encabezados reconocibles en el presupuesto.");
 const headers=rows[h].map(norm);const find=(names:string[])=>names.map((x)=>headers.indexOf(x)).find((x)=>x>=0)??-1;
 const i={
   descripcion:find(["DESCRIPCION","CONCEPTO"]),
   partida:find(["PARTIDA","CAPITULO"]),
   unidad:find(["UNIDAD","UND","U.M.","UM"]),
   cantidad:find(["CANTIDAD","CANT"]),
   precio:find(["PRECIO","P.U.","PU","PRECIO UNITARIO"]),
   importe:find(["IMPORTE","TOTAL"]),
   sec:find(["SEC","SECUENCIAL","SECUENCIA"])
 };
 const result=rows.slice(h+1).map((r)=>{
   const descripcion=i.descripcion>=0?String(r[i.descripcion]??""):"";
   const partida=i.partida>=0?String(r[i.partida]??""):"";
   const unidad=i.unidad>=0?String(r[i.unidad]??"").trim():"";
   const cantidad=i.cantidad>=0?num(r[i.cantidad]):0;
   const precio=i.precio>=0?num(r[i.precio]):0;
   let importe=i.importe>=0?num(r[i.importe]):0;
   if(!importe&&cantidad&&precio)importe=cantidad*precio;
   const secRaw=i.sec>=0?num(r[i.sec]):0;
   const sec=secRaw>0?Math.round(secRaw):classifyStage(descripcion,partida);
   const prod=classifyProductivity(descripcion,unidad);
   return{
     descripcion,partida,unidad,cantidad,importe,sec,
     cuadrilla:prod?.cuadrilla??"",
     rendimiento:prod?.rendimiento??0,
     reglaRendimiento:prod?.nombre??""
   };
 }).filter((r)=>r.descripcion&&r.importe>0);
 if(!result.length)throw new Error("No encontré conceptos con importe válido.");
 return result;
}

export function makeSequential(budget:BudgetRow[]):SeqRow[]{
 const total=budget.reduce((s,r)=>s+r.importe,0);
 const groups=new Map<number,{importe:number;ejemplo:string;units:Set<string>;cantidadPorUnidad:Map<string,number>;jornadas:number;sinRend:number;cuadrillas:Map<string,number>}>();
 let review=1000;
 budget.forEach((r)=>{
   const sec=r.sec??review++;
   const g=groups.get(sec)??{importe:0,ejemplo:r.descripcion,units:new Set<string>(),cantidadPorUnidad:new Map<string,number>(),jornadas:0,sinRend:0,cuadrillas:new Map<string,number>()};
   g.importe+=r.importe;
   const u=norm(r.unidad)||"SIN UNIDAD";
   g.units.add(u);
   if(r.cantidad>0)g.cantidadPorUnidad.set(u,(g.cantidadPorUnidad.get(u)??0)+r.cantidad);
   if(r.cantidad>0&&r.rendimiento>0)g.jornadas+=r.cantidad/r.rendimiento;
   else g.sinRend+=1;
   if(r.cuadrilla)g.cuadrillas.set(r.cuadrilla,(g.cuadrillas.get(r.cuadrilla)??0)+r.importe);
   groups.set(sec,g);
 });
 const ordered=[...groups.entries()].sort(([a],[b])=>a-b);
 return ordered.map(([sec,g],index)=>{
   const stage=STAGE_RULES.find((x)=>x.sec===sec);
   const units=[...g.units].filter(u=>u!=="SIN UNIDAD");
   const unidad=units.length===1?units[0]:(units.length>1?"MIXTA":"POR DEFINIR");
   const cantidad=units.length===1?(g.cantidadPorUnidad.get(units[0])??0):0;
   const crew=[...g.cuadrillas.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]??stage?.cuadrilla??"Por definir";
   return{
     orden:index+1,
     sec,
     etapa:stage?.etapa??"ETAPA POR REVISAR",
     guia:stage?.guia??g.ejemplo,
     importe:g.importe,
     equivalencia:total?g.importe/total:0,
     cuadrilla:crew,
     revisar:!stage,
     cantidad,
     unidad,
     jornadasBase:g.jornadas,
     conceptosSinRendimiento:g.sinRend,
     cuadrillas:1,
     predecesora:index===0?null:ordered[index-1][0],
     traslape:index===0?0:0.5
   };
 });
}

function addWorkDaysFromDate(date:Date,days:number){
 const d=new Date(date);
 let n=Math.max(0,Math.round(days));
 while(n>0){d.setDate(d.getDate()+1);if(d.getDay()!==0)n--}
 return d;
}
const fmtDate=(d:Date)=>new Intl.DateTimeFormat("es-MX",{day:"2-digit",month:"2-digit",year:"numeric"}).format(d);
function parseDisplayDate(value:string){const [d,m,y]=value.split("/").map(Number);return new Date(y,m-1,d,12,0,0)}

export function makeProgram(seq:SeqRow[],startDate:string,targetDays:number):ProgramRow[]{
 const bySec=new Map<number,ProgramRow>();
 let accumulated=0;
 return seq.map((r)=>{
   const knownDays=r.jornadasBase>0?Math.max(1,Math.ceil(r.jornadasBase/Math.max(1,r.cuadrillas))):0;
   const paramDays=Math.max(1,Math.round(Math.max(1,targetDays)*r.equivalencia));
   let metodo:"RENDIMIENTO"|"MIXTO"|"PARAMETRICO"="PARAMETRICO";
   let dias=paramDays;
   if(knownDays>0 && r.conceptosSinRendimiento===0){metodo="RENDIMIENTO";dias=knownDays}
   else if(knownDays>0 && r.conceptosSinRendimiento>0){metodo="MIXTO";dias=Math.max(knownDays,paramDays)}

   let inicio=new Date(startDate+"T12:00:00");
   if(r.predecesora!==null){
     const pred=bySec.get(r.predecesora);
     if(pred){
       const predStart=parseDisplayDate(pred.inicio);
       const offset=Math.max(1,Math.round(pred.dias*(1-Math.max(0,Math.min(.95,r.traslape)))));
       inicio=addWorkDaysFromDate(predStart,offset);
     }
   }
   const termino=addWorkDaysFromDate(inicio,dias-1);
   accumulated+=r.equivalencia;
   const row:ProgramRow={...r,dias,inicio:fmtDate(inicio),termino:fmtDate(termino),avance:accumulated,metodoDuracion:metodo};
   bySec.set(r.sec,row);
   return row;
 });
}
