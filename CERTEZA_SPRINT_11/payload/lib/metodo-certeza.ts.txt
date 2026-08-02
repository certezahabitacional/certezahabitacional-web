export type PuntoMetodoCerteza = {
  clave: string;
  area: string;
  titulo: string;
  recomendacionBase: string;
};

export const PUNTOS_METODO_CERTEZA: PuntoMetodoCerteza[] = [
  { clave: "EST-01", area: "Estructura", titulo: "Grietas, fisuras o asentamientos visibles", recomendacionBase: "Documentar ubicación, trayectoria y abertura; solicitar valoración estructural cuando existan indicios de movimiento." },
  { clave: "EST-02", area: "Estructura", titulo: "Verticalidad de muros y elementos", recomendacionBase: "Verificar desplomes con herramienta adecuada y determinar si corresponde a acabado o elemento estructural." },
  { clave: "EST-03", area: "Estructura", titulo: "Losas, trabes y columnas visibles", recomendacionBase: "Revisar deformaciones, desprendimientos, acero expuesto y señales de humedad." },
  { clave: "CUB-01", area: "Azotea e impermeabilización", titulo: "Estado de impermeabilización", recomendacionBase: "Corregir desprendimientos, fisuras, traslapes deficientes y zonas con vida útil agotada." },
  { clave: "CUB-02", area: "Azotea e impermeabilización", titulo: "Pendientes, bajantes y desagües", recomendacionBase: "Eliminar encharcamientos y asegurar el libre flujo hacia bajantes y desagües." },
  { clave: "CUB-03", area: "Azotea e impermeabilización", titulo: "Pretiles, sellos y penetraciones", recomendacionBase: "Resellar encuentros, tuberías y elementos que atraviesan la cubierta." },
  { clave: "HUM-01", area: "Humedad", titulo: "Humedad ascendente o salitre", recomendacionBase: "Identificar fuente, reparar la causa y sanear recubrimientos afectados." },
  { clave: "HUM-02", area: "Humedad", titulo: "Filtraciones en muros o plafones", recomendacionBase: "Localizar origen exterior, hidráulico o sanitario antes de reparar acabados." },
  { clave: "HUM-03", area: "Humedad", titulo: "Moho, condensación o ventilación insuficiente", recomendacionBase: "Mejorar ventilación, controlar la fuente de humedad y limpiar con procedimiento seguro." },
  { clave: "ELE-01", area: "Instalación eléctrica", titulo: "Centro de carga e identificación de circuitos", recomendacionBase: "Etiquetar circuitos y corregir protecciones, conexiones o espacios sin tapa." },
  { clave: "ELE-02", area: "Instalación eléctrica", titulo: "Contactos, polaridad y tierra física", recomendacionBase: "Corregir polaridad, continuidad de tierra y dispositivos dañados." },
  { clave: "ELE-03", area: "Instalación eléctrica", titulo: "Interruptores, luminarias y cajas", recomendacionBase: "Asegurar funcionamiento, tapas completas y ausencia de conductores expuestos." },
  { clave: "ELE-04", area: "Instalación eléctrica", titulo: "Protección en áreas húmedas y exteriores", recomendacionBase: "Instalar protecciones apropiadas y verificar hermeticidad y puesta a tierra." },
  { clave: "HID-01", area: "Instalación hidráulica", titulo: "Presión y funcionamiento de muebles", recomendacionBase: "Verificar presión uniforme, operación de válvulas y ausencia de obstrucciones." },
  { clave: "HID-02", area: "Instalación hidráulica", titulo: "Fugas visibles o indicios de fuga", recomendacionBase: "Reparar conexiones, sellos o tuberías y confirmar estanqueidad." },
  { clave: "HID-03", area: "Instalación hidráulica", titulo: "Tinaco, cisterna, bomba y válvulas", recomendacionBase: "Dar mantenimiento, asegurar tapas y revisar flotadores, válvulas y conexiones." },
  { clave: "SAN-01", area: "Instalación sanitaria", titulo: "Descarga y desalojo de muebles sanitarios", recomendacionBase: "Corregir lentitud, retorno, fugas o sellos deficientes." },
  { clave: "SAN-02", area: "Instalación sanitaria", titulo: "Coladeras, registros y olores", recomendacionBase: "Limpiar, sellar y verificar trampas hidráulicas y ventilación sanitaria." },
  { clave: "GAS-01", area: "Instalación de gas", titulo: "Tuberías, conexiones y válvulas", recomendacionBase: "Realizar prueba de hermeticidad por técnico competente y corregir cualquier fuga." },
  { clave: "GAS-02", area: "Instalación de gas", titulo: "Ventilación y ubicación de equipos", recomendacionBase: "Asegurar ventilación, distancias y evacuación de gases conforme a especificaciones." },
  { clave: "ACA-01", area: "Acabados", titulo: "Pisos, boquillas, pendientes y piezas huecas", recomendacionBase: "Reponer piezas, corregir pendientes y sellar juntas deterioradas." },
  { clave: "ACA-02", area: "Acabados", titulo: "Muros, pintura y recubrimientos", recomendacionBase: "Corregir desprendimientos, fisuras de acabado y defectos de preparación." },
  { clave: "ACA-03", area: "Acabados", titulo: "Plafones y cielos", recomendacionBase: "Reparar deformaciones, juntas, humedad o elementos sueltos." },
  { clave: "CAR-01", area: "Carpintería, herrería y cancelería", titulo: "Puertas, marcos, cerraduras y herrajes", recomendacionBase: "Ajustar hojas, marcos, cerraduras y sellos para operación correcta." },
  { clave: "CAR-02", area: "Carpintería, herrería y cancelería", titulo: "Ventanas, cristales y sellos", recomendacionBase: "Corregir filtraciones, cristales dañados, holguras y sellos faltantes." },
  { clave: "EXT-01", area: "Fachadas y exteriores", titulo: "Fachadas, bardas y elementos exteriores", recomendacionBase: "Reparar fisuras, desprendimientos, corrosión y elementos inestables." },
  { clave: "EXT-02", area: "Fachadas y exteriores", titulo: "Patios, banquetas y pendientes", recomendacionBase: "Corregir desniveles, pendientes hacia la vivienda y riesgos de tropiezo." },
  { clave: "SEG-01", area: "Seguridad", titulo: "Barandales, escaleras y desniveles", recomendacionBase: "Corregir alturas, fijaciones, continuidad y condiciones de uso seguro." },
  { clave: "SEG-02", area: "Seguridad", titulo: "Rutas de salida, protecciones y riesgos inmediatos", recomendacionBase: "Eliminar obstrucciones y atender riesgos eléctricos, de caída, incendio o atrapamiento." },
  { clave: "VEN-01", area: "Ventilación y confort", titulo: "Ventilación e iluminación natural", recomendacionBase: "Mejorar ventilación, iluminación o funcionamiento de vanos cuando resulte insuficiente." },
];

export const TOTAL_PUNTOS_METODO_CERTEZA = PUNTOS_METODO_CERTEZA.length;

export function agruparPuntosMetodoCerteza() {
  return PUNTOS_METODO_CERTEZA.reduce<Record<string, PuntoMetodoCerteza[]>>(
    (grupos, punto) => {
      grupos[punto.area] ??= [];
      grupos[punto.area].push(punto);
      return grupos;
    },
    {},
  );
}
