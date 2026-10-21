# Visitas contratadas V2, V3 y posteriores

## Estado y alcance
Implementacion para revision en una rama derivada de develop, sincronizada con el historial de main. No autoriza produccion.
La activacion esta apagada salvo CH_VISITAS_CONTRATADAS=1; habilitarla solamente en un ambiente con base aislada y esquema probado.

Regla aprobada: Cotizacion original -> Habilitar siguiente visita con importe contratado obligatorio -> Caja por visita -> Agendar al menos al 50% -> Iniciar al 100%.
No activar desde Inspecciones ni reutilizar los pagos de V1. Las excepciones existentes no se heredan a la visita nueva.

## Registro e integridad
Se conserva el folio base y se agrega el identificador visible ` - V2`, ` - V3`, etc.
Cada visita tiene un registro financiero interno distinto en la tabla Cotizacion para reutilizar Caja, PagoCotizacion y los controles de apertura/inicio existentes sin cambiar la relacion uno-a-uno que protege V1.
Esto NO genera otro consecutivo comercial ni duplica cliente o inmueble. CotizacionVisita relaciona dichos registros con el folio original y el antecedente de inspeccion.
El importe canonico de cada visita es el total de su registro financiero. Nunca se reinicia montoPagado del registro original.
CotizacionVersion sigue representando revisiones documentales; su numero no es el numero de visita.

La activacion requiere usuario Director/Administrador activo, alcance de zona, importe positivo con dos decimales como maximo, confirmacion explicita de contratacion y motivo/alcance.
La representacion del cliente y la autorizacion interna quedan auditadas como eventos distintos, sin heredar la aceptacion de V1.
El antecedente debe estar finalizado y tener aprobacion vigente de Direccion, sin bloqueo. Las activaciones son serializadas por expediente y tienen restricciones unicas de folio, visita y antecedente.
El esquema de pruebas incluye un trigger SECURITY INVOKER que verifica numero, antecedente, cliente, inmueble y zona incluso si se llama a una accion heredada.

## Compatibilidad
Caja consulta el registro de la visita y no el saldo agregado de la familia. Nueva Inspeccion conserva la validacion del 50% y asigna el antecedente desde el servidor. El inicio existente consulta el mismo ID financiero, por lo que exige el 100% de esa visita, salvo las excepciones expresas del flujo vigente.
La pagina de contratacion enlaza Caja e Inspecciones sin publicar nuevas rutas para clientes o vendedores.
No se copian fotografias, firmas, conclusiones ni autorizaciones de reportes.
No hay un limite artificial V2/V3/V4: el numero se deriva del ultimo seguimiento registrado.

## Pruebas y liberacion pendientes
El workflow usa exclusivamente PostgreSQL efimero en localhost/visitas_test; no lee secretos ni aplica migraciones a proyectos conectados.
Prueba importes invalidos, decimales, anticipo exacto, 100%, aislamiento V1/V2, roles/zonas, dos activaciones simultaneas, imposibilidad de cambiar el importe con reintento, referencia V3, auditoria y validacion del antecedente en BD.
Genera el nombre de migracion mediante Supabase CLI. El SQL bajo tests/fixtures es una preparacion de pruebas, NO una instruccion de ejecutar en produccion.
Antes de integrar: confirmar compilacion completa y migracion; comprobar Caja real, abonos/anulaciones, asignacion, agenda/zona horaria e inicio; revisar regresion de V1 y el caso de historicos sin RevisionInspeccion de Direccion.
Antes de publicar: probar en preproduccion con base separada, documentar respaldo/reversion y obtener aprobacion expresa.
La vista fotografica lado a lado, la habilitacion de conceptos adicionales y el reporte tecnico de seguimiento requieren sus propias pruebas funcionales; no se consideran validados por estas pruebas financieras.
