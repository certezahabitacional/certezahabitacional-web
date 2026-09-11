<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This project uses Next.js 16.2.12 and may contain breaking changes relative to older Next.js conventions. Before changing framework-specific behavior, read the relevant guide in `node_modules/next/dist/docs/` and heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Certeza Habitacional - Codex working instructions

## PRIORIDAD MAXIMA: produccion, develop y aprobacion
Certeza Habitacional esta entrando en operacion real. La continuidad y estabilidad de produccion tienen prioridad sobre la velocidad de desarrollo.

- `main` representa PRODUCCION y debe considerarse estable.
- `develop` representa DESARROLLO / PREPRODUCCION y es el destino normal de los cambios una vez revisados.
- Codex NO debe desarrollar directamente sobre `main`.
- Codex debe trabajar en ramas temporales o especificas de tarea, idealmente derivadas de `develop`.
- Flujo normal: `codex/<tarea>` -> revision -> `develop` -> pruebas funcionales/tecnicas -> aprobacion expresa del responsable del proyecto -> `main`.
- NUNCA fusionar, promover, desplegar o copiar cambios de `develop` a `main` sin aprobacion expresa del responsable del proyecto.
- Que una tarea compile, pase lint o parezca correcta NO constituye aprobacion para produccion.
- No aplicar directamente a produccion cambios de Prisma/base de datos, autenticacion, autorizacion, roles, pagos, cotizaciones, inspecciones, reportes, certificados, variables de entorno o configuracion de infraestructura como parte de una tarea ordinaria.
- Antes de iniciar una tarea nueva, comprobar que la rama de trabajo parte del `develop` vigente, salvo instruccion expresa en contrario.
- Si `main` contiene cambios que aun no estan en `develop`, no sobrescribir ni forzar ramas. Informar la divergencia y sincronizar de forma segura antes de desarrollar.

## 1. Project purpose
Certeza Habitacional is a web platform for managing residential inspection services end to end. The repository contains both the public-facing website and the operational system used to manage clients, quotations, payments, scheduling, inspections, findings, evidence, reviews, reports, certificates, users, zones and audit history.

The goal of every change is to preserve operational traceability, role-based access, data integrity and a simple workflow for non-technical users.

## 2. Current technical stack
- Next.js 16.2.12
- React 19.2.4
- TypeScript 5
- Prisma 6.16.2
- PostgreSQL
- Supabase client
- NextAuth 5 beta
- Tailwind CSS 4
- Zod
- Resend
- pdf-lib
- qrcode
- jszip

Primary commands:
- `npm run dev`
- `npm run lint`
- `npm run build`

`npm run build` already executes `prisma generate` before `next build`.

## 3. Branch and change policy
- Never make development changes directly on `main` unless the user explicitly requests a production promotion after testing and approval.
- New Codex work should normally branch from the current `develop` branch.
- Use a task-specific branch such as `codex/<descripcion-corta>`.
- Integrate completed and reviewed task branches into `develop`, not directly into `main`.
- Keep changes focused on the requested module.
- Do not refactor unrelated working code merely for style.
- Do not delete legacy files or historical sprint folders unless explicitly requested.
- Prefer small, reviewable commits with descriptive messages in Spanish.
- Before proposing integration into `develop`, verify the requested behavior and build.
- Promotion from `develop` to `main` is a separate release decision and requires explicit approval after testing.

## 4. Source of truth
Use the repository itself as the primary technical source of truth.

Before modifying a feature, inspect at minimum:
1. The relevant page/component/action/API route.
2. `prisma/schema.prisma` if the task touches stored data.
3. Existing authorization helpers and role checks.
4. Related validation schemas.
5. Existing business logic for the same entity.

Do not invent tables, fields, statuses, routes, permissions or workflows when an existing implementation can be inspected first.

If business intent and current code conflict, preserve data and existing production behavior until the requested change is explicit.

## 5. Roles
The current Prisma enum defines these application roles:
- DIRECTOR
- ADMINISTRADOR
- VENDEDOR
- GERENTE
- COORDINADOR
- INSPECTOR
- CLIENTE

Role behavior must be implemented through explicit authorization checks. Hiding a button in the UI is not sufficient security; sensitive server actions and routes must also validate authorization.

Do not assume permissions from role names alone. Inspect the existing permission matrix/helpers and preserve the currently defined scope unless the task explicitly changes it.

## 6. Core business domains
Treat these as interconnected modules, not isolated screens:
- Usuarios y roles
- Zonas de cobertura
- Clientes
- Vendedores
- Cotizaciones
- Autorizacion de cotizaciones
- Pagos
- Agenda
- Inspecciones
- Plantillas de inspeccion
- Hallazgos
- Fotografias y evidencias
- Revisiones y decisiones de revision
- Reasignacion de inspectores
- Reportes
- Certificados
- Auditoria
- Caja y movimientos administrativos cuando corresponda

