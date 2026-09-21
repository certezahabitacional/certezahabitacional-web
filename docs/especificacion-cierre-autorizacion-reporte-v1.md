# Especificación maestra — Cierre, firmas, autorización, reporte oficial y certificado V1

## 1. Objetivo

Definir el flujo único y auditable que inicia cuando el Inspector concluye la inspección técnica V1 y termina cuando Dirección autoriza el reporte, se genera el Reporte Oficial y se emite el Certificado Certeza Habitacional.

Esta especificación es el contrato funcional para desarrollo, pruebas y aceptación.

## 2. Estado actual reutilizable

El sistema ya cuenta con infraestructura que debe conservarse y aprovecharse:

- Firmas de Inspector y Cliente en `app/panel/inspecciones/[id]/firmas/page.tsx` y API `app/api/inspecciones/[id]/firmas/route.ts`.
- Cierre V1 y envío a Dirección en `app/panel/inspecciones/[id]/cierre-v1/actions.ts`.
- Revisión por Dirección mediante `RevisionInspeccion`, incluyendo devolución al Inspector.
- Distinción actual entre devolución documental y reapertura técnica.
- Estado `REPORTE_PENDIENTE` para revisión de Dirección.
- Reporte V1 en `app/panel/inspecciones/[id]/reporte-v1/page.tsx`.
- Certificado asociado 1:1 a la inspección mediante `Certificado`.
- Auditoría mediante `EventoAuditoria`.
- Generación de QR con librería `qrcode`.

## 3. Flujo funcional obligatorio

### 3.1 Inspector concluye inspección técnica

Requisitos previos:

- Todas las partidas obligatorias aplicables cerradas.
- Procesos técnicos obligatorios completos o marcados NO APLICA.
- Hallazgos completos.
- Evidencia válida.
- Fotografía de portada seleccionada cuando corresponda.
- Sin operaciones pendientes de sincronización.

Resultado:

- Se registra conclusión técnica.
- Se habilita el PRE REPORTE.
- La captura técnica todavía puede ser ajustada por el Inspector antes del cierre definitivo de campo.

### 3.2 Generación y presentación del PRE REPORTE

El documento generado en esta etapa debe:

- Titularse PRE REPORTE.
- Llevar marca de agua diagonal “PRE REPORTE” en todas las páginas.
- Mostrar la información vigente capturada hasta ese momento.
- No mostrar certificado final como emitido.
- Mostrar claramente “Pendiente de revisión y autorización de Dirección”.

El Inspector presenta el PRE REPORTE al Cliente.

### 3.3 Registro de firmas

Después de la presentación del PRE REPORTE, el siguiente paso obligatorio es registrar:

1. Firma del Inspector.
2. Firma del Cliente.

Reglas:

- No se puede cerrar la visita sin ambas firmas.
- Deben quedar asociadas al expediente.
- Deben mostrarse dentro del PRE REPORTE.
- Si Dirección ordena una reapertura técnica posterior, las firmas anteriores dejan de considerarse vigentes y deberán registrarse nuevamente.
- Si la devolución es exclusivamente documental y no cambia el contenido técnico aceptado con el Cliente, las firmas pueden conservarse.

### 3.4 Ventana de ajuste final del Inspector

Después de las firmas, el Inspector debe poder:

- Revisar nuevamente el PRE REPORTE.
- Corregir redacción.
- Ajustar interpretación final.
- Corregir clasificación o prioridad cuando proceda.
- Completar o corregir datos documentales permitidos.
- Atender acuerdos o aclaraciones surgidas durante la presentación al Cliente.

Mientras esta etapa esté abierta:

- El documento sigue siendo PRE REPORTE.
- Dirección aún no puede emitir reporte oficial.
- El sistema conserva trazabilidad de las modificaciones.

Cuando el Inspector termina, confirma “Revisión final del Inspector”.

### 3.5 Envío a Dirección

Condiciones obligatorias:

