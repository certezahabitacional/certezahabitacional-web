# Validacion del cambio de visitas contratadas

## Resultado verificado el 20 de octubre de 2026
PR: 256, rama codex/visitas-importe-contratado, destino develop.
Commit de codigo probado: f107b0a369479a2c8fee9d717fc8896094b0c406.
Workflow: Visitas contratadas - pruebas aisladas, ejecucion 39483335140.
Job de pruebas: 118837281778.

Resultado de node --test: 22 pruebas ejecutadas, 22 aprobadas, 0 fallidas, 0 omitidas. Son 21 pruebas unitarias de importes y 1 escenario de integracion con PostgreSQL que contiene multiples comprobaciones.

Comprobaciones ejecutadas:
- Rechazo de importe vacio, cero, negativo, no numerico, fuera de rango o con mas de dos decimales.
- Calculo de anticipo minimo del 50% y liquidacion del 100%, con redondeo del medio centavo hacia arriba.
- Creacion y persistencia de V2 y V3 con el folio base y el importe particular de cada visita.
- V2 inicia sin pagos ni excepciones heredadas de V1; registrar un pago de prueba en V2 no modifica el importe ni el monto pagado de V1.
- Dos solicitudes simultaneas devuelven la misma V2 y no duplican el registro ni la auditoria.
- Repetir la contratacion por otro importe se rechaza en vez de sobreescribirla.
- Rechazo de contratacion por Inspector o Administrador sin la zona requerida.
- Bloqueo de numeracion falsa y de desvincular una inspeccion de su cotizacion de visita.
- Evidencia de prueba de V1 conservada y no presentada como fotografia de V2.
- RLS habilitada en CotizacionVisita.

Los errores SQL de las pruebas negativas son esperados y estan cubiertos por assert.rejects. No son fallas de la suite.

## Alcance y limitaciones de estas pruebas
El job copia los servicios de visitas, el calculo existente de Caja, el esquema Prisma y las pruebas a RUNNER_TEMP/visitas-ci. Instala herramientas de prueba con versiones exactas y usa exclusivamente PostgreSQL desechable en localhost/visitas_test. No utiliza credenciales productivas.

Para reconstruir esa base vacia se normaliza un parentesis exterior faltante en el DEFAULT exportado de Cliente.folio, SOLO en la copia temporal. El script verifica el destino y el patron exacto y falla si cambiaron. La prueba crea un cliente sin indicar folio y verifica el formato generado. No se modifico prisma/schema.prisma del repositorio ni el DEFAULT de ninguna base existente.

La compilacion de los tres servicios TypeScript probados paso. Esto NO equivale a compilar Next.js completo ni a recorrer las pantallas autenticadas de Caja, agenda e inicio. El pago del escenario de persistencia se inserta mediante Prisma; no prueba el formulario de registro de pagos.

## Migracion
La CLI genero en el job de prueba el nombre:
`supabase/migrations/20261020192609_visitas_cotizacion_importe.sql`.

La generacion fue exitosa, sin aplicar el archivo a proyectos conectados. Su contenido procede del fixture probado. El archivo temporal no esta incorporado como migracion de despliegue al repositorio. Antes de incorporarlo deben revisarse asesores de seguridad, privilegios del rol backend, compatibilidad y procedimiento de migracion en un ambiente no productivo. No ejecutar el fixture directamente en produccion.

## Bloqueo que permanece en la compilacion completa
Job de compilacion: 118837282240, misma ejecucion 39483335140.
La instalacion reproducible con npm ci falla antes de compilar porque package.json y package-lock.json del proyecto no coinciden. Faltan, entre otras, dependencias de Capacitor, Chromium y Puppeteer. Los archivos de dependencias de la aplicacion no se han modificado en este PR.

No sustituir silenciosamente npm ci por npm install ni dar la compilacion por aprobada. Es necesario sincronizar el lockfile mediante un cambio revisable, manteniendo las versiones apropiadas, antes de integrar o publicar.

## Pendiente antes de integrar
- Resolver y revisar el lockfile; obtener compilacion completa satisfactoria.
- Completar revision de seguridad, incluida respuesta cerrada ante ausencia o inconsistencia del vinculo de visita; no tratar V2 como V1 por falta de metadatos.
- Incorporar y comprobar la migracion en ambiente aislado, sin afectar produccion.
- Recorrido funcional autenticado: contratacion -> Caja -> abonos -> Nueva Inspeccion -> agenda -> inicio.
- Verificar permisos y limites de pago en las acciones completas, no solo en servicios de calculo.
- Completar seguimiento tecnico y comparacion fotografica V1 izquierda / V2 derecha en su etapa correspondiente. No se consideran completados por el cambio financiero.

Produccion y sus datos no fueron modificados en esta tarea. CH_VISITAS_CONTRATADAS permanece apagado por defecto. El PR sigue siendo una propuesta en desarrollo, no una liberacion operativa.
