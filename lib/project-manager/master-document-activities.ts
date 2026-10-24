const asObj=(v:unknown)=>(v&&typeof v==="object"&&!Array.isArray(v)?v:{}) as Record<string,unknown>;
const asList=(v:unknown)=>Array.isArray(v)?v.map(String):[];

export type MasterActivityTemplate={
  codigo:string;
  actividad:string;
  descripcion?:string;
  tipo:string;
  etapa:string;
  dependencia?:string;
  responsable?:string;
  organismo?:string;
  fechaInicioPlan?:string;
  fechaFinPlan?:string;
  entregable:string;
  periodicidad:string;
  bloqueante:boolean;
  prioridad:"ALTA"|"MEDIA"|"BAJA";
  modulosDestino:string[];
  reglaAlerta?:string;
};

const studyLabels:Record<string,string>={
  topografia:"Levantamiento topográfico",mecanicaSuelos:"Mecánica de suelos",geotecnia:"Geotecnia especializada",
  hidrologia:"Estudio hidrológico",hidraulica:"Estudio hidráulico",impactoAmbiental:"Impacto ambiental",
  impactoUrbano:"Impacto urbano",transito:"Tránsito / movilidad",riesgo:"Estudio de riesgo",
  proteccionCivil:"Protección Civil",contaminacion:"Contaminación / remediación",infraestructura:"Estudios de infraestructura"
};
const disciplineLabels:Record<string,string>={
  arquitectura:"Arquitectura",estructura:"Estructura",hidrosanitaria:"Hidrosanitaria",electrica:"Eléctrica",gas:"Gas",
  pluvial:"Pluvial",telecom:"Telecomunicaciones",hvac:"HVAC",pci:"Protección contra incendio",
  urbanizacion:"Urbanización",paisajismo:"Paisajismo",especialidades:"Otras especialidades"
};
const permitLabels:Record<string,string>={
  usoSuelo:"Uso de suelo",fraccionamiento:"Autorización de fraccionamiento",licenciaConstruccion:"Licencia de construcción",
  numeroOficial:"Número oficial",alineamiento:"Alineamiento",agua:"Autorización / factibilidad de agua",
  energia:"Autorización / factibilidad eléctrica",ambiental:"Autorización ambiental",proteccionCivil:"Protección Civil",
  vialidades:"Vialidades",bomberos:"Bomberos",otros:"Otros permisos"
};
const serviceLabels:Record<string,string>={
  agua:"Agua potable",drenaje:"Drenaje sanitario",pluvial:"Drenaje pluvial",electricidad:"Electricidad",
  gas:"Gas",telecomunicaciones:"Telecomunicaciones",vialidades:"Vialidades / accesos",alumbrado:"Alumbrado público"
};
const packageLabels:Record<string,string>={
  preliminares:"Preliminares",terracerias:"Terracerías",urbanizacion:"Urbanización",cimentacion:"Cimentación",
  estructura:"Estructura",albanileria:"Albañilería",instalaciones:"Instalaciones",acabados:"Acabados",
  exteriores:"Obras exteriores",especialidades:"Especialidades"
};

function dateValue(v:unknown){const s=String(v??"").trim();return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:undefined;}
function mods(...v:string[]){return v;}
function add(arr:MasterActivityTemplate[],a:MasterActivityTemplate){if(!arr.some(x=>x.codigo===a.codigo))arr.push(a);}

export function buildMasterDocumentActivities(c:any,docCode:string):MasterActivityTemplate[]{
  const out:MasterActivityTemplate[]=[];
  const studies=asObj(c?.estudiosEspecializados);
  const services=asObj(c?.serviciosInfraestructura);
  const project=asObj(c?.proyectoEjecutivo);
  const permits=asObj(c?.autorizacionesConstruccion);
  const budget=asObj(c?.presupuestoBase);
  const schedule=asObj(c?.programaMaestro);
  const strategy=asObj(c?.estrategiaEjecucion);
  const packages=asObj(strategy.paquetes);
  const procurement=asObj(c?.contratacionSuministros);
  const prep=asObj(c?.preparacionObra);
  const tracking=asObj(c?.seguimientoOperativo);
  const special=asList(c?.obrasEspecialesSugeridas);
  const risks=[1,2,3,4,5,6,7,8,9,10].flatMap(n=>asList(c?.[`riesgosPaso${n}`]));
  const start=dateValue(schedule.fechaInicio);
  const finish=dateValue(schedule.fechaFin);

  if(docCode==="DM-02"){
    let i=1;
    for(const [key,label] of Object.entries(studyLabels)){
      const s=asObj(studies[key]);
      if(String(s.requerido??"")==="NO") continue;
      if(String(s.requerido??"")==="SI" || Object.keys(s).length>0){
        add(out,{codigo:`EF-${String(i++).padStart(3,"0")}`,actividad:label,tipo:"ESTUDIO",etapa:"Estudios y factibilidades",responsable:String(s.responsable??"")||undefined,fechaFinPlan:dateValue(s.fecha),entregable:`${label} terminado / aprobado`,periodicidad:"SEMANAL",bloqueante:true,prioridad:"ALTA",modulosDestino:mods("Programa","Documentación","Riesgos","Liberaciones"),reglaAlerta:"Alertar si la fecha objetivo vence sin aprobación"});
      }
    }
    for(const [key,label] of Object.entries(serviceLabels)){
      const s=asObj(services[key]); const estado=String(s.estado??"");
      if(estado && estado!=="NO_APLICA" && estado!=="EXISTE"){
        add(out,{codigo:`EF-${String(i++).padStart(3,"0")}`,actividad:`Obtener / validar factibilidad de ${label}`,tipo:"FACTIBILIDAD",etapa:"Servicios",responsable:String(s.responsable??"")||undefined,organismo:String(s.responsable??"")||undefined,entregable:`Factibilidad de ${label}`,periodicidad:"SEMANAL",bloqueante:true,prioridad:"ALTA",modulosDestino:mods("Programa","Documentación","Riesgos","Liberaciones")});
      }
    }
    if(!out.length) add(out,{codigo:"EF-001",actividad:"Confirmar matriz de estudios y factibilidades aplicables",tipo:"GESTION",etapa:"Estudios",entregable:"Matriz aprobada",periodicidad:"SEMANAL",bloqueante:true,prioridad:"ALTA",modulosDestino:mods("Programa","Documentación","Riesgos")});
  }

  if(docCode==="DM-03"){
    let i=1;
    for(const [key,label] of Object.entries(disciplineLabels)){
      const s=asObj(project[key]); const estado=String(s.estado??"");
      if(estado==="NO_APLICA") continue;
      if(Object.keys(s).length>0 || ["arquitectura","estructura","hidrosanitaria","electrica"].includes(key)){
        add(out,{codigo:`PE-${String(i++).padStart(3,"0")}`,actividad:`Desarrollar y liberar proyecto de ${label}`,tipo:"PROYECTO",etapa:"Proyecto ejecutivo",responsable:String(s.responsable??"")||undefined,fechaFinPlan:dateValue(s.fecha),entregable:`Proyecto de ${label} aprobado para construcción`,periodicidad:"SEMANAL",bloqueante:["arquitectura","estructura"].includes(key),prioridad:["arquitectura","estructura"].includes(key)?"ALTA":"MEDIA",modulosDestino:mods("Programa","Documentación","Calidad","Liberaciones")});
      }
    }
  }

  if(docCode==="DM-04"){
    let i=1;
    for(const [key,label] of Object.entries(permitLabels)){
      const s=asObj(permits[key]); const estado=String(s.estado??"");
      if(estado==="NO_APLICA") continue;
      if(Object.keys(s).length>0 || ["usoSuelo","licenciaConstruccion"].includes(key)){
        add(out,{codigo:`PA-${String(i++).padStart(3,"0")}`,actividad:`Gestionar ${label}`,tipo:"TRAMITE",etapa:"Permisos y autorizaciones",responsable:String(s.responsable??"")||undefined,fechaFinPlan:dateValue(s.fecha),entregable:`${label} aprobado / emitido`,periodicidad:"SEMANAL",bloqueante:["usoSuelo","fraccionamiento","licenciaConstruccion"].includes(key),prioridad:"ALTA",modulosDestino:mods("Programa","Documentación","Riesgos","Liberaciones"),reglaAlerta:"Alertar por observación, vencimiento o falta de autorización"});
      }
    }
  }

  if(docCode==="DM-05"){
    const defs=[
      ["PC-001","Integrar catálogo de conceptos","CATALOGO","Catálogo de conceptos base"],
      ["PC-002","Cerrar cuantificaciones / generadores","CUANTIFICACION","Generadores revisados"],
      ["PC-003","Integrar análisis de precios unitarios","APU","Tarjetas de precios unitarios"],
      ["PC-004","Integrar explosión de insumos","INSUMOS","Explosión de insumos"],
      ["PC-005","Calcular indirectos, financiamiento y utilidad","INDIRECTOS","Análisis de indirectos"],
      ["PC-006","Definir contingencia y reservas","CONTINGENCIA","Reserva / contingencia autorizada"],
      ["PC-007","Consolidar presupuesto base","PRESUPUESTO","Presupuesto base autorizado"],
      ["PC-008","Preparar flujo económico / curva de inversión","FLUJO","Flujo económico base"],
    ] as const;
    for(const [codigo,actividad,tipo,entregable] of defs) add(out,{codigo,actividad,tipo,etapa:"Presupuesto y costos",entregable,periodicidad:"SEMANAL",bloqueante:["PC-007"].includes(codigo),prioridad:"ALTA",modulosDestino:mods("Presupuesto","Costos","Flujo","Forecast")});
  }

  if(docCode==="DM-06"){
    const defs=[
      ["PG-001","Definir EDT / estructura de actividades","PLANEACION","EDT aprobada"],
      ["PG-002","Definir secuencia y dependencias","PLANEACION","Red lógica de actividades"],
      ["PG-003","Definir hitos contractuales y de liberación","HITOS","Matriz de hitos"],
      ["PG-004","Integrar programa por etapas y frentes","PROGRAMA","Programa maestro"],
      ["PG-005","Identificar ruta crítica","RUTA_CRITICA","Ruta crítica identificada"],
      ["PG-006","Integrar programa de suministros y contratación","SUMINISTROS","Programa de suministros / contratación"],
      ["PG-007","Aprobar línea base de plazo","LINEA_BASE","Línea base de programa aprobada"],
    ] as const;
    for(const [codigo,actividad,tipo,entregable] of defs) add(out,{codigo,actividad,tipo,etapa:"Programa maestro",fechaInicioPlan:start,fechaFinPlan:codigo==="PG-007"?finish:undefined,entregable,periodicidad:"SEMANAL",bloqueante:codigo==="PG-007",prioridad:"ALTA",modulosDestino:mods("Programa","Avance","Alertas","Reportes")});
  }

  if(docCode==="DM-07"){
    let i=1;
    for(const [key,label] of Object.entries(packageLabels)){
      const p=asObj(packages[key]); const modalidad=String(p.modalidad??"");
      if(!["SUBCONTRATO","MIXTO"].includes(modalidad)) continue;
      add(out,{codigo:`CT-${String(i++).padStart(3,"0")}`,actividad:`Contratar paquete: ${label}`,descripcion:`Modalidad: ${modalidad}. Tipo de contrato: ${String(p.contrato??"Por definir")}`,tipo:"CONTRATO",etapa:"Contratación",responsable:String(p.responsable??"")||undefined,entregable:`Contrato / orden formalizada de ${label}`,periodicidad:"SEMANAL",bloqueante:true,prioridad:"ALTA",modulosDestino:mods("Contratos","Estimaciones","Pagos","Riesgos")});
    }
  }

  if(docCode==="DM-08"){
    const defs=[
      ["CS-001","Aprobar programa de compras","COMPRAS","Programa de compras"],
      ["CS-002","Definir proveedores críticos","PROVEEDORES","Matriz de proveedores"],
      ["CS-003","Emitir requisiciones y órdenes de compra iniciales","ORDEN_COMPRA","Órdenes de compra"],
      ["CS-004","Definir estrategia de almacén e inventarios","ALMACEN","Procedimiento de almacén"],
      ["CS-005","Controlar recepción, consumo y existencias","INVENTARIO","Kardex / control de inventario"],
    ] as const;
    for(const [codigo,actividad,tipo,entregable] of defs) add(out,{codigo,actividad,tipo,etapa:"Compras y suministros",entregable,periodicidad:codigo==="CS-005"?"DIARIA":"SEMANAL",bloqueante:codigo==="CS-001",prioridad:"ALTA",modulosDestino:mods("Compras","Inventarios","Costos","Programa")});
  }

  if(docCode==="DM-09"){
    const defs=[
      ["MO-001","Definir estructura de cuadrillas","PLANEACION","Matriz de cuadrillas"],
      ["MO-002","Autorizar tabulador de mano de obra","COSTO","Tabulador autorizado"],
      ["MO-003","Integrar cargas sociales y provisiones laborales","COSTO","Factor de costo laboral"],
      ["MO-004","Registrar personal y horas trabajadas","CONTROL","Parte diario de personal"],
      ["MO-005","Medir rendimiento y productividad por cuadrilla","PRODUCTIVIDAD","Indicadores de rendimiento"],
      ["MO-006","Comparar costo real vs presupuesto de mano de obra","COSTO","Variación de costo laboral"],
    ] as const;
    for(const [codigo,actividad,tipo,entregable] of defs) add(out,{codigo,actividad,tipo,etapa:"Mano de obra",entregable,periodicidad:["MO-004","MO-005"].includes(codigo)?"DIARIA":"SEMANAL",bloqueante:false,prioridad:"MEDIA",modulosDestino:mods("Mano de obra","Costos","Productividad","Avance")});
  }

  if(docCode==="DM-10"){
    const defs=[
      ["ME-001","Integrar catálogo de maquinaria y equipo","CATALOGO","Catálogo de equipos"],
      ["ME-002","Definir condición: propia, rentada o de contratista","PLANEACION","Matriz de propiedad / renta"],
      ["ME-003","Registrar horas de operación y disponibilidad","CONTROL","Bitácora de horas"],
      ["ME-004","Registrar combustible y consumibles","COSTO","Control de combustible"],
      ["ME-005","Programar mantenimiento preventivo / correctivo","MANTENIMIENTO","Programa de mantenimiento"],
      ["ME-006","Medir rendimiento y costo horario real","PRODUCTIVIDAD","Indicadores de equipo"],
    ] as const;
    for(const [codigo,actividad,tipo,entregable] of defs) add(out,{codigo,actividad,tipo,etapa:"Maquinaria y equipo",entregable,periodicidad:["ME-003","ME-004"].includes(codigo)?"DIARIA":"SEMANAL",bloqueante:false,prioridad:"MEDIA",modulosDestino:mods("Maquinaria","Costos","Productividad","Avance")});
  }

  if(docCode==="DM-11"){
    const defs=[
      ["UR-001","Trazo y control topográfico de urbanización","TRAZO","Liberación topográfica"],
      ["UR-002","Terracerías y plataformas","OBRA","Frentes de terracerías liberados"],
      ["UR-003","Red de agua potable","OBRA","Red probada y liberada"],
      ["UR-004","Red de drenaje sanitario","OBRA","Red probada y liberada"],
      ["UR-005","Sistema pluvial","OBRA","Sistema pluvial liberado"],
      ["UR-006","Red eléctrica y alumbrado","OBRA","Red eléctrica / alumbrado liberados"],
      ["UR-007","Vialidades, guarniciones y banquetas","OBRA","Vialidades y obras exteriores liberadas"],
      ["UR-008","Pruebas, entregas y recepción de urbanización","CIERRE","Actas / liberaciones de urbanización"],
    ] as const;
    for(const [codigo,actividad,tipo,entregable] of defs) add(out,{codigo,actividad,tipo,etapa:"Urbanización",entregable,periodicidad:"DIARIA",bloqueante:false,prioridad:"MEDIA",modulosDestino:mods("Programa","Avance","Costos","Calidad")});
  }

  if(docCode==="DM-12"){
    let i=1;
    for(const [key,label] of Object.entries(serviceLabels)){
      const s=asObj(services[key]); const estado=String(s.estado??"");
      if(!estado||["NO_APLICA","EXISTE"].includes(estado)) continue;
      add(out,{codigo:`IN-${String(i++).padStart(3,"0")}`,actividad:`Resolver infraestructura de ${label}`,descripcion:`Condición detectada: ${estado}. ${String(s.observaciones??"")}`,tipo:"INFRAESTRUCTURA",etapa:"Infraestructura",responsable:String(s.responsable??"")||undefined,organismo:String(s.responsable??"")||undefined,entregable:`${label} disponible y liberado`,periodicidad:"SEMANAL",bloqueante:true,prioridad:"ALTA",modulosDestino:mods("Programa","Avance","Costos","Calidad","Riesgos")});
    }
  }

  if(docCode==="DM-13"){
    special.forEach((name,i)=>add(out,{codigo:`OE-${String(i+1).padStart(3,"0")}`,actividad:`Desarrollar y ejecutar: ${name}`,tipo:"OBRA_ESPECIAL",etapa:"Obras especiales",entregable:`${name} probado, liberado y documentado`,periodicidad:"SEMANAL",bloqueante:true,prioridad:"ALTA",modulosDestino:mods("Programa","Avance","Costos","Calidad","Riesgos")}));
  }

  if(docCode==="DM-14"){
    const defs=[
      ["ED-001","Trazo y preliminares","OBRA","Frente liberado"],
      ["ED-002","Cimentación","OBRA","Cimentación liberada"],
      ["ED-003","Estructura","OBRA","Estructura liberada"],
      ["ED-004","Albañilería y envolvente","OBRA","Envolvente liberada"],
      ["ED-005","Instalaciones","OBRA","Instalaciones probadas"],
      ["ED-006","Acabados","OBRA","Acabados liberados"],
      ["ED-007","Equipamiento y especialidades","OBRA","Equipamiento probado"],
      ["ED-008","Pruebas, punch list y preentrega","CIERRE","Preentrega liberada"],
    ] as const;
    for(const [codigo,actividad,tipo,entregable] of defs) add(out,{codigo,actividad,tipo,etapa:"Edificación",entregable,periodicidad:"DIARIA",bloqueante:false,prioridad:"MEDIA",modulosDestino:mods("Programa","Avance","Costos","Productividad","Calidad")});
  }

  if(docCode==="DM-15"){
    const defs=[
      ["CA-001","Aprobar plan de calidad e inspección","PLAN","Plan de calidad"],
      ["CA-002","Definir puntos de inspección y liberación","ITP","Matriz ITP"],
      ["CA-003","Programar y registrar pruebas de laboratorio / campo","PRUEBA","Resultados de pruebas"],
      ["CA-004","Registrar inspecciones y liberaciones","INSPECCION","Liberaciones de calidad"],
      ["CA-005","Registrar no conformidades","NCR","Registro NCR"],
      ["CA-006","Cerrar acciones correctivas","CORRECTIVA","NCR cerradas"],
    ] as const;
    for(const [codigo,actividad,tipo,entregable] of defs) add(out,{codigo,actividad,tipo,etapa:"Calidad",entregable,periodicidad:"POR_EVENTO",bloqueante:codigo==="CA-001",prioridad:"ALTA",modulosDestino:mods("Calidad","Liberaciones","Reportes")});
  }

  if(docCode==="DM-16"){
    const defs=[
      ["SG-001","Aprobar plan de seguridad","PLAN","Plan de seguridad"],
      ["SG-002","Inducción y control de ingreso","INDUCCION","Registros de inducción"],
      ["SG-003","Inspecciones y recorridos de seguridad","INSPECCION","Reportes de recorrido"],
      ["SG-004","Registrar incidentes y condiciones inseguras","INCIDENTE","Registro de incidentes"],
      ["SG-005","Dar seguimiento a acciones correctivas","CORRECTIVA","Acciones cerradas"],
    ] as const;
    for(const [codigo,actividad,tipo,entregable] of defs) add(out,{codigo,actividad,tipo,etapa:"Seguridad",entregable,periodicidad:codigo==="SG-003"?"DIARIA":"POR_EVENTO",bloqueante:codigo==="SG-001",prioridad:"ALTA",modulosDestino:mods("Seguridad","Alertas","Reportes")});
  }

  if(docCode==="DM-17"){
    const unique=[...new Set(risks.filter(Boolean))].slice(0,30);
    unique.forEach((risk,i)=>add(out,{codigo:`RR-${String(i+1).padStart(3,"0")}`,actividad:`Gestionar riesgo / restricción: ${risk}`,tipo:"RIESGO",etapa:"Riesgos y restricciones",entregable:"Respuesta y condición de cierre",periodicidad:"SEMANAL",bloqueante:false,prioridad:"ALTA",modulosDestino:mods("Riesgos","Restricciones","Alertas","Reportes"),reglaAlerta:"Alertar si no existe responsable, respuesta o fecha compromiso"}));
    add(out,{codigo:"RR-900",actividad:"Revisión semanal integral de riesgos y restricciones",tipo:"REVISION",etapa:"Riesgos y restricciones",entregable:"Registro semanal actualizado",periodicidad:"SEMANAL",bloqueante:false,prioridad:"ALTA",modulosDestino:mods("Riesgos","Restricciones","Alertas","Reportes")});
  }

  if(docCode==="DM-18"){
    const defs=[
      ["CB-001","Registrar solicitud de cambio","SOLICITUD","Solicitud documentada"],
      ["CB-002","Evaluar impacto en alcance, costo y plazo","EVALUACION","Evaluación de impacto"],
      ["CB-003","Obtener autorización / rechazo","AUTORIZACION","Resolución del cambio"],
      ["CB-004","Actualizar presupuesto, programa y contratos autorizados","IMPLEMENTACION","Registros actualizados"],
      ["CB-005","Cerrar cambio y documentar nueva condición base","CIERRE","Cambio cerrado"],
    ] as const;
    for(const [codigo,actividad,tipo,entregable] of defs) add(out,{codigo,actividad,tipo,etapa:"Cambios y extraordinarios",entregable,periodicidad:"POR_EVENTO",bloqueante:false,prioridad:"ALTA",modulosDestino:mods("Cambios","Presupuesto","Programa","Forecast")});
  }

  if(docCode==="DM-19"){
    const defs=[
      ["EP-001","Validar avance contractual para estimación","AVANCE","Avance conciliado"],
      ["EP-002","Integrar generadores y soporte de estimación","GENERADORES","Generadores firmados"],
      ["EP-003","Revisar amortizaciones, retenciones y descuentos","REVISION","Carátula revisada"],
      ["EP-004","Autorizar estimación","AUTORIZACION","Estimación autorizada"],
      ["EP-005","Registrar pago y saldo contractual","PAGO","Pago y saldo actualizado"],
    ] as const;
    for(const [codigo,actividad,tipo,entregable] of defs) add(out,{codigo,actividad,tipo,etapa:"Estimaciones y pagos",entregable,periodicidad:"POR_ESTIMACION",bloqueante:false,prioridad:"ALTA",modulosDestino:mods("Estimaciones","Pagos","Costos","Contratos")});
  }

  if(docCode==="DM-20"){
    const defs=[
      ["CI-001","Integrar punch list / pendientes de entrega","PREENTREGA","Punch list"],
      ["CI-002","Cerrar pendientes y pruebas finales","CIERRE_TECNICO","Liberaciones finales"],
      ["CI-003","Integrar planos as-built, manuales y garantías","DOCUMENTACION","Expediente as-built"],
      ["CI-004","Cerrar contratos, estimaciones y finiquitos","CIERRE_CONTRACTUAL","Finiquitos"],
      ["CI-005","Cerrar costos y conciliación financiera","CIERRE_FINANCIERO","Cierre financiero"],
      ["CI-006","Entrega formal al cliente / operación","ENTREGA","Acta de entrega"],
      ["CI-007","Lecciones aprendidas y cierre administrativo","CIERRE","Informe de cierre"],
    ] as const;
    for(const [codigo,actividad,tipo,entregable] of defs) add(out,{codigo,actividad,tipo,etapa:"Entrega y cierre",entregable,periodicidad:"POR_EVENTO",bloqueante:["CI-002","CI-006"].includes(codigo),prioridad:"ALTA",modulosDestino:mods("Entrega","Cierre","Documentación","Reportes")});
  }

  // Ajustes desde la matriz de seguimiento: si el usuario definió frecuencia/responsable, prevalece.
  for(const a of out){
    const key=Object.entries(tracking).find(([,v])=>{
      const o=asObj(v); const modulo=String(o.moduloDestino??"").toLowerCase();
      return modulo && a.modulosDestino.some(m=>m.toLowerCase()===modulo);
    });
    if(key){
      const o=asObj(key[1]);
      if(o.frecuencia) a.periodicidad=String(o.frecuencia);
      if(o.responsable&&!a.responsable) a.responsable=String(o.responsable);
      if(o.alerta&&!a.reglaAlerta) a.reglaAlerta=String(o.alerta);
    }
  }

  // Preparación de obra alimenta seguridad/compras cuando fue configurada.
  if(docCode==="DM-08" && prep.almacenDefinido===true) out.find(x=>x.codigo==="CS-004")!.descripcion="Almacén definido desde Constructibilidad.";
  if(docCode==="DM-16" && prep.planSeguridad===true) out.find(x=>x.codigo==="SG-001")!.descripcion="Plan de seguridad marcado como disponible en Constructibilidad.";

  return out;
}
