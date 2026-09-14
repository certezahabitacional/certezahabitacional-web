# Salida controlada a producción · Inspección de vivienda V2

Estado: **GO TÉCNICO / PENDIENTE AUTORIZACIÓN EXPRESA PARA PROD**

Este documento organiza la liberación del Método Certeza V1/V2+, sus controles comerciales y el nuevo alcance operativo por asignación directa de cada inspección. No sustituye la aprobación expresa para desplegar a `main` ni para modificar la base PROD.

## 1. Condiciones previas obligatorias

Antes de liberar:

- El último commit candidato debe tener build Vercel `SUCCESS`.
- No debe existir ningún cambio directo pendiente en `main` que no esté reconciliado con la rama candidata.
- DEV debe conservar las pruebas exitosas de V1 limpia, V2 bloqueada por pendiente heredado y V2 correctamente atendida.
- V1 debe bloquear cierre si no existen los pasos base del protocolo.
- `ProtocoloInspeccionPaso` debe garantizar unicidad por `("inspeccionId", "clave")` para que la inicialización V1 con `ON CONFLICT` sea idempotente.
- La reapertura de certificado debe invalidar revisiones vigentes, abrir captura y exigir nuevas firmas posteriores a `reabiertaEn`.
- La reactivación debe exigir nueva aprobación, expediente completo, saldo $0.00, ausencia de ajustes comerciales pendientes y ausencia de bloqueo directivo.
- Inspector, Coordinador y Gerente deben resolver su acceso técnico por asignación directa a cada inspección, no por una jerarquía permanente en `Usuario`.
- Debe realizarse respaldo/snapshot de PROD antes de aplicar DDL.

## 2. Estado real de PROD antes de liberar

Validación previa realizada contra el esquema PROD el 14 de septiembre de 2026:

- `DocumentoProyectoInspeccion`, `GuiaInspeccionItem`, `SeleccionEvidenciaReporte` y `CotizacionVersion` existen.
- `Inspeccion.numeroInspeccion` e `Inspeccion.inspeccionAnteriorId` existen.
- `Hallazgo.hallazgoAnteriorId`, `estadoSeguimiento`, `observacionSeguimiento` y `resuelto` existen.
- Actualmente existe **1 inspección real** en PROD: `CH-2026-0001`, estado `PROGRAMADA`, V1, sin Inspector asignado, zona Ciudad Juárez, con `requiereGerenteZona=false` y `requiereCoordinador=false`.
- Actualmente existen **0 usuarios activos** con rol Inspector, Coordinador o Gerente y **0 usuarios** de esos roles con jerarquías `gerenteId/coordinadorId` que deban convertirse.
- `AsignacionRolInspeccion` y su trigger de sincronización todavía no existen en PROD.
- `InspeccionControlV2` y `AjusteComercial` todavía no existen en PROD.
- Existe el trigger histórico `trg_validar_evidencia_minima_cierre_inspeccion` sobre `Inspeccion.estado`.
- La función histórica de cierre exige al menos un hallazgo; será reemplazada al final del paquete por la función V1/V2+ endurecida.

La inspección existente no será modificada funcionalmente por la migración de asignaciones: al no tener Inspector ni requerir Gerente/Coordinador, no se crearán asignaciones artificiales ni se cambiará su estado. Dirección conserva alcance global para administrarla después de la migración.

## 3. Deriva de historial detectada y reconciliada

PROD registra la migración `fase1_caja_vendedor` (`20260912150026`) y DEV no la registra con ese nombre.

La comprobación de esquema en DEV confirmó que su contenido funcional ya está presente:

- rol `VENDEDOR`;
- tabla `PagoCotizacion`;
- tabla `ObservacionAgenda`;
- `Cotizacion.aceptadaEn`;
- `Cotizacion.excepcionApertura`;
- `Cotizacion.excepcionInicio`.

Por tanto, esta diferencia se considera **deriva de historial y no carencia de esquema**. No se debe reaplicar a ciegas `fase1_caja_vendedor` sobre DEV.

## 4. Orden definitivo de SQL nuevo en PROD

Cuando exista autorización expresa, aplicar en este orden lógico:

1. `database/historial_cambios_sistema.sql`
2. `database/ajustes_comerciales.sql`
3. `database/preservar_datos_version_cotizacion_ajuste.sql`
4. `database/inspeccion_vivienda_v2.sql`
5. `database/protocolo_clave_unica.sql`
6. `database/asignacion_roles_por_inspeccion.sql`
7. `database/cierre_v1_v2_seguimiento.sql`