- PRE REPORTE generado.
- Firmas vigentes de Inspector y Cliente.
- Revisión final del Inspector confirmada.
- Validaciones técnicas de cierre completas.

Acción:

- Botón: “ENVIAR PRE REPORTE A DIRECCIÓN”.
- La inspección cambia a `REPORTE_PENDIENTE`.
- El Inspector queda en solo lectura mientras Dirección revisa.
- Se registra auditoría.

### 3.6 Revisión de Dirección

Dirección debe disponer de una bandeja de PRE REPORTES pendientes de autorización.

Al abrir un expediente podrá:

#### Opción A — Autorizar

Si no existen observaciones:

- Dirección autoriza.
- Se registra la autorización con usuario, fecha y hora.
- El PRE REPORTE se congela como versión aprobada.
- Desaparece completamente la marca de agua “PRE REPORTE”.
- El documento pasa a denominarse “REPORTE OFICIAL”.
- Se genera o activa el Certificado Certeza Habitacional.
- Se genera la liga pública/segura de consulta del reporte final.
- Se genera el QR del certificado.
- Se cierra el expediente documental final.

#### Opción B — Devolver con observaciones

Dirección escribe una observación obligatoria.

Debe seleccionar:

- CORRECCIÓN DOCUMENTAL, o
- REAPERTURA TÉCNICA.

Se crea una `RevisionInspeccion` con decisión `DEVUELTO_INSPECTOR`.

El Inspector debe ver de forma destacada:

- Fecha de devolución.
- Nombre de quien devuelve.
- Tipo de corrección.
- Observación completa.
- Estado de atención.

### 3.7 Atención de observaciones por el Inspector

El Inspector:

- Lee la observación.
- Realiza los ajustes.
- Registra aclaración o respuesta cuando aplique.
- Confirma nuevamente su revisión final.
- Reenvía el PRE REPORTE a Dirección.

El ciclo Dirección ↔ Inspector se repite tantas veces como sea necesario hasta autorización.

## 4. Marca de agua PRE REPORTE

### Requisito

Mientras el reporte no tenga autorización vigente de Dirección:

- Mostrar “PRE REPORTE” en diagonal.
- Repetir en todas las páginas impresas/PDF.
- Color tenue.
- Transparencia suficiente para no impedir lectura.
- Posición central.
- No interferir con fotografías, gráficas, firmas o tablas.

### Eliminación

La marca debe desaparecer únicamente cuando exista autorización vigente y el reporte sea final.

No debe depender de una acción manual de impresión.

## 5. QR institucional de portada

La portada debe incluir un QR en la esquina inferior derecha.

Este QR debe llevar a una ficha institucional pública y controlada por Certeza Habitacional.

La ficha debe mostrar:

- Logotipo oficial.
- CERTEZA HABITACIONAL.
- Correo institucional oficial.
- Teléfono correspondiente a la zona.
- Sitio web oficial.
- Información básica del servicio y contacto.

Regla:

- El teléfono debe resolverse por `Zona`.
- Si no existe configuración específica de la zona, usar el teléfono corporativo de respaldo.
- No codificar directamente información cambiante dentro del QR; el QR debe apuntar a una URL para poder actualizar datos sin regenerar reportes históricos.

## 6. QR del certificado

El Certificado debe contener un QR diferente al QR institucional de portada.

Este QR debe apuntar directamente a una página segura de consulta del Reporte Oficial, con acceso a:

- Visualizar el reporte.
- Descargar PDF.
- Consultar datos básicos de validación.
- Ver vigencia del certificado.

Debe servir para que el Cliente comparta el reporte con:

- Inmobiliaria.
- Constructor.
- Vendedor.
- Administrador.
- Técnico o contratista.
- Cualquier tercero autorizado por el Cliente mediante la propia liga.

El QR no debe exponer pantallas administrativas.

## 7. Certificado Certeza Habitacional

El certificado final debe generarse solo después de autorización de Dirección.

Contenido mínimo:

