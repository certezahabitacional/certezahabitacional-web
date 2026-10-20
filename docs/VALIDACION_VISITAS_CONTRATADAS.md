# Validacion del cambio de visitas contratadas

## Estado verificado el 20 de octubre de 2026
PR 256; rama `codex/visitas-importe-contratado`; destino `develop`.
Ultimo commit de codigo probado: `06e9734b3aaaff34f9f626e4ebf31a2c4d742349`.
Este documento registra resultados de desarrollo, NO una liberacion a produccion.

| Verificacion | Evidencia | Resultado |
| --- | --- | --- |
| Pruebas de visitas, Caja, concurrencia y formularios/acciones aislados | Run 39513924418; job 118941383488 | 37 ejecutadas, 37 aprobadas, 0 fallidas, 0 omitidas |
| Compilacion completa Next.js con candidato de dependencias verificado | Run 39513924320; job 118941383248 | Aprobada, sin saltar TypeScript |
| Lint de las rutas y servicios de visitas incluidos en ese workflow | Run 39513924320; job 118941383248 | Aprobado para los archivos enumerados; no equivale a lint de todo el repositorio |
| Instalacion con el package-lock.json comprometido en la rama | Todavia contiene el archivo anterior, no el candidato | Correccion pendiente de incorporacion |
| Recorrido autenticado en navegador y comparativo fotografico | No ejecutado como parte de estos jobs | Pendiente |

## Cambios comprobados de Caja

Archivos de aplicacion: `lib/caja-operaciones.ts`, `app/panel/caja/actions.ts` y `app/panel/caja/page.tsx`.
Pruebas nuevas: `tests/visitas-caja.test.cjs` y `tests/visitas-caja-interfaz.test.cjs`.
Workflow de pruebas: `.github/workflows/visitas-caja.yml`.

- El servicio vuelve a comprobar usuario activo, rol, zona y cotizacion AUTORIZADA. Direccion y Administracion pueden registrar abonos; solo Direccion puede autorizar excepciones del 50% o 100%.
- El saldo se lee despues de bloquear el registro financiero de la visita dentro de la transaccion. Dos abonos simultaneos no pierden actualizaciones ni exceden lo contratado en los casos probados.
- Cada formulario incorpora una clave UUID de operacion. Reenviar la misma clave con los mismos datos devuelve el pago existente; cambiar sus datos, usuario o cotizacion se rechaza. La presentacion de celular y la de escritorio comparten la clave del mismo formulario renderizado.
- Esta proteccion distingue operaciones por clave: no deduplica automaticamente dos formularios independientes con claves nuevas ni determina si dos transferencias bancarias son la misma.
- Pago, saldo y auditoria se guardan en una sola transaccion. La prueba de fallo de auditoria confirma la reversion tanto del abono como del saldo.
- Se validan importes positivos a centavos; no se aceptan numeros negativos, cero, notacion exponencial ni mas de dos decimales.
- Las cotizaciones canceladas no admiten pagos ni excepciones por estas acciones. No se borran pagos historicos ni se reinicia el acumulado de V1.
- Las excepciones de apertura e inicio son independientes y conservan su motivo original ante reintentos. La excepcion de inicio de V2 se sincroniza solo con la inspeccion asociada a V2.
- Administracion ya no recibe formularios de autorizacion de excepciones; el servidor tambien rechaza su llamada directa. No se revocaron automaticamente excepciones historicas ya registradas.
- La accion toma el usuario de la sesion, no del formulario, y actualiza las vistas de Caja, Cotizaciones, Nueva Inspeccion, Agenda e Inspecciones despues de guardar.

La clave utiliza el campo String `PagoCotizacion.id` existente con prefijo `caja-`; estos controles de pagos no agregan una migracion nueva. Otras rutas que escriban pagos o acumulados deben revisarse antes de asegurar concurrencia global de toda la plataforma.

## Composicion y alcance de las 37 pruebas

- 21 pruebas unitarias de importes y umbrales.
- 1 escenario de persistencia de V2/V3, con multiples verificaciones de relaciones, autorizacion, concurrencia de activacion, auditoria y conservacion de evidencia.
- 8 escenarios de Caja con PostgreSQL: permisos, validacion monetaria, reintentos, concurrencia, sobrepago, reversion ante fallo, cotizaciones canceladas y excepciones por visita.
- 7 pruebas que ejecutan el codigo real de pagina y acciones de Caja con dependencias sustituidas: claves de ambos formularios, visibilidad por rol, rechazo de inspector, identidad del actor, actualizacion de vistas y propagacion de errores.

Estas ultimas siete no abren un navegador ni prueban NextAuth: sustituyen sesion, Prisma y componentes de presentacion. No son una validacion visual ni un recorrido completo autenticado.

