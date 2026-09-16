# V1 · Herramientas y tecnología en inspección y reporte

## Regla transversal

El uso de herramienta y tecnología forma parte del Método Certeza Habitacional y debe quedar documentado en dos niveles:

1. **En el punto/proceso/área donde se utilizó**: qué equipo se utilizó, para qué, lectura o resultado, evidencia relacionada y conclusión técnica del Inspector.
2. **En las páginas finales del reporte**: relación consolidada únicamente de las herramientas/tecnologías efectivamente utilizadas en esa inspección, con función, aplicación y beneficio técnico.

## Tecnología base obligatoria

### Aplicación Certeza Habitacional

**Función:** guía digital del proceso de inspección, control de alcance, secuencia de revisión, captura de evidencia, trazabilidad, asistencia de IA, clasificación de hallazgos, seguimiento de pendientes, generación del pre-reporte y preparación del reporte final.

**Aplicación en V1:** acompaña al Inspector durante toda la visita; relaciona áreas declaradas en cotización, puntos mínimos, proyectos, evidencias, hallazgos, resultados de herramientas, firmas y cierre de campo.

**Ventaja para el cliente:** reduce omisiones, disminuye tiempo de captura, mejora trazabilidad y permite convertir la información de campo en un reporte consistente, visual y fácil de seguir.

La aplicación debe aparecer siempre en la sección final de tecnología del reporte V1.

## Catálogo físico/técnico

El catálogo de equipos se toma de `lib/herramientas-inspeccion.ts`. En el reporte final solo se muestran los equipos realmente utilizados o las pruebas realmente ejecutadas en la inspección correspondiente.

Para cada herramienta utilizada, mostrar:

- Nombre del equipo o tecnología.
- Función.
- Aplicación concreta en esa inspección.
- Resultado o lectura relevante cuando corresponda.
- Área/proceso asociado.
- Beneficio técnico / ventaja de uso.
- Evidencia fotográfica o instrumental relacionada, cuando aplique.

## Presentación dentro del desarrollo técnico

Ejemplo:

**Prueba de hermeticidad hidráulica**  
Herramienta: Manómetro / equipo de prueba hidráulica.  
Aplicación: seguimiento de presión durante el periodo de prueba.  
Lectura inicial: [dato].  
Lectura final: [dato].  
Duración: [dato].  
Resultado: [resultado validado por Inspector].  
Evidencia: [fotografías/lecturas seleccionadas].

Ejemplo por área:

**Recámara principal · Nivelación**  
Herramienta: Nivel láser autonivelante.  
Aplicación: verificación de nivel/alineación en los elementos revisados.  
Resultado: [dato/observación].

## Sección final del reporte

Título propuesto: **Herramientas y tecnología utilizadas**.

Posición: después del desarrollo técnico y del resumen estadístico, antes del glosario y del certificado final.

La sección inicia siempre con **Aplicación Certeza Habitacional** y continúa con los equipos efectivamente utilizados.

No mostrar herramientas no utilizadas. Si una prueba contratada no pudo ejecutarse, documentarla en el desarrollo técnico como **NO EJECUTADA** con motivo, pero no presentarla como herramienta utilizada.

## Relación con el pre-reporte

El pre-reporte en sitio mostrará únicamente las herramientas/pruebas de mayor relevancia para los resultados obtenidos. El reporte final contendrá la relación completa.

## Regla de automatización

El Inspector no debe redactar manualmente la sección final. El sistema la construye automáticamente a partir de:

- herramientas seleccionadas/contratadas;
- resultados instrumentales capturados;
- puntos y procesos donde fueron utilizadas;
- evidencia vinculada;
- hallazgos relacionados.

El Inspector conserva la última palabra sobre la interpretación técnica de los resultados.