### Razón del orden

`historial_cambios_sistema.sql` crea la bitácora estructurada e inmutable utilizada por los nuevos flujos.

`ajustes_comerciales.sql` crea la estructura comercial antes de que la aplicación intente registrar cargos o descuentos. Ese archivo ya contiene el índice `AjusteComercial_rechazadoPorId_idx` y los campos de aplicación/versionado, por lo que no debe añadirse una migración duplicada únicamente para ese índice.

`preservar_datos_version_cotizacion_ajuste.sql` instala el trigger que conserva el snapshot completo al crear una versión por ajuste comercial.

`inspeccion_vivienda_v2.sql` crea las tablas base del Método Certeza y agrega los metadatos requeridos a estructuras existentes.

`protocolo_clave_unica.sql` garantiza explícitamente la unicidad de `("inspeccionId", "clave")`, incluso si la tabla ya existiera por una recuperación o despliegue parcial. Esta protección es necesaria para la inicialización idempotente del protocolo V1.

`asignacion_roles_por_inspeccion.sql` crea la relación única por inspección para Gerente, Coordinador e Inspector, preserva cualquier vínculo histórico antes de limpiar la jerarquía permanente de Coordinadores/Inspectores y deja un trigger para mantener sincronizado al Inspector cuando cambie `Inspeccion.inspectorId`.

`inspeccion_vivienda_v2.sql` contiene además una definición histórica/intermedia de la función de cierre; por eso `cierre_v1_v2_seguimiento.sql` debe ejecutarse **siempre al final**, dejando vigente la lógica endurecida V1/V2+.

## 5. Validaciones de esquema post-migración

Confirmar en PROD, antes de desplegar la aplicación:

- existen `InspeccionControlV2`, `AreaInspeccion`, `ProtocoloInspeccionPaso`, `FotografiaArea`, `VideoInspeccion`, `InterpretacionIAHallazgo` y `OperacionCampoSync`;
- `InspeccionControlV2` contiene `reabiertaEn`, `reabiertaPorId`, `motivoReapertura`, `actualizadoEn`;
- existe `AjusteComercial` con sus índices, incluido `AjusteComercial_rechazadoPorId_idx`;
- existe el índice único `ProtocoloInspeccionPaso_inspeccionId_clave_key` sobre `("inspeccionId", "clave")`;
- existe `AsignacionRolInspeccion`, con unicidad por `("inspeccionId", "rol")`;
- existe el trigger `trg_sincronizar_asignacion_inspector_inspeccion` sobre `Inspeccion.inspectorId`;
- la inspección `CH-2026-0001` conserva su estado `PROGRAMADA`, su zona y `inspectorId=null` después de migrar;
- RLS está habilitado en las tablas server-only definidas por los scripts;
- el trigger `trg_validar_evidencia_minima_cierre_inspeccion` sigue asociado a `Inspeccion.estado`;
- la función `validar_evidencia_minima_cierre_inspeccion()` contiene los pasos base `FACHADA_PRINCIPAL`, `HIDRAULICA_INICIO`, `GAS_INICIO`, `RECORRIDO_AREAS`, `HIDRAULICA_CIERRE`, `GAS_CIERRE`, `CIERRE_CAMPO`;
- la función distingue V1 de V2+ y conserva compatibilidad con expedientes históricos.

## 6. Pruebas obligatorias antes del merge final

### V1 limpia

- vivienda sin defectos;
- áreas obligatorias revisadas;
- >=4 fotos por área obligatoria;
- fachada marcada para portada;
- protocolo mínimo completo;
- hidráulica/gas con inicio y cierre coherentes o ambos `NO_APLICA`;
- debe cerrar sin crear hallazgos ficticios.

### V1 con hallazgos

- hallazgos reales con evidencia;
- cierre técnico completo;
- firmas Inspector y Cliente;
- aprobación según asignación operativa de la inspección;
- certificado solo con saldo $0.00.

### V2+

- vínculo al antecedente inmediato;
- todos los pendientes heredados deben tener seguimiento;
- cada seguimiento/nuevo hallazgo debe tener >=4 fotos;
- puede existir cero hallazgo nuevo;
- los resueltos no deben reaparecer como pendientes.

### Asignaciones por inspección

