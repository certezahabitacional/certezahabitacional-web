# Especificacion funcional maestra - Certeza Habitacional

## Estado del documento
Este documento define el comportamiento funcional objetivo del sistema Certeza Habitacional y debe considerarse fuente de verdad de negocio para desarrollo en `develop` y ramas derivadas de `develop`.

No autoriza despliegues a produccion. El flujo de liberacion sigue siendo:

`codex/<tarea>` -> revision -> `develop` -> pruebas -> aprobacion expresa -> `main`/produccion.

Cuando exista diferencia entre codigo actual y este documento, no destruir ni sobreescribir comportamiento productivo sin analizar impacto. Implementar de manera incremental y compatible siempre que sea posible.

---

# 1. Pre cotizacion generada desde la pagina publica

La pagina publica debe generar una PRE COTIZACION.

Al generarse, debe enviarse automaticamente a:

1. `contacto@certezahabitacional.com`
2. Correo registrado por el cliente en el formulario correspondiente.
3. Correo del vendedor o usuario registrado como destinatario adicional, cuando aplique.

Formato de envio:

- A `contacto@certezahabitacional.com`: version editable.
- Al cliente: PDF.
- Al vendedor o destinatario adicional: PDF.

Mientras el documento sea una PRE COTIZACION:

- Debe identificarse visualmente como PRE COTIZACION.
- Debe conservar la marca o texto diagonal de "PRE COTIZACION" en todas las paginas del documento.
- No debe considerarse aun una cotizacion formal del sistema.

---

# 2. Conversion de pre cotizacion a cotizacion formal

Cuando el cliente comunique que acepta la pre cotizacion, un usuario con rol DIRECTOR o ADMINISTRADOR debe poder incorporarla al panel de COTIZACIONES.

A partir de ese momento:

- Deja de ser PRE COTIZACION.
- Se convierte en COTIZACION formal.
- Debe desaparecer la marca diagonal de "PRE COTIZACION" en todas las paginas.
- Debe almacenarse en el panel de cotizaciones.

El proceso de incorporacion al sistema debe crear automaticamente, si no existen previamente:

- El CLIENTE correspondiente.
- El INMUEBLE correspondiente.

La creacion automatica debe evitar duplicados. Antes de crear cliente o inmueble, el sistema debe buscar coincidencias seguras con la informacion existente y permitir resolver ambiguedades sin duplicar registros.

Una vez incorporada al panel de cotizaciones, la cotizacion debe permitir la siguiente secuencia:

1. Aceptacion por parte del cliente dentro del sistema.
2. Autorizacion posterior por DIRECTOR o ADMINISTRADOR.

La aceptacion del cliente y la autorizacion interna son eventos distintos y deben quedar auditados.

---

# 3. Usuario del cliente y excepcion de aceptacion

Una vez que la cotizacion, el cliente y el inmueble ya existen en el sistema, DIRECTOR o ADMINISTRADOR pueden generar el usuario y la contrasena del cliente.

El usuario del cliente debe servir inicialmente para:

- Ingresar al sistema.
- Revisar y aceptar la cotizacion correspondiente.

Posteriormente, ese mismo usuario debe permitir acceso exclusivamente a:

- Las inspecciones relacionadas con inmuebles contratados por ese cliente.
- Solo las inspecciones cuyo reporte este cerrado.
- Solo las inspecciones cuyo reporte este autorizado.
- Solo las inspecciones que cuenten con certificado autorizado, cuando el certificado sea requisito de liberacion.

El cliente nunca debe tener acceso a inspecciones de otros clientes o inmuebles no vinculados a su cuenta.

Excepcion:

Si el cliente no desea acceso al sistema o no puede realizar la aceptacion personalmente, DIRECTOR o ADMINISTRADOR pueden registrar la aceptacion como excepcion en nombre del cliente.

La aceptacion por excepcion debe:

- Estar claramente identificada.
- Registrar usuario que la ejecuta.
- Registrar fecha y hora.
- Registrar motivo u observacion.
- Quedar auditada.

---

# 4. Panel Caja

Debe existir un panel denominado `Caja`.

Acceso:

- DIRECTOR: todas las facultades.
- ADMINISTRADOR: todas las facultades.
- Ningun otro rol debe tener acceso.

