-- Certeza Project Manager
-- Migración idempotente del proyecto de demostración PR-0002 a ProyectoPM.
-- Ejecutar únicamente después de desplegar y validar el flujo de proyectos por asignación.

WITH director AS (
  SELECT id
  FROM "Usuario"
  WHERE email = 'ing.celedoniogil@gmail.com'
    AND rol = 'DIRECTOR'
    AND activo = true
    AND "projectManagerAutorizado" = true
  LIMIT 1
),
upsert_proyecto AS (
  INSERT INTO "ProyectoPM" (
    id,
    codigo,
    nombre,
    cliente,
    ubicacion,
    descripcion,
    "fechaInicio",
    "fechaFinPlan",
    presupuesto,
    estado,
    activo,
    "creadoPorId",
    "creadoEn",
    "actualizadoEn"
  )
  SELECT
    'pm_pr_0002_demo',
    'PR-0002',
    'Centro Logístico Certeza – Nave Industrial 1,500 m²',
    'Logística Frontera del Norte, S.A. de C.V.',
    'Ciudad Juárez, Chihuahua',
    'Proyecto ficticio integral para probar la creación automática de un proyecto mediante Expediente Maestro, incluyendo programa, presupuesto, explosión de insumos, suministros, riesgos y controles iniciales.',
    DATE '2026-11-02',
    DATE '2027-06-30',
    24600000.00,
    'PLANEACION',
    true,
    director.id,
    now(),
    now()
  FROM director
  ON CONFLICT (codigo) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    cliente = EXCLUDED.cliente,
    ubicacion = EXCLUDED.ubicacion,
    descripcion = EXCLUDED.descripcion,
    "fechaInicio" = EXCLUDED."fechaInicio",
    "fechaFinPlan" = EXCLUDED."fechaFinPlan",
    presupuesto = EXCLUDED.presupuesto,
    estado = EXCLUDED.estado,
    activo = EXCLUDED.activo,
    "creadoPorId" = COALESCE("ProyectoPM"."creadoPorId", EXCLUDED."creadoPorId"),
    "actualizadoEn" = now()
  RETURNING id
)
INSERT INTO "ProyectoPMUsuario" (
  id,
  "proyectoId",
  "usuarioId",
  "rolEnProyecto",
  "soloLectura",
  "asignadoEn"
)
SELECT
  'pmu_pr_0002_director',
  upsert_proyecto.id,
  director.id,
  'DIRECTOR',
  false,
  now()
FROM upsert_proyecto
CROSS JOIN director
ON CONFLICT ("proyectoId", "usuarioId") DO UPDATE SET
  "rolEnProyecto" = 'DIRECTOR',
  "soloLectura" = false;
