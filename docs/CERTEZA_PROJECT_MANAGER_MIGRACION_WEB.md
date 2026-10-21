# Migración web — Certeza Project Manager v1.9.0

## Objetivo
Migrar Certeza Project Manager desde la aplicación local Python + SQLite a la plataforma web de Certeza, conservando su lógica funcional, trazabilidad y datos.

### Entrada pública
- Sitio: `www.certezahabitacional.com`
- Certeza Técnica: `/certeza-tecnica`
- Acceso a Project Manager: `/project-manager`
- La página pública de Certeza Técnica conserva su portafolio autorizado y agrega un acceso visible a la aplicación.

### Regla de aislamiento
Certeza Project Manager comparte el ecosistema web y autenticación de Certeza, pero sus datos operativos y permisos de proyecto deben permanecer aislados del flujo de Certeza Habitacional.

## Fuente de migración
Versión local validada: **Certeza Project Manager v1.9.0**.

Características verificadas:
- Python con servidor local.
- SQLite: `data/certeza_pm.db`.
- Documentos locales en `documentos/`.
- 67 tablas operativas.
- 2 proyectos en la base fuente.
- Historial, snapshots, decisiones, riesgos, restricciones, presupuesto, programa, EDT, valor y portal del cliente.

## Principios que deben conservarse
1. Mucho análisis detrás, poca información al frente.
2. Capturar una vez y reutilizar la información.
3. Una sola fuente de datos por proyecto.
4. Tres niveles de lectura: operativa, planeación/control y ejecutiva.
5. La IA analiza y recomienda; la decisión final permanece humana.
6. No duplicar alertas o problemas que representan el mismo asunto.
7. Mantener trazabilidad: quién, qué, cuándo, por qué, evidencia y autorización.
8. No sobrescribir silenciosamente información histórica aprobada.
9. Conservar captura manual y Expediente Maestro.
10. Aislar el acceso de cada usuario por proyecto.

## Modelo de acceso de v1.9.0 que debe conservarse
Roles externos:
- CLIENTE_CONSULTA
- CLIENTE_PARTICIPANTE
- CLIENTE_AUTORIZADOR

Permisos por proyecto:
- Ver
- Descargar documentos
- Comentar
- Aprobar/rechazar solicitudes
- Configurar secciones visibles

Secciones compartibles:
- Resumen
- Programa
- Hitos
- Riesgos
- Documentos

Los documentos son internos por defecto y sólo se comparten mediante autorización explícita.

## Arquitectura web objetivo

### Frontend
Next.js / React dentro del repositorio `certezahabitacional-web`.

### Persistencia
PostgreSQL/Supabase. SQLite no debe usarse como almacenamiento productivo en Vercel.

### Autenticación
Reutilizar NextAuth existente para identidad, pero agregar autorización específica de Project Manager por proyecto. No usar únicamente el rol global de Certeza Habitacional para decidir acceso a proyectos.

### Documentos
Migrar archivos de `documentos/` a almacenamiento persistente web. Cada documento conservará:
- Proyecto
- Código
- Tipo
- Revisión
- Estado
- Responsable
- Visibilidad
- Hash
- Archivo vigente
- Historial de versiones

### Auditoría
Los accesos, cambios, aprobaciones, documentos consultados y acciones relevantes deben generar bitácora.

## Migración de datos

### Regla
No modificar la base productiva hasta completar pruebas en desarrollo/preproducción.

### Proceso
1. Inventariar las 67 tablas SQLite.
2. Definir modelos PostgreSQL equivalentes con prefijo/namespace de Project Manager.
3. Crear migración aditiva.
4. Exportar datos de SQLite preservando IDs y relaciones.
5. Importar a base DEV.
6. Comparar conteos por tabla.
7. Verificar claves foráneas y referencias.
8. Verificar archivos/documentos.
9. Verificar resultados de dashboards y reportes.
10. Sólo después preparar promoción a producción.

## Inventario funcional principal
La base v1.9.0 incluye, entre otros:
- projects
- project_settings
- project_baselines
- project_snapshots
- stakeholders
- requirements
- value_milestones
- wbs_items
- activities
- weekly_plan
- budget_items
- cashflow_entries
- earned_value_entries
- resources
- resource_master
- procurements
- supplies
- contracts
- risks
- constraints
- decisions
- change_orders
- quality_items
- documents
- project_raci
- meetings
- meeting_agreements
- incidents
- corrective_actions
- problem_cases
- process_improvements
- lessons_learned
- project_value
- roadmap_items
- access_users
- user_project_access
- portal_sessions
- access_log
- audit_log

## 20 capacidades visuales y operativas obligatorias
Cada una debe cumplir: **concepto visible + icono consistente + función operativa + resultado visible**.

1. Concepto rector
2. Estructura general del sistema
3. Definición y línea base
4. Planeación integrada
5. Ejecución y captura de campo
6. Control integrado
7. Forecast
8. Gestión de riesgos
9. Gestión de restricciones
10. Control de alcance y cambios
11. Tableros multiproyecto
12. Reporte ejecutivo
13. Gestión del alcance
14. Gestión del valor ganado EVM
15. Salud del proyecto
16. Control por excepción y alertas tempranas
17. Productividad y mejora continua
18. Gestión híbrida
19. IA y agentes digitales
20. Hoja de ruta de implementación

## Criterio de aceptación funcional
Una capacidad no se considera migrada si sólo aparece como texto o icono.

Debe existir:
- acceso visible;
- datos reales;
- lógica de negocio;
- permisos;
- trazabilidad cuando aplique;
- resultado calculado/consultable;
- comportamiento responsive;
- prueba de funcionamiento.

## Secuencia segura de implementación
### Etapa A — Entrada y shell web
- Acceso desde Certeza Técnica.
- Ruta `/project-manager`.
- Identidad visual y mapa de 20 capacidades.
- Login y control de sesión.

### Etapa B — Núcleo
- Proyectos.
- Configuración.
- Línea base.
- EDT.
- Programa.
- Presupuesto.
- Riesgos.
- Restricciones.
- Documentos.

### Etapa C — Control
- Avance.
- Productividad.
- EVM.
- Forecast.
- Cambios.
- Decisiones.
- Salud del proyecto.
- Alertas.

### Etapa D — Dirección
- Reporte ejecutivo.
- Portafolio.
- Snapshots.
- Comparativos.
- Centro de atención.

### Etapa E — Portal e inteligencia
- Acceso externo por proyecto.
- Documentos compartidos.
- Solicitudes/aprobaciones.
- Agentes IA.
- Expediente Maestro.
- Automatizaciones.

## Política de despliegue
- `main`: producción.
- `develop`: preproducción.
- Migración actual: `codex/project-manager-web-migration`.
- No promover a `main` sin prueba funcional y autorización expresa.
