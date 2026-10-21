# Validacion del cambio de visitas contratadas

## Estado verificado

PR 256; rama `codex/visitas-importe-contratado`; destino `develop`.
Ultimo commit de codigo probado: `125aeb3f04e768bdbf95484b143c2c00758584e6`.
Ejecuciones concluidas el 21 de octubre de 2026 UTC (20 de octubre en Ciudad Juarez).
Este documento registra resultados de desarrollo, NO una liberacion a produccion.

| Verificacion | Evidencia | Resultado |
| --- | --- | --- |
| Visitas, Caja, concurrencia, formularios/acciones aislados y vinculos | Run 39519819689; job 118960631678 | 53 ejecutadas, 53 aprobadas, 0 fallidas, 0 omitidas |
| Compilacion completa Next.js con candidato de dependencias verificado | Run 39519819680; job 118960632068 | Aprobada, sin saltar TypeScript |
| Lint de las rutas y servicios de visitas enumerados en ese workflow | Run 39519819680; job 118960632068 | Aprobado; no equivale a lint de todo el repositorio |
| Instalacion con el package-lock.json comprometido en la rama | Todavia contiene el archivo anterior, no el candidato | Correccion pendiente de incorporacion |
| Recorrido autenticado en navegador y comparativo fotografico | No ejecutado como parte de estos jobs | Pendiente |

## Proteccion del vinculo incorporada

Archivos: `lib/visitas-cotizacion.ts`, `lib/caja-validaciones.ts`, `lib/caja-operaciones.ts`, `app/panel/inspecciones/nueva/actions.ts`, `app/panel/inspecciones/nueva/page.tsx`.
Pruebas nuevas: `tests/visitas-vinculo.test.cjs`, integradas al workflow `visitas-caja.yml`.

- Una visita identificada como contratada por sus metadatos o su folio no devuelve un vinculo nulo cuando falta la tabla o la fila correspondiente: devuelve un error y no se interpreta como V1.
- La identidad se lee de la version contractual 1. Una version documental posterior no la sustituye.
- Se comprueban numero de visita, cotizacion original, folio, cliente, inmueble, zona y antecedente. V2 debe corresponder a la inspeccion V1 exacta del origen; en visitas posteriores se comprueba tambien el vinculo financiero de la visita inmediatamente anterior.
- Se rechazan autorreferencias, numeros invalidos, filas duplicadas y una inspeccion agendada con otro numero o antecedente.
- Caja comprueba el vinculo antes de registrar pagos o excepciones. Las validaciones operativas compartidas lo comprueban antes de permitir agendamiento o liberacion de campo. Nueva Inspeccion presenta un mensaje de revision de expediente ante errores conocidos.
- Un error inesperado de base de datos se propaga, no se transforma en una supuesta ausencia de seguimiento.
- La consulta es de solo lectura. V1 ordinaria sigue funcionando cuando la nueva tabla aun no existe.
- Esta comprobacion NO equivale a una auditoria recursiva de todos los antepasados ni sustituye permisos, autorizaciones, pagos o la integridad transaccional de otras rutas.

La nueva prueba con PostgreSQL crea V1 y V2, registra un abono de V2 y una segunda version documental, y comprueba que la identidad contractual sigue siendo valida. Elimina despues el vinculo SOLO en la base desechable: se rechazan la consulta, otro pago y ambas excepciones, sin alterar el saldo, pagos, auditoria o excepciones de V2 ni los importes de V1.

## Cambios comprobados de Caja

Archivos de aplicacion: `lib/caja-operaciones.ts`, `app/panel/caja/actions.ts` y `app/panel/caja/page.tsx`.

- El servicio vuelve a comprobar usuario activo, rol, zona y cotizacion AUTORIZADA. Direccion y Administracion pueden registrar abonos; solo Direccion puede autorizar excepciones del 50% o 100%.
- El saldo se lee despues de bloquear el registro financiero de la visita dentro de la transaccion. Dos abonos simultaneos no pierden actualizaciones ni exceden lo contratado en los casos probados.
- Cada formulario incorpora una clave UUID de operacion. Reenviar la misma clave con los mismos datos devuelve el pago existente; cambiar sus datos, usuario o cotizacion se rechaza. La presentacion de celular y escritorio comparten la clave del mismo formulario renderizado.
- Esta proteccion no deduplica dos formularios independientes con claves nuevas ni determina si dos referencias bancarias corresponden al mismo pago.
- Pago, saldo y auditoria se guardan en una sola transaccion. La prueba de fallo de auditoria confirma la reversion tanto del abono como del saldo.
- Se validan importes positivos a centavos; no se aceptan negativos, cero, notacion exponencial ni mas de dos decimales.
- Las cotizaciones canceladas no admiten pagos ni excepciones por estas acciones. No se borran pagos historicos ni se reinicia el acumulado de V1.
- Las excepciones de apertura e inicio son independientes y conservan su motivo original ante reintentos. La excepcion de inicio de V2 se sincroniza solo con su inspeccion.
- Administracion no recibe formularios de autorizacion de excepciones; el servidor tambien rechaza su llamada directa. No se revocaron automaticamente excepciones historicas.
- La accion toma al usuario de la sesion, no del formulario, y actualiza Caja, Cotizaciones, Nueva Inspeccion, Agenda e Inspecciones despues de guardar.

