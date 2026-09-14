# Protocolo de inspección de vivienda

## Alcance por número de visita

### V1 · inspección inicial integral

La visita V1 aplica todos los requerimientos iniciales del Método Certeza®:

1. La inspección nace de una cotización autorizada y de una plantilla identificada como **VIVIENDA**.
2. Antes del trabajo de campo se registra el proyecto disponible en PDF o se declara explícitamente **SIN PROYECTO PDF**.
3. El proyecto alimenta áreas, dimensiones, ubicaciones, especificaciones y criterios. Si no existe proyecto, se construye manualmente el ecosistema físico del inmueble.
4. Las áreas declaradas desde cotización/proyecto son obligatorias. Todas deben cerrarse con evidencia aun cuando no exista hallazgo.
5. La primera evidencia de campo es la **fachada principal**, candidata además a portada del reporte.
6. Después de la identificación inicial se abren las pruebas de hermeticidad **hidráulica** y **gas** cuando apliquen. Se registra lectura inicial y evidencia; permanecen cargadas durante la inspección y se cierran al final con lectura final y evidencia.
7. Cada área obligatoria requiere estado de revisión, comentario final y al menos cuatro fotografías disponibles para selección editorial. Puede incluir videos complementarios.
8. La IA puede proponer la primera interpretación de un hallazgo, pero el texto final siempre es editable y aprobado por el Inspector.

### V2, V3 y subsecuentes · visitas de seguimiento

1. Son visitas sobre el **mismo inmueble** y deben conservar vínculo con la inspección inmediatamente anterior.
2. Su alcance ordinario son únicamente los **hallazgos no resueltos** de la visita anterior.
3. Los hallazgos ya marcados como corregidos/resueltos no deben reaparecer como pendientes en la visita siguiente.
4. Cada hallazgo heredado conserva su vínculo con `hallazgoAnteriorId`, evidencia antecedente y evolución histórica.
5. El Inspector registra para cada antecedente su resultado: corregido, parcialmente corregido, no corregido, corrección no satisfactoria o no verificable.
6. Debe existir siempre la opción **Nuevo hallazgo / solicitud especial**, para registrar condiciones nuevas encontradas en campo o peticiones especiales del cliente.
7. Todo hallazgo nuevo capturado en V2+ queda identificado como `NUEVO_HALLAZGO` y puede convertirse en antecedente pendiente para una visita posterior.
8. Una visita V2+ no obliga a repetir la carga de proyecto, ecosistema completo de áreas ni evidencia general de todas las áreas de V1, salvo que el alcance comercial contratado expresamente lo requiera.

## Reglas comunes a todas las visitas

1. El Inspector solo ve y modifica sus propias inspecciones. Dirección conserva acceso global.
2. Al cerrar captura, el Inspector pierde facultad de modificación. Solo Dirección puede reabrir la inspección con motivo auditado.
3. El certificado solo se libera por Gerencia cuando la inspección tiene Gerente responsable; si no existe Gerente aplicable, lo libera Dirección. Dirección puede revocar certificados.
4. El Cliente recibe información solo de sus propias cotizaciones e inspecciones liberadas; las evidencias se visualizan sin alterar el reporte.
5. La captura de campo debe poder conservar cambios localmente sin internet y sincronizarlos al recuperar conectividad.

## Orden operativo mínimo V1

1. Preparación / proyecto PDF o levantamiento físico.
2. Construcción y validación de áreas obligatorias.
3. Fachada principal e identificación del inmueble.
4. Apertura prueba hidráulica.
5. Apertura prueba de gas.
6. Recorrido guiado por cada área y sus conceptos.
7. Hallazgos y evidencia por área (mínimo 4 fotografías; video opcional).
8. Validación de cobertura: ninguna área pendiente.
9. Firmas aplicables.
10. Cierre de prueba hidráulica.
11. Cierre de prueba de gas.
12. Cierre de captura por Inspector.
13. Edición del reporte por Inspector (o Dirección por contingencia).
14. Revisión/autorización conforme a estructura de la zona.
15. Emisión del certificado por Gerencia aplicable o Dirección.
16. Entrega al Cliente.

## Orden operativo mínimo V2+

1. Confirmar vínculo con inmueble e inspección anterior.
2. Cargar automáticamente únicamente hallazgos pendientes de la visita anterior.
3. Revisar cada antecedente y registrar su estado actual.
4. Capturar evidencia actual comparativa.
5. Agregar, cuando proceda, **Nuevo hallazgo / solicitud especial**.
6. Resolver cualquier ajuste comercial originado durante la visita.
7. Cerrar captura cuando todos los antecedentes del alcance estén atendidos.
8. Elaborar reporte de seguimiento.
9. Revisión/autorización y certificado conforme a roles.

## Ajustes comerciales

1. Desde la pre-cotización se podrán agregar conceptos de **cargo adicional** por alcance/pedido especial.
2. También podrán proponerse **descuentos**, pero todo descuento requiere autorización expresa de Dirección.
3. Durante una inspección, antes del cierre del reporte, se podrá proponer un cargo adicional o descuento por condiciones descubiertas en campo o solicitudes nuevas del cliente.
4. El Inspector puede detectar y proponer un ajuste derivado de la inspección, pero no modificar directamente la cuenta del cliente.
5. Administración/Dirección pueden gestionar cargos adicionales; los descuentos solo se vuelven efectivos cuando Dirección los autoriza.
6. Cada ajuste debe registrar: tipo, concepto, motivo, monto, origen, usuario que lo propuso, usuario que lo autorizó/rechazó y fecha.
7. Los ajustes aplicados deben generar nueva versión comercial y actualizar el saldo pendiente sin borrar pagos históricos.
8. Si un ajuste aumenta el saldo, el certificado no podrá liberarse hasta que la condición financiera correspondiente quede resuelta, salvo una política futura expresamente aprobada por Dirección.

## Trazabilidad y documentación obligatoria

1. Ningún cambio relevante debe sobrescribir la historia previa.
2. Cada modificación debe registrar, cuando corresponda: usuario, rol, fecha/hora, entidad afectada, dato anterior, dato nuevo, motivo, origen, autorización/rechazo, inspección/cotización relacionada, IP y navegador.
3. La bitácora estructurada es **inmutable**: la operación normal del sistema no puede editar ni eliminar registros históricos.
4. La auditoría narrativa existente se conserva y se complementa con un historial estructurado de antes/después.
5. Los cambios que deben quedar documentados incluyen, como mínimo: versiones de cotización, cargos, descuentos, pagos, cambios de alcance, reasignaciones, cambios de agenda, apertura/cierre/reapertura de inspección, edición de hallazgos, seguimientos V2+, selección de evidencias, modificaciones de reporte, autorizaciones, rechazos, emisión y revocación de certificados.
6. Cuando un cambio afecte una condición ya aceptada por el cliente, el sistema deberá conservar la aceptación anterior como antecedente y solicitar nueva aceptación cuando la regla comercial aplicable lo requiera.
7. El historial debe permitir reconstruir cronológicamente el expediente completo para aclaraciones del cliente, auditoría interna o defensa de Certeza Habitacional.

## Reporte

Se conserva la identidad visual actualmente autorizada. En una fase posterior se ajustarán únicamente portada, índice, resumen, paginación, bibliografía, control de saltos de página y selección editorial de evidencias, evitando duplicidad de información.