- Imagen institucional autorizada.
- Logotipo Certeza Habitacional.
- Folio de certificado.
- Folio de inspección.
- Datos del inmueble.
- Fecha de inspección.
- Resumen ejecutivo.
- Calificación Técnica Certeza.
- Nivel de evaluación.
- Cobertura efectiva.
- Resumen de prioridades P1–P5.
- Dictamen/resumen final.
- Nombre y fecha de autorización de Dirección.
- QR al Reporte Oficial.
- Datos de contacto institucionales.
- Estado de vigencia.

El certificado no debe existir como documento final descargable mientras el reporte continúe en PRE REPORTE.

## 8. Estados funcionales de interfaz

No es obligatorio crear un enum nuevo si el flujo puede representarse con `EstadoInspeccion`, `InspeccionControlV2` y `RevisionInspeccion`.

La interfaz debe exponer estados humanos claros:

1. Inspección técnica en proceso.
2. Inspección técnica concluida.
3. PRE REPORTE generado.
4. PRE REPORTE presentado / firmas pendientes.
5. Firmas registradas.
6. Ajuste final del Inspector.
7. Listo para enviar a Dirección.
8. En revisión de Dirección.
9. Devuelto por Dirección — corrección documental.
10. Devuelto por Dirección — reapertura técnica.
11. Reenviado a Dirección.
12. Autorizado por Dirección.
13. Reporte Oficial generado.
14. Certificado generado.
15. Expediente cerrado.

## 9. Permisos

### Inspector

Puede:

- Generar y consultar PRE REPORTE.
- Registrar firmas si la inspección está en etapa permitida.
- Ajustar contenido antes del envío a Dirección.
- Atender devoluciones.
- Reenviar a Dirección.

No puede:

- Autorizar su propio reporte.
- Eliminar la marca PRE REPORTE.
- Emitir certificado final.
- Modificar después de autorización final sin reapertura formal autorizada.

### Director

Puede:

- Revisar PRE REPORTE.
- Autorizar.
- Devolver con observaciones.
- Elegir corrección documental o reapertura técnica.
- Reabrir técnicamente cuando sea necesario.
- Consultar historial de revisiones.

### Cliente

No modifica contenido técnico.

Participa mediante:

- Revisión presencial/remota.
- Firma.
- Consulta posterior del Reporte Oficial y Certificado.

## 10. Historial y auditoría

Debe conservarse:

- Cada envío a Dirección.
- Cada devolución.
- Texto completo de cada observación.
- Tipo de corrección.
- Usuario y fecha.
- Cada autorización.
- Reaperturas.
- Nuevas firmas posteriores a reapertura técnica.
- Emisión del certificado.
- Descargas del reporte cuando aplique.

`RevisionInspeccion` se utilizará como historial de decisiones.

`EventoAuditoria` complementará trazabilidad operativa.

## 11. PDF y reglas de paginación

El Reporte Oficial y PRE REPORTE deben estar diseñados primero para impresión/PDF, no solo para pantalla.

### Reglas obligatorias

- Ninguna fotografía debe partirse entre páginas.
- Ninguna gráfica debe partirse.
- Bloques de firma deben permanecer completos.
- Tarjetas de hallazgos deben evitar cortes internos.
- Encabezados no deben quedar solos al final de una página.
- Una fila de tabla no debe dividirse.
- Tablas extensas deben repetir encabezado cuando técnicamente sea posible.
- Evitar hojas con un título y casi ningún contenido.
- Evitar páginas blancas o aparentemente omitidas.
- Mantener relación visual entre fotografía, hallazgo y descripción.
- Los pies de página no deben superponerse al contenido.
- Secciones demasiado grandes podrán fluir en varias páginas; no deben forzarse a una altura mínima que genere huecos artificiales.

### CSS de impresión requerido

Usar de manera consistente:

- `break-inside: avoid`
- `page-break-inside: avoid`
- `break-before: page` solo donde sea necesario
- clases específicas para tablas, figuras, firmas y tarjetas

