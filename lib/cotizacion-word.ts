type DatosCotizacionWord = {
  folio: string;
  fecha: string;
  vigenciaDias: number;
  cliente: string;
  telefono: string;
  correo: string;
  tipoCliente: string;
  direccion: string;
  ciudad: string;
  terrenoM2: string;
  construccionM2: string;
  niveles: string;
  recamaras: string;
  banos: string;
  espacios: string[];
  otrosEspacios: string;
  comentarios: string;
  total: number;
  pago50: number;
};

function esc(valor: string | number | undefined | null) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function dinero(valor: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(valor);
}

function textoBanos(valor: string) {
  const n = Number(String(valor).replace(",", "."));
  if (!Number.isFinite(n)) return valor;
  const completos = Math.floor(n);
  const medios = n - completos >= 0.5 ? 1 : 0;
  const partes: string[] = [];
  if (completos > 0) partes.push(`${completos} baño${completos === 1 ? "" : "s"} completo${completos === 1 ? "" : "s"}`);
  if (medios > 0) partes.push("1 medio baño");
  return partes.length ? partes.join(" + ") : "No indicado";
}

function encabezado(data: DatosCotizacionWord, n: number) {
  return `
<div class="MsoHeader" id="h${n}">
  <table class="headerBand">
    <tr>
      <td class="logoCell"><img class="logo" src="https://certezahabitacional.com/branding/logo-autorizado.png" alt="Certeza Habitacional"></td>
      <td class="brandCell">
        <div class="brandTitle">CERTEZA HABITACIONAL</div>
        <div class="brandSub">Inspección técnica de viviendas</div>
        <div class="brandTag">Revisamos cada rincón antes de que des el sí</div>
      </td>
      <td class="quoteCell">
        <div class="quoteTitle">COTIZACIÓN DE SERVICIOS</div>
        <div>Folio: ${esc(data.folio)}</div>
        <div>Fecha: ${esc(data.fecha)}</div>
        <div>Vigencia: ${esc(data.vigenciaDias)} días</div>
        <div>Responsable: Área de Cotizaciones</div>
      </td>
    </tr>
  </table>
</div>`;
}

function pie(n: number) {
  return `
<div class="MsoFooter" id="f${n}">
  <table class="footerBand">
    <tr>
      <td class="footerCode">CH-F-002</td>
      <td class="footerText">contacto@certezahabitacional.com &nbsp; | &nbsp; 656 287 12 18 &nbsp; | &nbsp; Monte Apeninos 6436, Col. La Cuesta, Ciudad Juárez, Chihuahua</td>
      <td class="footerPage">Pág. ${n} / 6</td>
    </tr>
  </table>
</div>`;
}

function seccionPagina(n: number, contenido: string) {
  return `<div class="Section${n}">${contenido}</div>`;
}

export function crearCotizacionWordEditable(data: DatosCotizacionWord) {
  const areasDeclaradas = data.espacios.length
    ? data.espacios.map((espacio) => esc(espacio)).join(" · ")
    : "No se declararon áreas adicionales.";

  const otros = data.otrosEspacios.trim()
    ? esc(data.otrosEspacios)
    : "No se declararon otros espacios o características.";

  const comentarios = data.comentarios.trim()
    ? esc(data.comentarios)
    : "Sin comentarios adicionales.";

  const distribucion = `${esc(data.niveles)} niveles · ${esc(data.recamaras)} recámaras · ${esc(textoBanos(data.banos))}`;

  const cssPages = [1, 2, 3, 4, 5, 6]
    .map(
      (n) => `@page Section${n} { size: 612pt 792pt; margin: 42.52pt 42.52pt 42.52pt 42.52pt; mso-header-margin: 0pt; mso-footer-margin: 0pt; mso-header: h${n}; mso-footer: f${n}; } div.Section${n} { page: Section${n}; ${n < 6 ? "page-break-after: always;" : ""} }`,
    )
    .join("\n");

  const headers = [1, 2, 3, 4, 5, 6].map((n) => encabezado(data, n)).join("\n");
  const footers = [1, 2, 3, 4, 5, 6].map((n) => pie(n)).join("\n");

  const pagina1 = `
<h1>Propuesta de inspección técnica de vivienda</h1>
<table class="meta firstMeta">
  <tr><td class="label">Folio</td><td>${esc(data.folio)}</td><td class="label">Fecha de emisión</td><td>${esc(data.fecha)}</td></tr>
  <tr><td class="label">Vigencia</td><td>${esc(data.vigenciaDias)} días</td><td class="label">Responsable</td><td>Área de Cotizaciones</td></tr>
</table>

<h2>1. DATOS DEL CLIENTE E INMUEBLE</h2>
<table class="meta">
  <tr><td class="label">Cliente</td><td>${esc(data.cliente)}</td><td class="label">Teléfono</td><td>${esc(data.telefono)}</td></tr>
  <tr><td class="label">Correo</td><td>${esc(data.correo)}</td><td class="label">Tipo de cliente</td><td>${esc(data.tipoCliente)}</td></tr>
  <tr><td class="label">Inmueble</td><td>${esc(data.direccion)}</td><td class="label">Ciudad</td><td>${esc(data.ciudad)}</td></tr>
  <tr><td class="label">Superficies</td><td>Terreno: ${esc(data.terrenoM2)} m² · Construcción: ${esc(data.construccionM2)} m²</td><td class="label">Niveles / distribución</td><td>${distribucion}</td></tr>
</table>

<h2>2. ÁREAS Y CARACTERÍSTICAS DECLARADAS POR EL CLIENTE</h2>
<p>La información de esta sección reproduce los datos proporcionados por el cliente en su solicitud. Se conserva como antecedente de la cotización y no puede modificarse desde este documento.</p>
<table class="meta sourceTable">
  <tr><td class="label wideLabel">Áreas declaradas</td><td>${areasDeclaradas}</td></tr>
  <tr><td class="label wideLabel">Otros espacios / características</td><td>${otros}</td></tr>
  <tr><td class="label wideLabel">Comentarios del cliente</td><td>${comentarios}</td></tr>
  <tr><td class="label wideLabel">Fuente del dato</td><td>Solicitud enviada desde certezahabitacional.com/cotizar · ${esc(data.fecha)}</td></tr>
</table>`;

  const pagina2 = `
<h2 class="pageTop">3. QUÉ INCLUYE LA INSPECCIÓN</h2>
<p>La inspección cubre las áreas declaradas por el cliente que existan en el inmueble y se encuentren accesibles y seguras al momento de la visita. La cobertura siguiente describe las actividades estándar de revisión; no depende del equipo instrumental seleccionado y no modifica el precio de la propuesta.</p>
<table class="sectionTable twoCols">
  <tr><th>Área / sistema</th><th>Actividades incluidas</th></tr>
  <tr><td class="area">Condición general y acabados</td><td>Muros, plafones y pisos; fisuras, manchas, humedad aparente, desprendimientos, deformaciones, deterioro, sellos y terminaciones visibles; puertas, ventanas, herrajes y elementos accesibles.</td></tr>
  <tr><td class="area">Elementos estructurales visibles</td><td>Losas, trabes, columnas, muros y escaleras visibles; indicios de agrietamiento, deformación, asentamiento, corrosión o deterioro que ameriten atención. No incluye cálculo ni dictamen estructural especializado.</td></tr>
  <tr><td class="area">Azotea, cubiertas y exteriores</td><td>Impermeabilización y recubrimientos visibles; pendientes, bajadas y desagües; pretiles, encuentros, penetraciones, sellos, fisuras, deterioro y señales de ingreso de agua, cuando exista acceso seguro.</td></tr>
  <tr><td class="area">Instalación eléctrica</td><td>Tablero y protecciones accesibles, conductores visibles, contactos, apagadores y puntos eléctricos; condición aparente, fijación, polaridad/tierra y protecciones cuando sean verificables; indicios de calentamiento o conexiones inseguras. Mediciones instrumentales solo cuando estén incluidas.</td></tr>
  <tr><td class="area">Instalación hidráulica</td><td>Tuberías y conexiones visibles, llaves, mezcladoras, muebles y puntos de consumo; funcionamiento, flujo, fugas o goteos aparentes, válvulas accesibles y conexiones de equipos hidráulicos presentes. Incluye prueba de hermeticidad hidráulica cuando las condiciones del inmueble permitan realizarla de forma segura.</td></tr>
  <tr><td class="area">Instalación sanitaria</td><td>Inodoros, lavabos, regaderas, fregaderos, lavaderos, coladeras, trampas y desagües accesibles; funcionamiento aparente del drenaje, fugas, retornos, olores, sellos y signos visibles de obstrucción o deterioro.</td></tr>
  <tr><td class="area">Instalación de gas</td><td>Tuberías, válvulas, conectores y conexiones visibles de equipos; condición aparente, sujeción, ventilación y señales de riesgo. Incluye detección instrumental de gas y prueba de hermeticidad cuando las condiciones de la instalación permitan realizarla de forma segura.</td></tr>
</table>`;

  const pagina3 = `
<table class="sectionTable twoCols pageTopTable">
  <tr><th>Área / sistema</th><th>Actividades incluidas</th></tr>
  <tr><td class="area">Cocina</td><td>Cubiertas, gabinetes y acabados visibles; fregadero, llaves y drenaje; puntos hidráulicos, sanitarios, eléctricos y de gas presentes; conexiones visibles de equipos fijos y señales de humedad, deterioro o instalación deficiente.</td></tr>
  <tr><td class="area">Baños y medios baños</td><td>Muebles sanitarios, llaves, regaderas, drenajes, sellos y juntas; funcionamiento aparente, humedad, ventilación, acabados y puntos eléctricos próximos a zonas húmedas.</td></tr>
  <tr><td class="area">Lavandería y lavaderos</td><td>Alimentaciones y descargas visibles, lavadero, conexiones para lavadora/secadora, puntos eléctricos o de gas presentes, ventilación y señales de fuga, humedad o deterioro.</td></tr>
  <tr><td class="area">Recámaras, sala, comedor y estancia</td><td>Pisos, muros, plafones, puertas, ventanas y acabados; puntos eléctricos accesibles; funcionamiento visible de herrajes y señales de fisuras, humedad, deformación o deterioro.</td></tr>
  <tr><td class="area">Escaleras, terrazas y balcones</td><td>Peldaños, descansos, barandales y pasamanos; estabilidad visible, fijaciones, superficies, pendientes, drenajes y condiciones que puedan representar riesgo de caída o filtración.</td></tr>
  <tr><td class="area">Patio, cochera, jardín, bodega y áreas auxiliares</td><td>Superficies, pendientes y drenajes visibles; muros, cubiertas o plafones existentes; fisuras, humedad, deterioro y puntos eléctricos, hidráulicos o de gas presentes y accesibles.</td></tr>
  <tr><td class="area">Climatización y equipos fijos presentes</td><td>Condición visible, fijación, alimentación y drenaje de condensados de equipos accesibles; operación básica cuando sea segura y procedente. Mediciones de temperatura, flujo o carga solo si el servicio instrumental correspondiente está incluido.</td></tr>
</table>
<p class="afterTable">La inspección documentará también las áreas o componentes que no puedan revisarse por falta de acceso, condiciones inseguras, ausencia de servicios o restricciones existentes el día de la visita.</p>`;

  const pagina4 = `
<h2 class="pageTop">4. SERVICIOS Y VERIFICACIONES INSTRUMENTALES INCLUIDOS</h2>
<p>Los siguientes servicios instrumentales están incluidos en esta propuesta. Complementan la inspección estándar, no generan un cargo individual adicional y se aplicarán cuando correspondan a las condiciones del inmueble, exista acceso seguro y el equipo se encuentre operativo.</p>
<table class="sectionTable instruments">
  <tr><th class="incl">Incl.</th><th class="service">Servicio / equipo</th><th>Aplicación durante la inspección</th></tr>
  <tr><td class="tick">✓</td><td class="serviceName">Cámara térmica</td><td>Humedad aparente, anomalías térmicas, aislamiento, posibles fugas y calentamientos eléctricos.</td></tr>
  <tr><td class="tick">✓</td><td class="serviceName">Probador de contactos GFCI/RCD</td><td>Polaridad, tierra, conexiones incorrectas y funcionamiento de protección.</td></tr>
  <tr><td class="tick">✓</td><td class="serviceName">Detector de voltaje sin contacto</td><td>Presencia de tensión eléctrica.</td></tr>
  <tr><td class="tick">✓</td><td class="serviceName">Multímetro profesional</td><td>Voltaje, continuidad y verificaciones eléctricas específicas.</td></tr>
  <tr><td class="tick">✓</td><td class="serviceName">Nivel láser autonivelante</td><td>Desniveles y desviaciones importantes.</td></tr>
  <tr><td class="tick">✓</td><td class="serviceName">Medidor láser de distancia</td><td>Dimensiones y comprobaciones rápidas.</td></tr>
  <tr><td class="tick">✓</td><td class="serviceName">Martillo / rodillo de auscultación</td><td>Losetas con indicios de huecos o desprendimiento.</td></tr>
  <tr><td class="tick">✓</td><td class="serviceName">Linterna LED profesional</td><td>Inspección visual detallada.</td></tr>
  <tr><td class="tick">✓</td><td class="serviceName">Manómetro para agua</td><td>Presión de suministro hidráulico.</td></tr>
  <tr><td class="tick">✓</td><td class="serviceName">Detector de gas combustible</td><td>Indicios de fugas en instalaciones de gas.</td></tr>
  <tr><td class="tick">✓</td><td class="serviceName">Prueba de hermeticidad hidráulica</td><td>Verificación de pérdida de presión cuando el sistema y las condiciones de seguridad lo permitan.</td></tr>
  <tr><td class="tick">✓</td><td class="serviceName">Prueba de hermeticidad de gas</td><td>Verificación de estanqueidad cuando la instalación y las condiciones de seguridad lo permitan.</td></tr>
</table>`;

  const pagina5 = `
<h2 class="pageTop">5. QUÉ RECIBIRÁ EL CLIENTE</h2>
<table class="sectionTable deliverables">
  <tr><th>Entregable</th><th>Qué contiene</th></tr>
  <tr><td class="area">Reporte técnico digital en PDF</td><td>Documento formal de Certeza Habitacional con identificación del inmueble, fecha de inspección, alcance ejecutado y condiciones relevantes de la visita.</td></tr>
  <tr><td class="area">Resumen ejecutivo</td><td>Síntesis del estado general del inmueble y de los aspectos que requieren mayor atención para facilitar la toma de decisiones.</td></tr>
  <tr><td class="area">Cobertura por áreas y sistemas</td><td>Registro de las áreas declaradas que fueron inspeccionadas y de los sistemas revisados dentro de ellas, así como las limitaciones de acceso que hubieran existido.</td></tr>
  <tr><td class="area">Hallazgos clasificados</td><td>Cada condición relevante se presenta con la clasificación del Método Certeza®: Conforme, Observación, No Conforme o Condición Crítica, según corresponda.</td></tr>
  <tr><td class="area">Evidencia fotográfica</td><td>Fotografías de soporte vinculadas con los hallazgos y su ubicación para facilitar la comprensión de lo observado.</td></tr>
  <tr><td class="area">Descripción y prioridad de atención</td><td>Explicación clara de la condición encontrada, su importancia y una orientación de prioridad o siguiente acción cuando resulte pertinente.</td></tr>
  <tr><td class="area">Resultados instrumentales aplicables</td><td>Cuando se hayan incluido y utilizado servicios instrumentales, el reporte incorporará los resultados relevantes obtenidos como apoyo de la inspección.</td></tr>
  <tr><td class="area">Registro de limitaciones</td><td>Se indicarán los componentes o áreas que no pudieron inspeccionarse y la causa: falta de acceso, condición insegura, ausencia de servicios, obstrucción u otra restricción.</td></tr>
</table>
<p class="afterTable">El valor del servicio no se limita a la entrega de un documento: el reporte es la evidencia organizada de la inspección realizada y permite identificar qué se revisó, qué se encontró y qué condiciones merecen atención.</p>

<h2>6. LIMITACIONES Y CONDICIONES ESPECÍFICAS</h2>
<table class="meta sourceTable">
  <tr><td>• La inspección se realizará únicamente en áreas visibles, accesibles y seguras, sin desmontajes, demoliciones ni pruebas destructivas.</td></tr>
  <tr><td>• Las verificaciones funcionales e instrumentales se realizarán cuando existan condiciones seguras, servicios activos y acceso suficiente al componente a revisar.</td></tr>
  <tr><td><strong>Criterio de disponibilidad operativa</strong><br>Los servicios seleccionados forman parte del alcance ofrecido sin generar un cargo individual adicional. Su ejecución está sujeta a que sean aplicables a las condiciones del inmueble, exista acceso seguro y el equipo requerido se encuentre operativo. Si después de emitida la cotización surgiera una indisponibilidad imprevista, Certeza Habitacional informará al cliente antes de iniciar y acordará cualquier ajuste de alcance que resulte necesario.</td></tr>
</table>`;

  const pagina6 = `
<h2 class="pageTop">7. INVERSIÓN</h2>
<table class="investment">
  <tr><td>Honorarios de inspección</td><td>${dinero(data.total)} MXN</td></tr>
  <tr class="totalRow"><td>TOTAL DE LA COTIZACIÓN</td><td>${dinero(data.total)} MXN</td></tr>
</table>
<p><strong>Nota de facturación:</strong> En caso de requerir factura, al importe anterior se adicionará el IVA correspondiente.</p>

<h2>8. CONDICIONES COMERCIALES</h2>
<p>La forma de pago se define al emitir la cotización y únicamente puede corresponder a una de las dos modalidades indicadas a continuación.</p>
<table class="commercial">
  <tr><td class="label">Vigencia</td><td>La presente propuesta tendrá una vigencia de ${esc(data.vigenciaDias)} días naturales a partir de su fecha de emisión.</td></tr>
  <tr><td class="label">Forma de pago</td><td>Al contratar, el cliente podrá seleccionar una de las dos modalidades disponibles:<br>☐ &nbsp;<strong>PAGO ÚNICO</strong>&nbsp;&nbsp; ${dinero(data.total)} MXN al contratar la inspección.<br>☐ &nbsp;<strong>DOS PAGOS 50/50</strong>&nbsp;&nbsp; ${dinero(data.pago50)} MXN al contratar la inspección y ${dinero(data.pago50)} MXN antes de iniciar la inspección en el inmueble.</td></tr>
  <tr><td class="label">Condición de pago</td><td>La contratación y programación quedan confirmadas con el pago requerido por la modalidad seleccionada. En la modalidad 50/50, el segundo pago deberá estar cubierto antes de que el inspector inicie la inspección. No se contemplan otras modalidades de pago dentro de esta cotización, salvo autorización expresa por escrito de Certeza Habitacional.</td></tr>
  <tr><td class="label">Facturación</td><td>El importe indicado en esta propuesta no incluye IVA. En caso de requerir factura, se adicionará el IVA correspondiente al importe del servicio.</td></tr>
</table>

<h2>9. ACEPTACIÓN DE LA PROPUESTA</h2>
<p>Para aceptar esta propuesta, responde al correo de envío indicando “ACEPTO”, la modalidad de pago elegida (pago único o 50/50) y un teléfono de contacto. La aceptación confirma la conformidad con los alcances, limitaciones, precio y condiciones descritos.</p>`;

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<meta name="ProgId" content="Word.Document">
<meta name="Generator" content="Certeza Habitacional CH-F-002">
<title>Cotización ${esc(data.folio)}</title>
<style>
${cssPages}
div.MsoHeader { mso-element: header; }
div.MsoFooter { mso-element: footer; }
body { font-family: Cambria, Georgia, "Times New Roman", serif; color:#20252a; font-size:10.4pt; line-height:1.25; }
table { border-collapse:collapse; width:100%; }
.headerBand { background:#071a2a; color:#ffffff; width:100%; }
.headerBand td { padding:7pt 8pt; vertical-align:middle; }
.logoCell { width:68pt; text-align:center; }
.logo { width:58pt; height:58pt; object-fit:contain; }
.brandCell { text-align:left; }
.brandTitle { font-size:16pt; font-weight:700; letter-spacing:.2pt; }
.brandSub { color:#d9a72e; font-size:9.5pt; font-weight:700; margin-top:3pt; }
.brandTag { font-size:8.5pt; margin-top:2pt; }
.quoteCell { width:198pt; text-align:right; font-size:8.5pt; line-height:1.22; }
.quoteTitle { color:#d9a72e; font-size:12pt; font-weight:800; margin-bottom:2pt; }
.footerBand { background:#071a2a; color:#ffffff; width:100%; font-size:7.3pt; }
.footerBand td { padding:5pt 5pt; vertical-align:middle; }
.footerCode { width:50pt; font-weight:700; text-align:left; }
.footerText { text-align:center; }
.footerPage { width:48pt; text-align:right; white-space:nowrap; }
h1 { font-size:14.5pt; color:#d9a72e; margin:0 0 10pt; font-weight:700; }
h2 { font-size:12.2pt; color:#20252a; margin:11pt 0 6pt; font-weight:800; }
h2.pageTop { margin-top:0; }
p { margin:0 0 6pt; }
.meta td, .commercial td { border:1px solid #c4cbd2; padding:5pt 6pt; vertical-align:middle; }
.meta .label, .commercial .label { font-weight:700; }
.meta .label { width:15%; }
.meta td:nth-child(2), .meta td:nth-child(4) { width:35%; }
.firstMeta { margin-bottom:8pt; }
.sourceTable .wideLabel { width:23%; }
.sectionTable th { background:#d9a72e; color:#20252a; text-align:left; padding:5pt 6pt; border:1px solid #8d742f; font-weight:800; }
.sectionTable td { padding:5pt 6pt; border:1px solid #c4cbd2; vertical-align:middle; }
.sectionTable .area { width:28%; font-weight:700; }
.twoCols .area { width:50%; }
.pageTopTable { margin-top:0; }
.afterTable { margin-top:6pt; }
.instruments { font-size:9.3pt; }
.instruments td { padding:4pt 5pt; }
.instruments .incl { width:7%; }
.instruments .service { width:31%; }
.tick { width:7%; text-align:center; font-family:Arial, sans-serif; font-weight:700; }
.serviceName { font-weight:700; }
.deliverables { font-size:9.4pt; }
.deliverables td { padding:4pt 5pt; }
.deliverables .area { width:28%; }
.investment td { border:1px solid #c4cbd2; padding:8pt 7pt; font-size:11pt; }
.investment td:last-child { width:30%; font-weight:700; }
.totalRow td { background:#d9a72e; border-color:#8d742f; font-weight:800; font-size:12pt; }
.commercial { margin-top:5pt; }
.commercial .label { width:19%; }
.commercial td { padding:6pt 7pt; }
</style>
</head>
<body>
${headers}
${footers}
${seccionPagina(1, pagina1)}
${seccionPagina(2, pagina2)}
${seccionPagina(3, pagina3)}
${seccionPagina(4, pagina4)}
${seccionPagina(5, pagina5)}
${seccionPagina(6, pagina6)}
</body>
</html>`;
}