Ingreso automatico a Caja:

Cada vez que una cotizacion sea AUTORIZADA por DIRECTOR o ADMINISTRADOR, debe incorporarse automaticamente a Caja.

Columnas minimas visibles en el listado de Caja:

- Folio de cotizacion.
- Nombre del cliente.
- Alias del inmueble.
- Vendedor.
- Inspector asignado.
- Importe total de la cotizacion.
- Importe pagado.
- Importe pendiente.

El panel debe permitir filtros por campos relevantes, por ejemplo:

- Folio.
- Cliente.
- Inmueble.
- Vendedor.
- Inspector.
- Estado de pago.
- Zona.
- Rango de fechas.

## 4.1 Registro de pagos

Caja debe permitir registrar uno o multiples pagos por cotizacion hasta cubrir el 100%.

Cada pago debe registrar como minimo:

- Cotizacion asociada.
- Importe.
- Fecha.
- Usuario que registra.
- Referencia o forma de pago si existe en el sistema.
- Observaciones cuando aplique.

El sistema debe calcular automaticamente:

- Total pagado.
- Saldo pendiente.
- Porcentaje pagado.
- Estado de pago.

No se debe permitir que la suma de pagos validos exceda el importe autorizado de la cotizacion, salvo una operacion administrativa expresamente soportada y auditada.

## 4.2 Regla del 50% para abrir Nueva Inspeccion

No se puede abrir una Nueva Inspeccion si el cliente no ha cubierto al menos el 50% del importe de la cotizacion autorizada.

Excepcion:

- Solo DIRECTOR puede autorizar una excepcion para abrir la inspeccion con menos del 50% pagado.
- La excepcion debe quedar auditada y documentada con motivo.

## 4.3 Regla del 100% para iniciar inspeccion en campo

No se puede iniciar una inspeccion en campo si el cliente no ha cubierto el 100% de la cotizacion autorizada.

Excepcion:

- Solo DIRECTOR puede autorizar una excepcion para iniciar en campo sin el 100% pagado.
- Esta excepcion es independiente de la excepcion del 50%.
- El DIRECTOR puede autorizar una, la otra o ambas.
- Cada excepcion debe quedar auditada con usuario, fecha, hora y motivo.

## 4.4 Estado de cuenta de vendedor e inspector

El sistema debe permitir llevar estado de cuenta asociado a cada cotizacion para:

- Vendedor: 10% del importe de la cotizacion.
- Inspector: 30% del importe de la cotizacion.

La base de calculo inicial sera el importe de la cotizacion, salvo que posteriormente se defina una regla distinta.

El sistema debe poder mostrar por persona:

- Cotizaciones relacionadas.
- Base de calculo.
- Porcentaje correspondiente.
- Importe devengado.
- Importe pagado, si se implementa control de pagos de comisiones/honorarios.
- Importe pendiente.

Cualquier cambio futuro en porcentajes debe manejarse de forma historicamente consistente: modificar una configuracion futura no debe alterar retroactivamente registros ya consolidados sin una decision explicita.

---

# 5. Apertura de Nueva Inspeccion y asignacion

Condiciones normales para abrir una Nueva Inspeccion:

- Cotizacion incorporada al sistema.
- Cotizacion aceptada.
- Cotizacion autorizada.
- Cliente creado.
- Inmueble creado.
- Al menos 50% del importe pagado, salvo excepcion autorizada por DIRECTOR.

Al iniciar la captura de una Nueva Inspeccion mediante el folio de cotizacion, el sistema debe cargar automaticamente los datos relevantes de:

- Cliente.
- Inmueble.
- Cotizacion.
- Areas y alcance declarado.
- Zona, cuando exista.
- Vendedor relacionado, cuando aplique.

Debe ser posible capturar o definir:

- Fecha de inspeccion.
- Hora de inspeccion.
- Inspector.
- Zona.
- Participacion de gerente: si/no.
- Gerente, cuando aplique.
- Participacion de coordinador: si/no.
- Coordinador, cuando aplique.
- Observaciones de agenda o preparacion.

## 5.1 Reasignacion

