# Adenda operativa - flujo definitivo de cotizaciones, clientes y versiones

Esta adenda complementa `docs/ESPECIFICACION_FUNCIONAL_CERTEZA_HABITACIONAL.md` y prevalece cuando detalle o actualice una regla del flujo comercial. No autoriza despliegues a producción.

## 1. Pre cotización pública: módulo validado y congelado

La PRE COTIZACIÓN pública ya fue probada y validada. No debe modificarse salvo requerimiento posterior estrictamente necesario y aprobado.

Comportamiento vigente validado:

- El cliente recibe PDF.
- `contacto@certezahabitacional.com` recibe la versión editable.
- El vendedor/destinatario adicional queda cubierto mediante el correo adicional configurado por zona.
- Zonas operativas actuales: Ciudad Juárez y Tijuana.
- Guadalajara y Hermosillo permanecen como `próximamente`.
- Mientras sea PRE COTIZACIÓN conserva la identificación/marca correspondiente.

## 2. Ajuste comercial antes de entrar al sistema

La PRE COTIZACIÓN es un borrador comercial externo al flujo operativo interno.

Cuando sea necesario, Administración puede ajustar la versión editable recibida por correo. De ese proceso se obtiene el PDF definitivo de COTIZACIÓN, sin la marca `PRE COTIZACIÓN`.

La incorporación formal al sistema ocurre únicamente cuando DIRECTOR o ADMINISTRADOR cargan ese PDF definitivo en Cotizaciones.

## 3. Incorporación de la cotización definitiva

Al cargar el PDF definitivo el sistema debe:

1. Buscar al cliente existente usando, según disponibilidad, RFC, CURP, correo y teléfono.
2. Si existe una coincidencia inequívoca, reutilizar el mismo Cliente.
3. Si hay coincidencias ambiguas, exigir selección expresa; no duplicar automáticamente.
4. Si no existe cliente, crearlo en ese momento.
5. Buscar/reutilizar el inmueble del mismo cliente cuando corresponda; de lo contrario crear el inmueble.
6. Crear la Cotización formal vinculada al Cliente y al Inmueble.
7. Conservar el PDF definitivo como antecedente documental de la cotización.

La operación debe ser consistente: una falla al almacenar/incorporar el PDF no debe dejar Clientes, Inmuebles o Cotizaciones huérfanos.

## 4. Expediente único del Cliente

No existe creación manual de Clientes desde el panel Clientes.

Cada Cliente tiene un folio único e inmutable, por ejemplo `CH-CLI-2026-000123`.

Una misma persona que contrata inspecciones para varias propiedades conserva:

- un solo Cliente;
- un solo folio de Cliente;
- un solo acceso al portal;
- múltiples Inmuebles, Cotizaciones e Inspecciones relacionados.

El folio no se modifica. Los datos legítimamente cambiantes sí pueden corregirse conforme a permisos: nombre/razón social, teléfono, correo, empresa, RFC, CURP, domicilio, colonia, ciudad, estado, código postal y notas.

Matriz vigente del panel Clientes:

- DIRECTOR: consulta y edición.
- ADMINISTRADOR: consulta; además puede gestionar acceso del cliente.
- VENDEDOR: solo consulta.
- Otros roles internos: sin acceso, salvo cambio posterior aprobado.

## 5. Usuario CLIENTE

El rol CLIENTE no se crea manualmente desde Usuarios.

El Cliente debe existir primero como resultado del flujo de cotización formal. Posteriormente DIRECTOR o ADMINISTRADOR pueden usar `Asignar acceso al sistema` sobre ese mismo expediente para:

- crear las credenciales si aún no existen;
- restablecerlas;
- activar/desactivar el acceso conforme al módulo autorizado.

Nunca debe crearse un segundo Cliente para entregar acceso ni vincular arbitrariamente un usuario CLIENTE de otro expediente.

El mismo acceso sirve después para consultar únicamente información propia liberada conforme a las reglas del portal.

## 6. Recorrido obligatorio de una cotización

Secuencia normal obligatoria:

`PDF definitivo cargado -> BORRADOR formal -> ENVIADA al portal -> CLIENTE ACEPTA -> ACEPTADA -> DIRECTOR/ADMINISTRADOR AUTORIZA -> AUTORIZADA -> CAJA`

Reglas:

- El cliente es el aceptante ordinario.
- La aceptación del cliente y la autorización interna son actos distintos.
- Una cotización no puede llegar a Caja sin aceptación previa y autorización posterior.
- Las acciones históricas que permitan una secuencia diferente deben permanecer bloqueadas del lado servidor.

## 7. Aceptación por excepción

Cuando el cliente no quiera o no pueda realizar la aceptación desde su acceso, DIRECTOR o ADMINISTRADOR pueden registrar una aceptación por excepción.

Debe quedar expresamente registrada como:

`ACEPTACIÓN POR EXCEPCIÓN EN REPRESENTACIÓN DEL CLIENTE`

Debe conservar como mínimo:

- cotización;
- usuario interno que actuó;
- rol;
- fecha y hora;
- motivo obligatorio;
- trazabilidad en auditoría.

La excepción sustituye únicamente el acto de aceptación del cliente. No sustituye la autorización interna posterior.

## 8. Vigencia

Toda cotización formal debe tener fecha de vigencia.

La cotización debe conservarse al menos hasta esa fecha salvo evento administrativo relevante.

No puede:

- enviarse para aceptación si ya está vencida;
- aceptarse por cliente o por excepción si está vencida;
- autorizarse internamente si venció antes de la autorización.

Si se actualizan condiciones o vigencia después del vencimiento, debe preservarse el antecedente y repetirse el recorrido de aceptación que corresponda; no se debe reutilizar una aceptación anterior para condiciones nuevas.

## 9. Caja y pagos

Una Cotización AUTORIZADA entra a Caja.

Caja permite uno o múltiples pagos hasta cubrir el 100%, sin exceder el total autorizado.

Reglas financieras:

- Menos de 50% pagado: no se abre Nueva Inspección.
- DIRECTOR puede autorizar excepción de apertura <50% con motivo y auditoría.
- Menos de 100% pagado: no se inicia inspección en campo.
- DIRECTOR puede autorizar, por separado, excepción de inicio <100% con motivo y auditoría.
- La excepción del 50% y la del 100% son independientes.
- Una excepción financiera no equivale a liquidación y no debe liberar un certificado que requiera pago total.

## 10. Vendedor e inspector

Estado de cuenta requerido:

- Vendedor: comisión base del 10% del importe de la cotización.
- Inspector: comisión base del 30% del importe de la cotización.

El sistema debe mostrar comisión generada, respaldo por cobranza, pagos reales al colaborador y saldo pendiente. El pago real de comisión no debe confundirse con el cobro recibido del cliente.

## 11. V1, V2, V3, V4 y posteriores

Cada versión de inspección requiere su propia cotización y exactamente el mismo recorrido comercial y financiero que V1.

Para cada V2/V3/V4+:

`Cotización propia -> aceptación cliente (o excepción auditada) -> autorización interna -> Caja -> >=50% o excepción Director -> apertura -> 100% o excepción Director -> inicio de campo`

La nueva versión debe conservar antecedentes:

- `inspeccionAnteriorId` apunta al antecedente inmediato: V2->V1, V3->V2, V4->V3.
- La versión anterior inmediata debe estar FINALIZADA antes de abrir la siguiente.
- La nueva cotización debe corresponder al mismo Cliente e Inmueble.
- Una cotización no puede utilizarse para más de una inspección.
- No deben existir dos versiones hijas equivalentes del mismo antecedente.

La existencia de una V1 pagada/autorizada nunca libera automáticamente V2 o posteriores.

## 12. Regla de seguridad de ramas

Todo este flujo se desarrolla y valida fuera de producción:

`codex/<tarea> -> revisión -> develop -> pruebas -> aprobación expresa -> main`

`main` es producción y no debe recibir cambios directos de Codex. Las migraciones de base de datos no se aplican a producción por el solo hecho de existir en una rama o PR.
