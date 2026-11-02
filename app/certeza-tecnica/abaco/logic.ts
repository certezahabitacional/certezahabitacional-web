import JSZip from "jszip";

export type BudgetRow = { descripcion:string; partida:string; importe:number; sec:number|null };
export type SeqRow = { orden:number; sec:number; etapa:string; guia:string; importe:number; equivalencia:number; cuadrilla:string; revisar:boolean };
export type ProgramRow = SeqRow & { dias:number; inicio:string; termino:string; avance:number };

type Rule={sec:number;etapa:string;guia:string;cuadrilla:string;rx:RegExp[]};

export const RULES:Rule[]=[
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
{sec:50,etapa:"DETALLES Y ENTREGA",guia:"LIMPIEZA, DETALLES Y ENTREGA",cuadrilla:"Detalles / limpieza",rx:[/LIMPIEZA/,/DETALLE/,/ENTREGA/]}
];

export const norm=(v:unknown)=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toUpperCase();
const num=(v:unknown)=>{if(typeof v==="number"&&Number.isFinite(v))return v;const n=Number(String(v??"").replace(/[$,%\s]/g,"").replace(/,/g,""));return Number.isFinite(n)?n:0};
export const money=(v:number)=>new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",maximumFractionDigits:0}).format(v);
export const pct=(v:number)=>new Intl.NumberFormat("es-MX",{style:"percent",minimumFractionDigits:2,maximumFractionDigits:2}).format(v);

function colToIndex(ref:string){const letters=(ref.match(/[A-Z]+/)?.[0]??"A");let n=0;for(const c of letters)n=n*26+(c.charCodeAt(0)-64);return n-1}
function xmlText(cell:Element,shared:string[]){const t=cell.getAttribute("t");if(t==="inlineStr")return cell.querySelector("is t")?.textContent??"";const v=cell.querySelector("v")?.textContent??"";if(t==="s")return shared[Number(v)]??"";return v}
function sheetMatrix(xml:string,shared:string[]){const doc=new DOMParser().parseFromString(xml,"application/xml");const out:unknown[][]=[];doc.querySelectorAll("sheetData row").forEach((row)=>{const arr:unknown[]=[];row.querySelectorAll("c").forEach((cell)=>{const ref=cell.getAttribute("r")??"A1";arr[colToIndex(ref)]=xmlText(cell,shared)});out.push(arr)});return out}
function locateHeader(rows:unknown[][]){for(let i=0;i<Math.min(rows.length,40);i++){const r=rows[i].map(norm);const score=["DESCRIPCION","CANTIDAD","PRECIO","IMPORTE","PARTIDA"].filter((x)=>r.includes(x)).length;if(score>=3)return i}return-1}

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
 const i={descripcion:find(["DESCRIPCION","CONCEPTO"]),partida:find(["PARTIDA","CAPITULO"]),cantidad:find(["CANTIDAD","CANT"]),precio:find(["PRECIO","P.U.","PU","PRECIO UNITARIO"]),importe:find(["IMPORTE","TOTAL"]),sec:find(["SEC","SECUENCIAL","SECUENCIA"])};
 const result=rows.slice(h+1).map((r)=>{
   const descripcion=i.descripcion>=0?String(r[i.descripcion]??""):"";const partida=i.partida>=0?String(r[i.partida]??""):"";
   const cantidad=i.cantidad>=0?num(r[i.cantidad]):0;const precio=i.precio>=0?num(r[i.precio]):0;let importe=i.importe>=0?num(r[i.importe]):0;if(!importe&&cantidad&&precio)importe=cantidad*precio;
   const secRaw=i.sec>=0?num(r[i.sec]):0;let sec:number|null=secRaw>0?Math.round(secRaw):null;
   if(sec===null){const t=norm(partida+" "+descripcion);for(const rule of RULES){if(rule.rx.some((rx)=>rx.test(t))){sec=rule.sec;break}}}
   return{descripcion,partida,importe,sec};
 }).filter((r)=>r.descripcion&&r.importe>0);
 if(!result.length)throw new Error("No encontré conceptos con importe válido.");return result;
}

export function makeSequential(budget:BudgetRow[]):SeqRow[]{
 const total=budget.reduce((s,r)=>s+r.importe,0);const groups=new Map<number,{importe:number;ejemplo:string}>();let review=1000;
 budget.forEach((r)=>{const sec=r.sec??review++;const g=groups.get(sec)??{importe:0,ejemplo:r.descripcion};g.importe+=r.importe;groups.set(sec,g)});
 return[...groups.entries()].sort(([a],[b])=>a-b).map(([sec,g],index)=>{const rule=RULES.find((x)=>x.sec===sec);return{orden:index+1,sec,etapa:rule?.etapa??"ETAPA POR REVISAR",guia:rule?.guia??g.ejemplo,importe:g.importe,equivalencia:total?g.importe/total:0,cuadrilla:rule?.cuadrilla??"Por definir",revisar:!rule}});
}
function addDays(iso:string,days:number){const d=new Date(iso+"T12:00:00");let n=Math.max(0,Math.round(days));while(n>0){d.setDate(d.getDate()+1);if(d.getDay()!==0)n--}return d}
const fmtDate=(d:Date)=>new Intl.DateTimeFormat("es-MX",{day:"2-digit",month:"2-digit",year:"numeric"}).format(d);
export function makeProgram(seq:SeqRow[],startDate:string,targetDays:number,crews:number,overlap:number):ProgramRow[]{let cursor=new Date(startDate+"T12:00:00");let accumulated=0;return seq.map((r)=>{const dias=Math.max(1,Math.round((Math.max(1,targetDays)*r.equivalencia)/Math.sqrt(Math.max(1,crews))));const inicio=new Date(cursor);const termino=addDays(inicio.toISOString().slice(0,10),dias-1);accumulated+=r.equivalencia;cursor=addDays(inicio.toISOString().slice(0,10),Math.max(1,Math.round(dias*(1-overlap))));return{...r,dias,inicio:fmtDate(inicio),termino:fmtDate(termino),avance:accumulated}})}
