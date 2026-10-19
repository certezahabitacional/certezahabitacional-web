# Certeza Habitacional - preparación de TestFlight

## Identidad de la aplicación

- Nombre: Certeza Habitacional
- Bundle ID: `com.certezahabitacional.app`
- Versión inicial: `1.0.0`
- El número de build se toma automáticamente de GitHub Actions para evitar duplicados en TestFlight.

## Configuración requerida en Apple

1. La empresa debe tener activa una membresía de Apple Developer.
2. En Certificates, Identifiers & Profiles, registrar el App ID explícito `com.certezahabitacional.app`.
3. En App Store Connect, crear la aplicación iOS con el mismo Bundle ID.
4. El Account Holder debe habilitar acceso a App Store Connect API si todavía no está habilitado.
5. En App Store Connect > Users and Access > Integrations > App Store Connect API, crear una Team API Key con permisos suficientes para administrar builds.
6. Descargar el archivo privado `.p8`. Apple permite descargarlo una sola vez; debe conservarse de forma segura.

## Secretos de GitHub requeridos

Configurar en el repositorio, dentro de Actions secrets:

- `APPLE_TEAM_ID`: Team ID del Apple Developer Program.
- `ASC_KEY_ID`: Key ID de la App Store Connect API Key.
- `ASC_ISSUER_ID`: Issuer ID de la App Store Connect API.
- `ASC_PRIVATE_KEY`: contenido completo del archivo privado `.p8`.

Nunca subir la llave `.p8` al repositorio.

## Flujo

El workflow `iOS TestFlight` se ejecuta manualmente desde GitHub Actions. Genera el proyecto iOS con Capacitor, configura permisos, firma automáticamente con Apple, crea el archive Release y lo envía a App Store Connect/TestFlight.

La ejecución sólo debe lanzarse cuando el Bundle ID exista en Apple y los cuatro secretos estén configurados.