El escenario de V2 por 100.01 confirma mediante el servicio de Caja que 50.00 no cumple el anticipo, 50.01 si lo cumple, y 100.01 completa la liquidacion, manteniendo V1 sin cambios. No prueba todavia los botones reales de Agendar e Iniciar en navegador.

Los jobs de persistencia usan exclusivamente PostgreSQL desechable en localhost/visitas_test, sin credenciales productivas. Para reconstruir la base vacia se normaliza un parentesis del DEFAULT exportado de Cliente.folio SOLO en la copia temporal, con verificacion del destino y patron exacto. El esquema real del repositorio y los datos existentes no se modificaron. Los errores SQL esperados de pruebas negativas estan cubiertos por assert.rejects.

## Dependencias y compilacion: distincion obligatoria

El bloqueo inicial se debia a discrepancias entre package.json y package-lock.json. Se genero y reviso un candidato con el mismo manifiesto mediante un workflow de solo lectura, sin scripts de instalacion ni despliegue.

Candidato: artifact 12294797812, run 39489741842, origen c280545a440e77c2a0208503c36f058a1d07198d.
SHA256 del package-lock.json: `fa7447529e01e6305ac1608c4113f877a7f9430cf88536c757c003b060843308`.
Entre los paquetes preexistentes cambio zod de 4.4.3 a 4.6.7; tambien se incorporaron dependencias faltantes. No se cambio el manifiesto del proyecto.

El workflow `visitas-validar-candidato.yml` descarga exclusivamente ese artefacto, comprueba identidad, manifiesto y huella, y usa el candidato SOLO en su copia temporal. `npm ci`, Prisma generate y `npm run build` completo aprobaron tanto el codigo previo 8d1aa7c (run 39491054739/job 118864037299) como el codigo de Caja 06e9734 (run 39513924320/job 118941383248).

El candidato aun NO reemplaza el package-lock.json comprometido. Por ello, el check que instala directamente el lockfile anterior no queda aprobado por estos resultados. Antes de integrar hay que incorporar el archivo revisado y repetir la instalacion/compilacion desde el repositorio sin depender de un artefacto temporal, que tiene caducidad. No sustituir silenciosamente npm ci por npm install.

## Migracion de visitas

La CLI genero en un job anterior `supabase/migrations/20261020192609_visitas_cotizacion_importe.sql`, sin aplicarla a proyectos conectados. Su contenido procede del fixture de CotizacionVisita probado.

El archivo temporal no esta incorporado como migracion de despliegue al repositorio. Antes de incorporarlo deben revisarse asesores de seguridad, privilegios del rol backend, compatibilidad y procedimiento en un ambiente no productivo. No ejecutar el fixture directamente en produccion.

## Pendientes antes de integrar y publicar

1. Incorporar el lockfile candidato revisado y aprobar la instalacion/compilacion reproducible desde el repositorio.
2. Completar respuesta cerrada ante ausencia o inconsistencia de CotizacionVisita; no tratar una V2 como V1 por falta de metadatos. Revisar escritores alternativos de pagos, anulaciones, cambios de importe y permisos historicos.
3. Incorporar y verificar la migracion de visitas en desarrollo, con revision de seguridad y respaldo/reversion documentados.
4. Recorrer en navegador autenticado: habilitar visita con importe -> Caja -> abonos -> Nueva Inspeccion -> agenda con zona horaria -> inicio al 100%. Probar tambien anulaciones, reprogramacion, permisos y regresion de V1.
5. Completar seguimiento tecnico, habilitacion por visita de conceptos adicionales, comparacion fotografica V1 izquierda/V2 derecha y reporte/revision/autorizacion. No se consideran terminados por las pruebas financieras.
6. Integracion revisada a develop, validacion en preproduccion y aprobacion expresa antes de cualquier promocion a main/produccion.

## Historial de evidencia anterior

El commit f107b0a369479a2c8fee9d717fc8896094b0c406 obtuvo 22/22 pruebas aprobadas en run 39483335140/job 118837281778. Incluia rechazo de importes invalidos, activacion V2/V3, pagos independientes, prevencion de visitas duplicadas, auditoria, RLS y evidencia V1 conservada sin presentarla como fotografia de V2. La compilacion normal de ese run se detuvo en npm ci (job 118837282240). Ese resultado permanece como antecedente, no como el estado mas reciente de las pruebas ampliadas.

No se modificaron main, datos reales, variables productivas ni proyectos Supabase conectados en esta etapa. CH_VISITAS_CONTRATADAS permanece apagado por defecto. El PR sigue siendo desarrollo pendiente de liberacion.