El sistema debe permitir reasignar una inspeccion cuando sea necesario.

La reasignacion debe:

- Conservar historial.
- Registrar inspector anterior.
- Registrar inspector nuevo.
- Registrar usuario que solicita/autoriza segun el flujo vigente.
- Registrar fecha y hora.
- Registrar motivo.
- Respetar el modelo existente de `ReasignacionInspector` y sus estados siempre que sea compatible.

---

# 6. Preparacion tecnica previa a la inspeccion

Antes de la inspeccion debe existir una opcion para cargar documentacion tecnica en PDF.

Categorias de proyecto requeridas:

1. Proyecto arquitectonico.
2. Proyecto de fachadas.
3. Proyecto de instalacion hidraulica.
4. Proyecto de instalacion sanitaria.
5. Proyecto de instalacion de gas.
6. Proyecto de instalacion electrica.
7. Proyecto de puertas y ventanas.
8. Proyecto de acabados.
9. Proyecto de aire acondicionado.
10. Proyecto de voz y datos.
11. Otros proyectos.

Cada categoria debe aceptar PDF y permitir que no exista archivo cuando el cliente no lo proporcione.

## 6.1 Guia de inspeccion derivada de proyectos y cotizacion

El objetivo es estandarizar el procedimiento de inspeccion para que se ejecute de manera consistente en cualquier zona del pais.

A partir de:

- Los proyectos cargados.
- Las areas declaradas en la cotizacion.
- Los criterios estandar del sistema.

el sistema debe generar o permitir construir una guia ordenada de:

- Areas a revisar.
- Conceptos a inspeccionar.
- Instalaciones.
- Especificaciones relevantes.
- Puntos de control.
- Evidencias requeridas.

La guia debe tener una secuencia logica y ordenada.

Siempre debe existir opcion de agregar manualmente conceptos o areas no detectadas por el sistema.

Regla de cobertura:

- Si existen todos los proyectos, estos alimentan la guia junto con los criterios del sistema.
- Si no existen proyectos, rigen las areas y alcances declarados en la cotizacion mas los criterios estandar del sistema.
- Si existen solo algunos proyectos, las areas declaradas en la cotizacion que no queden cubiertas por esos proyectos deben incorporarse mediante los criterios estandar del sistema.

Nunca debe omitirse deliberadamente un area contratada por ausencia de proyecto PDF.

## 6.2 Hallazgos y evidencia fotografica

Todos los hallazgos deben registrarse correctamente y con evidencia suficiente.

Regla operativa objetivo:

- Procurar un minimo de 4 imagenes por hallazgo.

La interfaz debe facilitar esta practica y advertir cuando un hallazgo tenga evidencia insuficiente.

La razon del minimo es permitir que, durante la edicion del reporte, se seleccione la mejor o las mejores imagenes y se descarten las de mala calidad sin quedar sin evidencia.

No debe eliminarse evidencia original de manera destructiva solo por no ser elegida para el reporte final, salvo que exista una funcion explicita, autorizada y auditada para ello.

---

# 7. Principio de implementacion

Conservar, en general, el contenido y estructura actuales del sistema.

No reconstruir modulos completos si pueden extenderse de manera segura.

Agregar o modificar solamente lo necesario para cumplir esta especificacion, procurando:

- Compatibilidad con datos existentes.
- Minimo riesgo para produccion.
- Trazabilidad.
- Auditoria.
- Facilidad de uso.
- Reutilizacion de modelos y flujos existentes.

---

# 8. Matriz de facultades por rol

Las facultades deben aplicarse tanto en interfaz como en servidor. Ocultar botones no sustituye validacion de autorizacion.

Leyenda:

- TODAS: todas las facultades del panel.
- LECTURA: solo consulta.
- PROPIAS: solo informacion propia o asignada segun se especifique.
- SIN ACCESO: no puede ingresar al panel ni ejecutar acciones asociadas.