When changing one module, inspect its downstream effects. For example, a quotation change may affect payment, scheduling and inspection creation.

## 7. Data integrity and Prisma rules
- Treat `prisma/schema.prisma` as a critical file.
- Never remove or rename a persisted field, enum value, relation or model without explicitly evaluating migration and compatibility impact.
- Prefer additive, backward-compatible schema changes when possible.
- Preserve relation semantics and `onDelete` behavior unless there is a clear business requirement to change them.
- Do not put secrets, passwords, database URLs or service keys in source control.
- Never expose `DATABASE_URL`, `DIRECT_URL`, auth secrets or private Supabase credentials to the client.
- For money, dates, statuses and authorization decisions, favor deterministic server-side validation.
- A migration tested in development/preproduction is not authorization to execute it against production.

## 8. Authentication and authorization
- Authentication is implemented with NextAuth 5 beta; inspect the existing configuration before modifying it.
- Preserve password hashing and account security behavior.
- Never log plaintext passwords or secrets.
- Server actions and protected routes must verify the authenticated user and their authorization.
- Any privileged change should retain or add auditability when the surrounding module already uses `EventoAuditoria` or equivalent tracking.

## 9. User experience rules
The primary users are operational staff and customers, many of whom may be non-technical.

Favor:
- Clear Spanish labels.
- Explicit success and error messages.
- Forms with sensible defaults.
- Minimal duplicate data entry.
- Safe correction/edit flows where the business process permits them.
- Readable tables and statuses.
- Mobile-friendly behavior for inspection workflows.

Avoid exposing technical terms, raw database errors, stack traces or implementation details to end users.

## 10. Existing status values
Do not casually alter enum values already used by production data. Current schema includes business states such as:
- EstadoInspeccion
- TipoDecisionRevision
- EstadoDecisionRevision
- EstadoReasignacionInspector
- EstadoCotizacion
- EstadoPago
- EsquemaPago
- ClasificacionHallazgo
- PrioridadHallazgo
- EstadoSeguimientoHallazgo
- TipoEvento

Inspect the schema and all usages before changing any of them.

## 11. Validation workflow for every coding task
For any substantive code change:
1. Confirm the task branch and its relationship to current `develop`.
2. Inspect the affected files before editing.
3. Make the smallest complete change that satisfies the requested behavior.
4. Run `npm run lint` when feasible.
5. Run `npm run build` before considering the coding task complete.
6. Fix TypeScript/build errors caused by the change.
7. Report clearly what changed, what was validated and any remaining limitation.
8. Integrate into `develop` only through the agreed review process.
9. Perform functional/manual tests in development/preproduction as applicable.
10. Wait for explicit approval before any promotion to `main`/production.

Do not claim a production release is ready merely because the build passes.

If a pre-existing unrelated error prevents full validation, identify it explicitly and distinguish it from the new work.

## 12. High-risk changes
Treat the following as high risk and make them narrowly and deliberately:
- Authentication
- Authorization / role permissions
- Prisma schema and migrations
- Payment state
- Quotation authorization state
- Inspection finalization
- Report release
- Certificate emission/revocation
- Evidence deletion
- Audit records
- Production environment configuration

For high-risk changes, explain impact before broad refactors and avoid destructive migrations unless explicitly requested. Test them in development/preproduction first. Production execution always requires a separate explicit approval.

## 13. Public website vs operational system
This repository contains public pages and authenticated operational features. Do not assume a request about the public website should alter internal workflows, or vice versa.

Preserve branding and public content unless the task explicitly targets them.

## 14. Coding style
- Follow the existing project structure and naming conventions.
- Keep TypeScript types explicit where business logic is sensitive.
- Reuse existing helpers/components before introducing duplicates.
- Prefer server-side enforcement for business rules.
- Use Zod or existing validation patterns where already established.
- Keep Spanish business terminology consistent with the UI and Prisma model names.

## 15. Definition of done
A development task is done only when:
- The requested behavior is implemented in the task/development path.
- Related authorization is correct.
- Stored data remains coherent.
- Existing flows are not knowingly broken.
- Lint/build validation has been performed when feasible.
- Any schema impact is documented.
- The final response summarizes changed files, validation performed and remaining risks or manual checks.

A PRODUCTION release is done only when, in addition:
- The integrated version has been tested in `develop`/preproduction.
- The responsible project owner has explicitly approved promotion.
- The production deployment is intentionally performed from the approved state to `main`.

## 16. Project-specific working principle
Certeza Habitacional is being developed incrementally while approaching/entering live operation. Preserve what already works. Prefer extending the current system over rebuilding modules from scratch. When historical sprint folders differ from the active application, treat the active application and current Prisma schema as authoritative unless instructed otherwise.