La clave utiliza el campo String `PagoCotizacion.id` existente con prefijo `caja-`; estos controles no agregan otra migracion. Otras rutas que escriban pagos o acumulados deben revisarse antes de asegurar concurrencia global.

## Composicion y limites de las 53 pruebas

- 21 pruebas unitarias de importes y umbrales.
- 1 escenario de persistencia V2/V3 con verificaciones de relaciones, permisos, concurrencia de activacion, auditoria y conservacion de evidencia.
- 8 escenarios de Caja con PostgreSQL.
- 7 pruebas de pagina y acciones de Caja con dependencias sustituidas.
- 15 pruebas de consulta de vinculos con sustitutos de lectura.
- 1 escenario nuevo de PostgreSQL para bloqueo de operaciones ante un vinculo ausente.

Las pruebas de pagina/acciones no abren un navegador ni prueban NextAuth: sustituyen sesion, Prisma y componentes. No son una validacion visual ni un recorrido autenticado. La compilacion tampoco demuestra por si sola el funcionamiento de todos los botones.

El escenario de V2 por 100.01 verifica mediante el servicio de Caja que 50.00 no cumple el anticipo, 50.01 si lo cumple, y 100.01 completa la liquidacion, manteniendo V1 sin cambios. Los casos V2/V3/V4/V20 de las pruebas de vinculo usan lecturas sustituidas; no implican 20 inspecciones reales recorridas desde navegador.

Los jobs usan exclusivamente PostgreSQL desechable en localhost/visitas_test, sin credenciales productivas. Para reconstruir la base vacia se normaliza un parentesis del DEFAULT exportado de Cliente.folio SOLO en la copia temporal, comprobando destino y patron exactos. El esquema del repositorio y los datos existentes no se modificaron. Los errores SQL esperados de las pruebas negativas estan cubiertos por assert.rejects.

## Dependencias y compilacion

El bloqueo inicial se debia a discrepancias entre package.json y package-lock.json. Se genero un candidato con el mismo manifiesto mediante un workflow de solo lectura, sin scripts de instalacion ni despliegue.

Candidato: artifact 12294797812, run 39489741842, origen c280545a440e77c2a0208503c36f058a1d07198d.
SHA256 del package-lock.json: `fa7447529e01e6305ac1608c4113f877a7f9430cf88536c757c003b060843308`.
Tamano: 381342 bytes. Se agregaron 231 entradas faltantes y zod cambio de 4.4.3 a 4.6.7. No se cambio el manifiesto.

El workflow `visitas-validar-candidato.yml` descarga ese artefacto, comprueba origen, manifiesto y huella y lo usa SOLO en la copia temporal. La instalacion npm ci, Prisma generate, compilacion Next.js completa y lint enumerado aprobaron para el commit 125aeb3 (run/job indicados al inicio).

El candidato NO reemplaza aun el package-lock.json comprometido. Antes de integrar hay que incorporar ese archivo revisado a la raiz de la rama de trabajo y repetir instalacion/compilacion desde el repositorio sin depender del artefacto temporal. No sustituir silenciosamente npm ci por npm install ni publicar para saltar este pendiente.

## Migracion de visitas

La CLI genero en un job anterior `supabase/migrations/20261020192609_visitas_cotizacion_importe.sql`, sin aplicarla a proyectos conectados. Su contenido procede del fixture de CotizacionVisita probado.

El archivo temporal no esta incorporado como migracion de despliegue. Antes de incorporarlo deben revisarse asesores de seguridad, privilegios backend, compatibilidad y procedimiento en ambiente no productivo. No ejecutar el fixture directamente en produccion.

## Pendientes antes de integrar y publicar

1. Incorporar el lockfile revisado y aprobar instalacion/compilacion reproducible desde el repositorio.
2. Revisar escritores alternativos de pagos, anulaciones, cambios de importe y permisos historicos. La proteccion de vinculos descrita arriba ya se incorporo, pero no sustituye esta revision.
3. Incorporar y verificar la migracion de visitas en desarrollo, con revision de seguridad y respaldo/reversion documentados.
4. Recorrer en navegador autenticado: habilitar con importe -> Caja -> abonos -> Nueva Inspeccion -> agenda/zona horaria -> inicio al 100%. Probar anulaciones, reprogramacion, permisos y regresion V1.
5. Completar seguimiento tecnico, conceptos adicionales por visita, fotos V1 izquierda/V2 derecha y reporte/revision/autorizacion.
6. Integracion revisada a develop, validacion en preproduccion y aprobacion expresa antes de main/produccion.

## Historial de evidencia anterior

- f107b0a369479a2c8fee9d717fc8896094b0c406: 22/22 pruebas, run 39483335140/job 118837281778; compilacion normal bloqueada por lockfile.
- 06e9734b3aaaff34f9f626e4ebf31a2c4d742349: 37/37 pruebas, run 39513924418/job 118941383488; compilacion con candidato aprobada, run 39513924320/job 118941383248.
- 125aeb3f04e768bdbf95484b143c2c00758584e6: 53/53 pruebas y compilacion con candidato aprobadas como se indica al inicio.

No se modificaron main, datos reales, variables productivas ni proyectos Supabase conectados. CH_VISITAS_CONTRATADAS permanece apagado por defecto. El PR sigue siendo desarrollo pendiente de liberacion.