| PANEL | DIRECTOR | ADMINISTRADOR | GERENTE | COORDINADOR | VENDEDOR | INSPECTOR |
|---|---|---|---|---|---|---|
| Inspecciones | TODAS | LECTURA | LECTURA | SIN ACCESO | LECTURA | LECTURA solo inspecciones propias |
| Clientes | TODAS | LECTURA | SIN ACCESO | SIN ACCESO | LECTURA | SIN ACCESO |
| Inmuebles | TODAS | LECTURA | SIN ACCESO | SIN ACCESO | LECTURA | SIN ACCESO |
| Agenda | TODAS | LECTURA | LECTURA | LECTURA | LECTURA | LECTURA |
| Cotizaciones | TODAS | TODAS | SIN ACCESO | SIN ACCESO | LECTURA | SIN ACCESO |
| Inspectores | TODAS | TODAS | LECTURA | LECTURA | SIN ACCESO | SIN ACCESO |
| Auditoria | TODAS | SIN ACCESO | SIN ACCESO | SIN ACCESO | SIN ACCESO | SIN ACCESO |
| Usuarios | TODAS | TODAS con restriccion de creacion de roles | SIN ACCESO | SIN ACCESO | SIN ACCESO | SIN ACCESO |
| Configuraciones | TODAS | SIN ACCESO | SIN ACCESO | SIN ACCESO | SIN ACCESO | SIN ACCESO |
| Caja | TODAS | TODAS | SIN ACCESO | SIN ACCESO | SIN ACCESO | SIN ACCESO |
| Nueva Inspeccion | TODAS | TODAS | TODAS | SIN ACCESO | SIN ACCESO | SIN ACCESO |

## 8.1 Restriccion especial de ADMINISTRADOR en Usuarios

El ADMINISTRADOR puede administrar usuarios y generar roles, excepto:

- No puede crear usuarios DIRECTOR.
- No puede crear usuarios ADMINISTRADOR.

Solo DIRECTOR puede crear o elevar usuarios a DIRECTOR o ADMINISTRADOR.

Tambien debe impedirse que un ADMINISTRADOR se autoeleve o eleve a otro usuario a roles superiores mediante llamadas directas al servidor.

## 8.2 Rol CLIENTE

Aunque no forma parte de la matriz operativa interna anterior, el rol CLIENTE debe tener acceso estrictamente limitado a:

- Su propia cuenta.
- Sus propias cotizaciones cuando deban ser aceptadas.
- Sus propios inmuebles.
- Sus propias inspecciones liberadas conforme a las reglas del punto 3.
- Sus propios reportes y certificados cuando esten autorizados y disponibles.

El CLIENTE no debe ver paneles administrativos internos como Clientes, Inmuebles globales, Inspectores, Auditoria, Usuarios, Configuraciones o Caja.

---

# 9. Reglas de auditoria obligatoria

Deben quedar auditadas, al menos, las siguientes acciones sensibles cuando se implementen o existan mecanismos de auditoria:

- Conversion de pre cotizacion a cotizacion.
- Aceptacion de cotizacion por cliente.
- Aceptacion por excepcion.
- Autorizacion o rechazo de cotizacion.
- Registro, edicion o anulacion de pagos.
- Excepcion del 50% para apertura de inspeccion.
- Excepcion del 100% para inicio en campo.
- Creacion y cambios de usuario/rol.
- Reasignacion de inspector.
- Inicio y cierre de inspeccion.
- Revision y autorizacion de reportes.
- Emision, revocacion o reactivacion de certificados.
- Eliminacion o alteracion sensible de evidencia.

---

# 10. Orden recomendado de implementacion

Para reducir riesgo, Codex debe preferir este orden salvo instruccion distinta:

1. Auditoria del estado actual contra esta especificacion.
2. Matriz de permisos y autorizacion server-side.
3. Flujo pre cotizacion -> cotizacion -> cliente/inmueble.
4. Usuario cliente y aceptacion/excepcion.
5. Autorizacion de cotizacion.
6. Caja y pagos.
7. Reglas 50%/100% y excepciones.
8. Nueva Inspeccion y carga automatica desde cotizacion.
9. Reasignacion y agenda.
10. Carga de proyectos PDF.
11. Guia estandarizada de inspeccion.
12. Evidencia minima por hallazgo.
13. Estados de cuenta de vendedor e inspector.
14. Pruebas integrales y regresion.

Cada etapa debe probarse en `develop` antes de pasar a la siguiente cuando exista dependencia funcional significativa.
