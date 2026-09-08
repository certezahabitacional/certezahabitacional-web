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

export function crearCotizacionWordEditable(data: DatosCotizacionWord) {
  const espacios = data.espacios.length
    ? data.espacios.map((espacio) => esc(espacio)).join(" · ")
    : "No se declararon espacios adicionales.";

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<meta name="ProgId" content="Word.Document">
<meta name="Generator" content="Certeza Habitacional">
<title>Cotización ${esc(data.folio)}</title>
<style>
@page Section1 {
  size: 612pt 792pt;
  margin: 42.5pt 42.5pt 50pt 42.5pt;
  mso-header-margin: 0pt;
  mso-footer-margin: 0pt;
  mso-header: h1;
  mso-footer: f1;
}
div.Section1 { page: Section1; }
div.MsoHeader { mso-element: header; }
div.MsoFooter { mso-element: footer; }
body { font-family: Aptos, Arial, sans-serif; color:#14202c; font-size:10.5pt; line-height:1.35; }
table { border-collapse: collapse; width:100%; }
.headerBand { background:#071a2a; color:white; width:100%; }
.headerBand td { padding:9pt 10pt; vertical-align:middle; }
.logo { width:55pt; height:55pt; object-fit:contain; }
.brandTitle { font-size:15.5pt; font-weight:700; letter-spacing:.2pt; }
.gold { color:#d9a72e; }
.small { font-size:8.5pt; }
.footerBand { background:#071a2a; color:#fff; width:100%; font-size:8pt; }
.footerBand td { padding:6pt 8pt; vertical-align:middle; }
h1 { font-size:15pt; color:#071a2a; margin:0 0 8pt; }
h2 { font-size:11.5pt; color:#071a2a; margin:14pt 0 6pt; border-bottom:1.5pt solid #d9a72e; padding-bottom:3pt; }
p { margin:0 0 6pt; }
.meta td { border:1px solid #c8d0d8; padding:5pt 6pt; }
.meta td.label { font-weight:700; width:19%; background:#f6f7f8; }
.sectionTable th { background:#d9a72e; color:#101828; text-align:left; padding:5pt 6pt; border:1px solid #c99b25; }
.sectionTable td { padding:5pt 6pt; border:1px solid #c8d0d8; vertical-align:top; }
.sectionTable td.area { width:30%; font-weight:700; }
.note { background:#f5f6f8; border-left:4pt solid #d9a72e; padding:7pt 8pt; margin:7pt 0; }
.totalBox { border:1.5pt solid #d9a72e; padding:9pt 10pt; margin:8pt 0; }
.total { font-size:16pt; font-weight:800; color:#071a2a; }
.check { font-family:"Segoe UI Symbol", Arial, sans-serif; }
.pageBreak { page-break-before:always; }
</style>
</head>
<body>
<div class="MsoHeader" id="h1">
  <table class="headerBand">
    <tr>
      <td style="width:70pt;text-align:center;">
        <img class="logo" src="https://certezahabitacional.com/branding/logo-autorizado.png" alt="Certeza Habitacional">
      </td>
      <td>
        <div class="brandTitle">CERTEZA HABITACIONAL</div>
        <div class="gold" style="font-weight:700;">Inspección técnica de viviendas</div>
        <div class="small">Revisamos cada rincón antes de que des el sí</div>
      </td>
      <td style="width:190pt;text-align:right;">
        <div class="gold" style="font-weight:800;font-size:12pt;">COTIZACIÓN DE SERVICIOS</div>
        <div class="small">Folio: ${esc(data.folio)}</div>
        <div class="small">Fecha: ${esc(data.fecha)}</div>
        <div class="small">Vigencia: ${esc(data.vigenciaDias)} días</div>
      </td>
    </tr>
  </table>
</div>

<div class="MsoFooter" id="f1">
  <table class="footerBand">
    <tr>
      <td style="text-align:center;">contacto@certezahabitacional.com &nbsp; | &nbsp; 656 287 12 18 &nbsp; | &nbsp; Monte Apeninos 6436, Col. La Cuesta, Ciudad Juárez, Chihuahua</td>
      <td style="width:42pt;text-align:right;">Pág. <span style='mso-field-code:" PAGE "'></span></td>
    </tr>
  </table>
</div>

<div class="Section1">
  <h1>Propuesta de inspección técnica de vivienda</h1>

  <table class="meta">
    <tr><td class="label">Cliente</td><td>${esc(data.cliente)}</td><td class="label">Teléfono</td><td>${esc(data.telefono)}</td></tr>
    <tr><td class="label">Correo</td><td>${esc(data.correo)}</td><td class="label">Tipo de cliente</td><td>${esc(data.tipoCliente)}</td></tr>
    <tr><td class="label">Inmueble</td><td colspan="3">${esc(data.direccion)}</td></tr>
    <tr><td class="label">Ciudad</td><td>${esc(data.ciudad)}</td><td class="label">Construcción</td><td>${esc(data.construccionM2)} m²</td></tr>
    <tr><td class="label">Terreno</td><td>${esc(data.terrenoM2)} m²</td><td class="label">Niveles</td><td>${esc(data.niveles)}</td></tr>
    <tr><td class="label">Recámaras</td><td>${esc(data.recamaras)}</td><td class="label">Baños</td><td>${esc(data.banos)}</td></tr>
  </table>

  <h2>1. Áreas y características declaradas por el cliente</h2>
  <p>La información de esta sección reproduce los datos proporcionados por el cliente en su solicitud y se utiliza para definir el alcance de la propuesta.</p>
  <div class="note"><strong>Espacios declarados:</strong> ${espacios}</div>
  ${data.otrosEspacios ? `<p><strong>Otros espacios o características:</strong> ${esc(data.otrosEspacios)}</p>` : ""}
  ${data.comentarios ? `<p><strong>Comentarios del cliente:</strong> ${esc(data.comentarios)}</p>` : ""}

  <h2>2. Qué incluye la inspección</h2>
  <p>La inspección comprende las áreas declaradas por el cliente que existan en el inmueble, se encuentren accesibles y puedan revisarse de forma segura al momento de la visita.</p>
  <table class="sectionTable">
    <tr><th>Área / sistema</th><th>Actividades incluidas</th></tr>
    <tr><td class="area">Condición general y acabados</td><td>Muros, plafones y pisos; fisuras, manchas, deformaciones, desprendimientos, deterioro, sellos y terminaciones visibles; puertas, ventanas, herrajes y elementos accesibles.</td></tr>
    <tr><td class="area">Elementos estructurales visibles</td><td>Losas, trabes, columnas, muros y escaleras visibles; indicios de agrietamiento, deformación, asentamiento, corrosión o deterioro que ameriten atención. No incluye cálculo ni dictamen estructural especializado.</td></tr>
    <tr><td class="area">Azotea, cubiertas y exteriores</td><td>Impermeabilización y recubrimientos visibles; pendientes, bajadas y desagües; pretiles, encuentros, penetraciones, sellos, fisuras, deterioro y señales visibles de ingreso de agua, cuando exista acceso seguro.</td></tr>
    <tr><td class="area">Instalación eléctrica</td><td>Tablero y protecciones accesibles, conductores visibles, contactos, apagadores y puntos eléctricos; polaridad, tierra, continuidad y verificaciones instrumentales cuando proceda.</td></tr>
    <tr><td class="area">Instalación hidráulica</td><td>Alimentaciones, llaves, muebles y conexiones visibles; operación, presión disponible, fugas aparentes y prueba de hermeticidad hidráulica cuando las condiciones permitan realizarla de forma segura.</td></tr>
    <tr><td class="area">Instalación sanitaria y drenajes</td><td>Descargas, trampas, coladeras, muebles sanitarios, fugas, sellos, olores y funcionamiento observable de los puntos accesibles.</td></tr>
    <tr><td class="area">Instalación de gas</td><td>Tuberías, válvulas, conexiones y equipos visibles; indicios de fuga y prueba de hermeticidad de gas cuando las condiciones permitan realizarla de forma segura.</td></tr>
    <tr><td class="area">Pisos y recubrimientos</td><td>Condición visible de losetas y recubrimientos; fisuras, piezas sueltas y auscultación de superficies accesibles para identificar indicios de huecos o desprendimiento.</td></tr>
    <tr><td class="area">Carpinterías, cancelerías y herrería</td><td>Operación y condición visible de puertas, ventanas, cerraduras, herrajes, canceles y elementos de herrería accesibles.</td></tr>
  </table>

  <div class="pageBreak"></div>
  <h2>3. Servicios instrumentales incluidos en esta propuesta</h2>
  <p>Estos servicios no modifican el importe de la propuesta. Pueden ajustarse antes de enviar la cotización definitiva cuando exista una limitación técnica, de seguridad o de disponibilidad de equipo.</p>
  <table class="sectionTable">
    <tr><th style="width:26pt;">Sel.</th><th>Servicio / equipo</th><th>Aplicación</th></tr>
    <tr><td class="check">☒</td><td>Cámara térmica</td><td>Anomalías térmicas, aislamiento, posibles fugas y calentamientos eléctricos.</td></tr>
    <tr><td class="check">☒</td><td>Probador de contactos GFCI/RCD</td><td>Polaridad, tierra, conexiones incorrectas y funcionamiento de protección.</td></tr>
    <tr><td class="check">☒</td><td>Detector de voltaje sin contacto</td><td>Presencia de tensión eléctrica.</td></tr>
    <tr><td class="check">☒</td><td>Multímetro profesional</td><td>Voltaje, continuidad y verificaciones eléctricas específicas.</td></tr>
    <tr><td class="check">☒</td><td>Nivel láser autonivelante</td><td>Desniveles y desviaciones importantes.</td></tr>
    <tr><td class="check">☒</td><td>Medidor láser de distancia</td><td>Dimensiones y comprobaciones rápidas.</td></tr>
    <tr><td class="check">☒</td><td>Martillo/rodillo de auscultación</td><td>Losetas con indicios de huecos o desprendimiento.</td></tr>
    <tr><td class="check">☒</td><td>Linterna LED profesional</td><td>Inspección visual detallada.</td></tr>
    <tr><td class="check">☒</td><td>Manómetro para agua</td><td>Presión de suministro hidráulico.</td></tr>
    <tr><td class="check">☒</td><td>Detector de gas combustible</td><td>Indicios de fugas en instalaciones de gas.</td></tr>
    <tr><td class="check">☒</td><td>Prueba de hermeticidad hidráulica</td><td>Verificación de pérdida de presión cuando el sistema y las condiciones de seguridad lo permitan.</td></tr>
    <tr><td class="check">☒</td><td>Prueba de hermeticidad de gas</td><td>Verificación de estanqueidad cuando la instalación y las condiciones de seguridad lo permitan.</td></tr>
    <tr><td class="check">☐</td><td>Boroscopio/endoscopio</td><td>Cavidades, espacios inaccesibles y algunas tuberías, cuando proceda.</td></tr>
    <tr><td class="check">☐</td><td>Higrómetro/termohigrómetro</td><td>Temperatura y humedad relativa ambiental.</td></tr>
    <tr><td class="check">☐</td><td>Termómetro infrarrojo</td><td>Temperaturas superficiales puntuales.</td></tr>
    <tr><td class="check">☐</td><td>Medidor de CO</td><td>Presencia de monóxido de carbono.</td></tr>
    <tr><td class="check">☐</td><td>Anemómetro</td><td>Flujo de aire en climatización.</td></tr>
    <tr><td class="check">☐</td><td>Pinza amperimétrica</td><td>Consumo/carga eléctrica cuando proceda.</td></tr>
  </table>

  <h2>4. Entregable</h2>
  <p>Al concluir la inspección, Certeza Habitacional entregará un <strong>reporte técnico digital en formato PDF</strong> que integrará, según aplique:</p>
  <p>• Identificación del inmueble y alcance realizado.<br>
     • Registro fotográfico de los hallazgos relevantes.<br>
     • Descripción de anomalías o condiciones observadas.<br>
     • Clasificación de hallazgos por importancia o atención recomendada.<br>
     • Referencia del área o sistema donde se localizó cada hallazgo.<br>
     • Recomendaciones generales de atención y seguimiento.<br>
     • Conclusiones generales de la inspección.</p>

  <h2>5. Propuesta económica</h2>
  <div class="totalBox">
    <div class="small">TOTAL DE LA COTIZACIÓN</div>
    <div class="total">${dinero(data.total)}</div>
    <div style="margin-top:5pt;"><strong>Nota:</strong> En caso de requerir factura, al importe anterior se adicionará el IVA correspondiente.</div>
  </div>

  <h2>6. Modalidades de pago</h2>
  <p class="check">☐ <strong>Pago único:</strong> ${dinero(data.total)} al contratar la inspección.</p>
  <p class="check">☐ <strong>Dos pagos parciales:</strong> ${dinero(data.pago50)} al contratar y ${dinero(data.pago50)} antes de iniciar la inspección.</p>
  <p>Solo podrá seleccionarse una de las dos modalidades.</p>

  <h2>7. Condiciones generales</h2>
  <p>• Vigencia de la propuesta: ${esc(data.vigenciaDias)} días naturales a partir de la fecha de emisión.<br>
     • La inspección es visual, funcional y no destructiva, salvo las verificaciones expresamente indicadas y técnicamente procedentes.<br>
     • El cliente deberá garantizar acceso seguro y autorización para revisar las áreas declaradas.<br>
     • Equipos, áreas o sistemas que no puedan revisarse por falta de acceso, seguridad, suministro o condición operativa se documentarán como limitaciones de alcance.<br>
     • La fecha de inspección se confirmará una vez recibido el pago correspondiente a la modalidad seleccionada.</p>

  <div class="note"><strong>Documento editable para revisión interna.</strong> Antes de enviarlo al cliente deben confirmarse servicios instrumentales, modalidad de pago, vigencia, descuentos o ajustes especiales y el total definitivo.</div>
</div>
</body>
</html>`;
}
