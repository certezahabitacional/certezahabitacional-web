# Salida controlada a producción · Inspección de vivienda V2

Estado: **PREPARACIÓN / NO AUTORIZA PRODUCCIÓN**

Este documento organiza la liberación del Método Certeza V1/V2+ y sus controles comerciales. No sustituye la aprobación expresa para desplegar a `main` ni para modificar la base PROD.

## 1. Condiciones previas obligatorias

Antes de liberar:

- El último commit candidato debe tener build Vercel `SUCCESS`.
- No debe existir ningún cambio directo pendiente en `main` que no esté reconciliado con la rama candidata.
- DEV debe conservar las pruebas exitosas de V1 limpia, V2 bloqueada por pendiente heredado y V2 correctamente atendida.
- V1 debe bloquear cierre si no existen los pasos base del protocolo.
- La reapertura de certificado debe invalidar revisiones vigentes, abrir captura y exigir nuevas firmas posteriores a `reabiertaEn`.
- La reactivación debe exigir nueva aprobación, expediente completo, saldo $0.00, ausencia de ajustes comerciales pendientes y ausencia de bloqueo directivo.
- Debe realizarse respaldo/snapshot de PROD antes de aplicar DDL.

## 2. Deriva de historial detectada y reconciliada

PROD registra la migración `fase1_caja_vendedor` (`20260912150026`) y DEV no la registra con ese nombre.

La comprobación de esquema en DEV confirmó que su contenido funcional ya está presente:

- rol `VENDEDOR`;
- tabla `PagoCotizacion`;
- tabla `ObservacionAgenda`;
- `Cotizacion.aceptadaEn`;
- `Cotizacion.excepcionApertura`;
- `Cotizacion.excepcionInicio`.

Por tanto, esta diferencia se considera **deriva de historial y no carencia de esquema**. No se debe reaplicar a ciegas `fase1_caja_vendedor` sobre DEV.

## 3. Orden previsto de SQL nuevo en PROD

Cuando exista autorización expresa, aplicar en este orden lógico:

1. `database/historial_cambios_sistema.sql`
2. `database/ajustes_comerciales.sql`
3. `database/preservar_datos_version_cotizacion_ajuste.sql`
4. `database/inspeccion_vivienda_v2.sql`
5. `database/cierre_v1_v2_seguimiento.sql`

### Razón del orden

`inspeccion_vivienda_v2.sql` crea las tablas base del Método Certeza. Ese archivo contiene además una definición histórica del cierre; por eso `cierre_v1_v2_seguimiento.sql` debe ejecutarse **al final**, para dejar vigente la función endurecida que distingue V1/V2+ y exige el protocolo mínimo V1.

`ajustes_comerciales.sql` ya contiene el índice `AjusteComercial_rechazadoPorId_idx` y los campos de aplicación/versionado, por lo que no debe añadirse una migración duplicada únicamente para ese índice.

## 4. Validaciones de esquema post-migración

Confirmar en PROD, antes de desplegar la aplicación:

- existen `InspeccionControlV2`, `AreaInspeccion`, `ProtocoloInspeccionPaso`, `FotografiaArea`, `VideoInspeccion`, `InterpretacionIAHallazgo` y `OperacionCampoSync`;
- `InspeccionControlV2` contiene `reabiertaEn`, `reabiertaPorId`, `motivoReapertura`, `actualizadoEn`;
- existe `AjusteComercial` con sus índices, incluido `AjusteComercial_rechazadoPorId_idx`;
- RLS está habilitado en las tablas server-only definidas por los scripts;
- la función `validar_evidencia_minima_cierre_inspeccion()` contiene los pasos base `FACHADA_PRINCIPAL`, `HIDRAULICA_INICIO`, `GAS_INICIO`, `RECORRIDO_AREAS`, `HIDRAULICA_CIERRE`, `GAS_CIERRE`, `CIERRE_CAMPO`.

## 5. Pruebas obligatorias antes del merge final

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
- aprobación según jerarquía;
- certificado solo con saldo $0.00.

### V2+

- vínculo al antecedente inmediato;
- todos los pendientes heredados deben tener seguimiento;
- cada seguimiento/nuevo hallazgo debe tener >=4 fotos;
- puede existir cero hallazgo nuevo;
- los resueltos no deben reaparecer como pendientes.

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

## 6. Smoke test posterior al despliegue

Sin usar expedientes reales sensibles, validar:

1. Login y cambio obligatorio de contraseña temporal.
2. Alcance por roles Inspector, Coordinador, Gerente, Director, Administrador y Cliente.
3. Apertura de V1 y navegación por Flujo, Protocolo, Áreas, Evidencias, Firmas y Revisión.
4. Cierre V1 limpio.
5. Flujo V2 de seguimiento.
6. Emisión de certificado.
7. Verificación pública del certificado/QR.
8. Revocación, reapertura, nuevas firmas, reaprobación y reactivación.
9. Bloqueo de certificado con saldo o ajuste pendiente.
10. Portal Cliente solo lectura de información liberada.

## 7. Criterio GO / NO-GO

**GO** únicamente si:

- migraciones aplican sin error;
- build candidato está verde;
- pruebas V1/V2+ y certificado pasan;
- no existen errores de permisos de rol;
- no existen saldos/ajustes que puedan saltarse las barreras de certificado;
- existe aprobación expresa para producción.

Ante cualquier falla: **NO-GO**. No continuar con el merge/despliegue hasta corregir y repetir la prueba afectada.

## 8. Funciones que pueden quedar para una etapa posterior sin bloquear el primer candidato

Siempre que el alcance de lanzamiento lo autorice explícitamente:

- modo offline PWA/IndexedDB completo;
- interpretación IA de hallazgos;
- video operativo completo;
- extracción automática avanzada de PDFs;
- refinamientos no críticos del portal Cliente;
- ajustes visuales del reporte.

Estas funciones no deben confundirse con los controles mínimos de seguridad, cierre técnico, trazabilidad, pago, aprobación y certificado, que sí son obligatorios para el candidato de producción.
