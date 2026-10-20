# Validacion del cambio de visitas contratadas

## Bloqueo detectado en el proyecto base
El primer workflow de PR 256 fallo antes de ejecutar las pruebas porque package.json y package-lock.json del proyecto ya no coinciden. Faltan, entre otras, las dependencias de Capacitor, Chromium y Puppeteer en el lockfile. No se cambiaron estos archivos como parte del desarrollo de V2.

No resolverlo sustituyendo silenciosamente npm ci por npm install en la compilacion de la aplicacion: cambiaria dependencias sin revisar. El job compilacion conserva npm ci y debe pasar antes de integrar o publicar.

Para poder verificar la logica nueva independientemente de ese bloqueo, el job pruebas copia solamente Prisma, los servicios de visitas, el calculo existente de Caja y las pruebas a un directorio temporal. Instala herramientas de prueba con versiones exactas y usa una base PostgreSQL desechable local. Esto NO representa una compilacion completa ni una prueba de interfaz de la aplicacion.

## Pendiente antes de integrar
- Sincronizar y revisar el lockfile del proyecto en un cambio controlado; no publicar dependencias actualizadas sin verificar.
- Obtener exito tanto en pruebas como en compilacion completa.
- Incorporar y revisar la migracion generada con CLI; no ejecutar el fixture de pruebas en produccion.
- Prueba funcional autenticada de cotizacion -> Caja -> agenda -> inicio.
- Confirmar seguimiento tecnico y comparacion fotografica en un cambio separado.

Produccion y sus datos permanecen sin modificar. La funcion esta deshabilitada por defecto.
