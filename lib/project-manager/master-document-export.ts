type ActivityLike = {
  codigo:string; actividad:string; descripcion:string|null; tipo:string|null; etapa:string|null;
  dependencia:string|null; responsable:string|null; organismo:string|null;
  fechaInicioPlan:Date|null; fechaFinPlan:Date|null; entregable:string|null;
  periodicidad:string|null; bloqueante:boolean; prioridad:string; reglaAlerta:string|null; estado:string;
};

const headers=[
  "codigo","actividad","descripcion","tipo","etapa","dependencia","responsable","organismo",
  "fechaInicioPlan","fechaFinPlan","entregable","periodicidad","bloqueante","prioridad","reglaAlerta","estado"
];

function csvCell(v:unknown){
  const s=String(v??"");
  return /[",\n\r]/.test(s)?`"${s.replaceAll('"','""')}"`:s;
}

export function activityCsv(rows:ActivityLike[]){
  const lines=[headers.join(",")];
  for(const a of rows){
    lines.push([
      a.codigo,a.actividad,a.descripcion??"",a.tipo??"",a.etapa??"",a.dependencia??"",
      a.responsable??"",a.organismo??"",
      a.fechaInicioPlan?.toISOString().slice(0,10)??"",
      a.fechaFinPlan?.toISOString().slice(0,10)??"",
      a.entregable??"",a.periodicidad??"",a.bloqueante?"SI":"NO",
      a.prioridad,a.reglaAlerta??"",a.estado
    ].map(csvCell).join(","));
  }
  return "\uFEFF"+lines.join("\r\n");
}

export function constructibilidadSummaryCsv(project:{codigo:string;nombre:string}, c:Record<string,unknown>|null, docs:{codigo:string;nombre:string;periodicidadDefault:string|null;moduloPrincipal:string|null;modulosDestino:unknown}[]){
  const lines=[["Seccion","Campo","Valor"].map(csvCell).join(",")];
  lines.push(["Proyecto","Código",project.codigo].map(csvCell).join(","));
  lines.push(["Proyecto","Nombre",project.nombre].map(csvCell).join(","));
  if(c){
    const keys=[
      "condicionPredio","clasificacionDetalle","superficieM2","numeroPredios","disponibilidadFisica",
      "situacionJuridica","usoSuelo","serviciosInfraestructura","estudiosEspecializados","productoEscala",
      "mercadoComercializacion","financiamientoProyecto","proyectoEjecutivo","autorizacionesConstruccion",
      "presupuestoBase","programaMaestro","estrategiaEjecucion","contratacionSuministros","preparacionObra",
      "seguimientoOperativo"
    ];
    for(const k of keys){
      const v=c[k];
      if(v!==null && v!==undefined){
        lines.push(["Constructibilidad",k,typeof v==="object"?JSON.stringify(v):String(v)].map(csvCell).join(","));
      }
    }
  }
  for(const d of docs){
    lines.push(["Documento Maestro",d.codigo,`${d.nombre} | Módulo: ${d.moduloPrincipal??"—"} | Periodicidad: ${d.periodicidadDefault??"—"} | Destinos: ${Array.isArray(d.modulosDestino)?d.modulosDestino.join(" / "):"—"}`].map(csvCell).join(","));
  }
  return "\uFEFF"+lines.join("\r\n");
}

export function safeFileName(v:string){
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9._-]+/g,"_").replace(/_+/g,"_").replace(/^_|_$/g,"");
}