Revisar y reducir el uso indiscriminado de `min-height` por página cuando produzca páginas semivacías.

## 12. Versionado documental

Al autorizar Dirección debe congelarse la versión del reporte que fue autorizada.

Requisito recomendado:

- Guardar una referencia/hash o snapshot de la versión autorizada.
- El PDF final compartido mediante QR debe corresponder exactamente a esa versión.
- Cambios posteriores requieren reapertura y nueva autorización.

## 13. Liga pública/segura del reporte

La URL del QR del Certificado debe cumplir:

- Token no predecible o código de validación.
- Solo lectura.
- No exponer IDs internos sensibles como mecanismo único de acceso.
- Permitir descarga del PDF final.
- Mostrar si el certificado fue revocado.
- Mantener histórico del documento autorizado.

Ruta sugerida conceptual:

`/reportes/verificar/[codigoValidacion]`

o reutilizar/ampliar:

`/certificados/verificar/[codigoValidacion]`

## 14. Datos institucionales por zona

Crear una fuente única de verdad para:

- Empresa.
- Logotipo.
- Correo.
- Web.
- Teléfono corporativo.
- Teléfono por zona.

La portada, pie de página, certificado y QR deben consumir la misma configuración.

No deben escribirse teléfonos/correos manualmente en cada plantilla.

## 15. Criterios de aceptación

El desarrollo se considera terminado cuando:

1. El Inspector no puede enviar a Dirección sin ambas firmas.
2. Después de firmar puede realizar ajustes finales.
3. El PRE REPORTE siempre tiene marca diagonal visible.
4. Dirección puede autorizar o devolver con observaciones.
5. El Inspector ve claramente las observaciones de Dirección.
6. El Inspector puede corregir y reenviar.
7. Una devolución técnica invalida firmas anteriores; una documental puede conservarlas.
8. La autorización elimina automáticamente la marca PRE REPORTE.
9. El Reporte Oficial queda bloqueado contra edición ordinaria.
10. Se genera Certificado únicamente tras autorización.
11. Portada contiene QR institucional.
12. Certificado contiene QR al Reporte Oficial descargable.
13. La liga del QR no requiere acceso al panel interno.
14. Teléfono institucional corresponde a la zona.
15. PDF no presenta fotografías, gráficas, firmas o tarjetas cortadas de forma inconveniente.
16. No aparecen páginas intermedias aparentemente vacías.
17. Todas las decisiones quedan auditadas.

## 16. Prioridad de implementación

### Bloque A — Flujo de autorización
1. Consolidar secuencia PRE REPORTE → firmas → ajustes → Dirección.
2. Consolidar devolución documental/técnica.
3. Mostrar historial de observaciones al Inspector.
4. Autorizar y bloquear versión final.

### Bloque B — Identidad documental
5. Marca de agua PRE REPORTE.
6. QR institucional de portada.
7. Datos de contacto por zona.

### Bloque C — Reporte oficial y certificado
8. Generar URL pública/segura.
9. QR directo al Reporte Oficial.
10. Rediseñar certificado.
11. Congelar versión autorizada.

### Bloque D — Calidad de PDF
12. Auditoría completa de saltos de página.
13. Reglas de no corte para imágenes, gráficas, tablas, firmas y hallazgos.
14. Pruebas con reportes cortos, medianos y extensos.

## 17. Decisión de arquitectura

Se debe aprovechar la infraestructura existente en vez de crear un segundo flujo paralelo.

En particular:

- `EstadoInspeccion.REPORTE_PENDIENTE` se mantiene como estado de revisión directiva.
- `RevisionInspeccion` se mantiene como historial de decisiones y devoluciones.
- `Firma` se mantiene como registro de firmas.
- `Certificado` se amplía para servir como llave de validación pública.
- `InspeccionControlV2` se mantiene como control de hitos del flujo V1.

Cualquier nuevo campo debe complementar estas entidades, no duplicarlas.