- crear Inspector sin Gerente ni Coordinador permanentes;
- crear inspección sin Gerente/Coordinador cuando el flujo no los requiere;
- asignar Inspector, Coordinador y Gerente de forma independiente por inspección;
- Inspector solo puede listar/abrir expedientes donde está asignado;
- Coordinador solo puede listar/abrir/revisar expedientes donde está asignado;
- Gerente solo puede listar/abrir/aprobar expedientes donde está asignado;
- APIs deben devolver 403 ante un usuario técnico no asignado aunque pertenezca a la misma zona;
- Dirección conserva alcance global y Administración conserva alcance administrativo;
- al reasignar Inspector debe actualizarse `AsignacionRolInspeccion` automáticamente;
- los expedientes históricos sin filas de asignación mantienen fallback compatible donde corresponda.

### Revocación y reapertura

- solo Dirección revoca;
- certificado queda no vigente;
- inspección vuelve a `EN_PROCESO`;
- revisiones vigentes quedan invalidadas;
- `capturaCerrada=false` y se registra `reabiertaEn`;
- las firmas históricas se conservan pero no cuentan para la nueva aprobación;
- deben capturarse nuevas firmas posteriores a la reapertura;
- tras nuevo cierre/aprobación, reactivar solo si saldo $0.00 y no hay ajustes pendientes.

### Ajustes comerciales

- descuento: autorización exclusiva de Dirección;
- cargo: autorización según matriz vigente;
- aceptación de cliente cuando corresponde;
- el ajuste solo puede aplicarse sobre la versión de cotización contra la que fue aceptado/autorizado;
- se conserva el snapshot previo y pagos históricos;
- `subtotal = precioBase + cargoMetrosAdicionales + cargosExtra`;
- `total = subtotal - descuento` (con las reglas comerciales vigentes del flujo);
- cualquier saldo o ajuste sin resolver bloquea certificado.

## 7. Smoke test posterior al despliegue

Sin modificar la inspección real existente salvo que se decida expresamente usarla para operación, validar:

1. Login y cambio obligatorio de contraseña temporal.
2. Creación de usuarios Inspector, Coordinador y Gerente sin jerarquía permanente obligatoria.
3. Creación de una inspección de prueba con asignaciones directas.
4. Alcance por roles Inspector, Coordinador, Gerente, Director, Administrador y Cliente.
5. Intento de acceso a un expediente no asignado por UI y API.
6. Apertura de V1 y navegación por Flujo, Protocolo, Áreas, Evidencias, Firmas y Revisión.
7. Inicialización repetida del protocolo V1 sin duplicar pasos.
8. Cierre V1 limpio.
9. Flujo V2 de seguimiento.
10. Emisión de certificado.
11. Verificación pública del certificado/QR.
12. Revocación, reapertura, nuevas firmas, reaprobación y reactivación.
13. Bloqueo de certificado con saldo o ajuste pendiente.
14. Portal Cliente solo lectura de información liberada.

## 8. Criterio GO / NO-GO

**GO técnico previo a PROD** cuando:

- build candidato está verde;
- rama candidata no está detrás de `main`;
- DEV contiene el esquema V1/V2 completo y `AsignacionRolInspeccion`;
- las pruebas de cierre, reapertura, firmas, certificado y alcance por asignación pasan;
- no existe un bloqueador funcional conocido.

**GO de despliegue a PROD** únicamente si además:

- existe autorización expresa del responsable;
- existe respaldo/snapshot o punto de recuperación de PROD;
- las siete migraciones aplican sin error y en el orden definido;
- las validaciones post-migración son correctas;
- el despliegue del mismo commit candidato queda verde;
- el smoke test posterior pasa completo.

Ante cualquier falla: **NO-GO**. No continuar con el siguiente paso hasta corregir o revertir la etapa afectada.

## 9. Funciones que pueden quedar para una etapa posterior sin bloquear el primer candidato

Siempre que el alcance de lanzamiento lo autorice explícitamente:

- modo offline PWA/IndexedDB completo;
- interpretación IA de hallazgos;
- video operativo completo;
- extracción automática avanzada de PDFs;
- refinamientos no críticos del portal Cliente;
- ajustes visuales del reporte.

Estas funciones no deben confundirse con los controles mínimos de seguridad, cierre técnico, trazabilidad, pago, aprobación, alcance por asignación y certificado, que sí son obligatorios para el candidato de producción.
