const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const aplicar = process.argv.includes("--apply");

function fecha(valor) {
  return valor ? new Date(valor).toISOString() : "sin fecha";
}

async function main() {
  const inspecciones = await prisma.inspeccion.findMany({
    select: {
      id: true,
      folio: true,
      inmuebleId: true,
      numeroInspeccion: true,
      inspeccionAnteriorId: true,
      fechaProgramada: true,
      creadoEn: true,
      inmueble: {
        select: {
          alias: true,
          direccion: true,
          ciudad: true,
        },
      },
    },
    orderBy: [
      { inmuebleId: "asc" },
      { fechaProgramada: "asc" },
      { creadoEn: "asc" },
    ],
  });

  const sinInmueble = inspecciones.filter(
    (inspeccion) => !inspeccion.inmuebleId,
  );

  const porInmueble = new Map();

  for (const inspeccion of inspecciones) {
    if (!inspeccion.inmuebleId) continue;

    const grupo = porInmueble.get(inspeccion.inmuebleId) ?? [];
    grupo.push(inspeccion);
    porInmueble.set(inspeccion.inmuebleId, grupo);
  }

  console.log("");
  console.log("NORMALIZACION DE VERSIONES DE INSPECCION");
  console.log("========================================");
  console.log(
    aplicar
      ? "MODO: APLICAR CAMBIOS"
      : "MODO: VISTA PREVIA (NO MODIFICA LA BASE)",
  );
  console.log("");

  let totalCambios = 0;
  let totalInspeccionesConInmueble = 0;

  for (const [inmuebleId, grupo] of porInmueble.entries()) {
    grupo.sort((a, b) => {
      const fechaA = new Date(a.fechaProgramada).getTime();
      const fechaB = new Date(b.fechaProgramada).getTime();

      if (fechaA !== fechaB) return fechaA - fechaB;

      const creadoA = new Date(a.creadoEn).getTime();
      const creadoB = new Date(b.creadoEn).getTime();

      if (creadoA !== creadoB) return creadoA - creadoB;

      return a.id.localeCompare(b.id);
    });

    totalInspeccionesConInmueble += grupo.length;

    const inmueble = grupo[0]?.inmueble;
    console.log(
      `Inmueble: ${inmueble?.alias ?? inmuebleId} | ` +
        `${inmueble?.direccion ?? "Sin direccion"}, ` +
        `${inmueble?.ciudad ?? "Sin ciudad"}`,
    );

    for (let indice = 0; indice < grupo.length; indice += 1) {
      const inspeccion = grupo[indice];
      const numeroEsperado = indice + 1;
      const anteriorEsperada =
        indice === 0 ? null : grupo[indice - 1].id;

      const requiereCambio =
        inspeccion.numeroInspeccion !== numeroEsperado ||
        inspeccion.inspeccionAnteriorId !== anteriorEsperada;

      if (requiereCambio) {
        totalCambios += 1;
      }

      console.log(
        `  ${requiereCambio ? "*" : " "} ${inspeccion.folio} | ` +
          `${fecha(inspeccion.fechaProgramada)} | ` +
          `actual V${inspeccion.numeroInspeccion} -> ` +
          `esperado V${numeroEsperado}` +
          `${anteriorEsperada ? ` | anterior: ${grupo[indice - 1].folio}` : " | primera inspeccion"}`,
      );

      if (aplicar && requiereCambio) {
        await prisma.inspeccion.update({
          where: { id: inspeccion.id },
          data: {
            numeroInspeccion: numeroEsperado,
            inspeccionAnteriorId: anteriorEsperada,
          },
        });
      }
    }

    console.log("");
  }

  if (sinInmueble.length > 0) {
    console.log("INSPECCIONES OMITIDAS POR NO TENER INMUEBLE VINCULADO");
    console.log("------------------------------------------------------");

    for (const inspeccion of sinInmueble) {
      console.log(
        `  - ${inspeccion.folio} | ${fecha(inspeccion.fechaProgramada)}`,
      );
    }

    console.log("");
  }

  console.log("RESUMEN");
  console.log("-------");
  console.log(
    `Inmuebles con inspecciones: ${porInmueble.size}`,
  );
  console.log(
    `Inspecciones con inmueble: ${totalInspeccionesConInmueble}`,
  );
  console.log(
    `Inspecciones sin inmueble: ${sinInmueble.length}`,
  );
  console.log(
    `Registros que ${aplicar ? "fueron" : "requieren ser"} actualizados: ${totalCambios}`,
  );

  if (!aplicar) {
    console.log("");
    console.log(
      "No se modifico la base. Si la vista previa es correcta, ejecuta:",
    );
    console.log(
      "node scripts/normalizar-versiones-inspecciones.cjs --apply",
    );
  } else {
    console.log("");
    console.log("Normalizacion aplicada correctamente.");
  }
}

main()
  .catch((error) => {
    console.error("");
    console.error("ERROR AL NORMALIZAR:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });