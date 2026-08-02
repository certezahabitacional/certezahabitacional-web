import { prisma } from "@/lib/prisma";

export default async function ExecutiveInsights() {
  const hoy = new Date();

  const inicioMes = new Date(
    hoy.getFullYear(),
    hoy.getMonth(),
    1,
  );

  const inicioMesAnterior = new Date(
    hoy.getFullYear(),
    hoy.getMonth() - 1,
    1,
  );

  const finMesAnterior = new Date(
    hoy.getFullYear(),
    hoy.getMonth(),
    0,
    23,
    59,
    59,
  );

  const [
    inspeccionesMes,
    inspeccionesMesAnterior,
    certificadosMes,
    criticosPendientes,
    inspectores,
  ] = await Promise.all([
    prisma.inspeccion.count({
      where: {
        creadoEn: {
          gte: inicioMes,
        },
      },
    }),

    prisma.inspeccion.count({
      where: {
        creadoEn: {
          gte: inicioMesAnterior,
          lte: finMesAnterior,
        },
      },
    }),

    prisma.certificado.count({
      where: {
        emitidoEn: {
          gte: inicioMes,
        },
      },
    }),

    prisma.hallazgo.count({
      where: {
        clasificacion: "CR",
        resuelto: false,
      },
    }),

    prisma.inspector.findMany({
      include: {
        usuario: true,
        _count: {
          select: {
            inspecciones: true,
          },
        },
      },
      orderBy: {
        inspecciones: {
          _count: "desc",
        },
      },
      take: 5,
    }),
  ]);

  const variacion =
    inspeccionesMesAnterior === 0
      ? 100
      : (
          ((inspeccionesMes - inspeccionesMesAnterior) /
            inspeccionesMesAnterior) *
          100
        ).toFixed(1);

  return (
    <section className="mt-10 space-y-8">

      <div>
        <h2 className="text-2xl font-black text-white">
          Insights Ejecutivos
        </h2>

        <p className="mt-2 text-slate-400">
          Indicadores estratégicos del negocio.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">

        <div className="rounded-3xl border border-white/10 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">
            Inspecciones del mes
          </p>

          <h3 className="mt-3 text-5xl font-black text-cyan-300">
            {inspeccionesMes}
          </h3>

          <p className="mt-4 text-sm text-slate-400">
            Variación:
            <span className="ml-2 font-bold text-green-400">
              {variacion}%
            </span>
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">
            Certificados emitidos
          </p>

          <h3 className="mt-3 text-5xl font-black text-cyan-300">
            {certificadosMes}
          </h3>

          <p className="mt-4 text-sm text-slate-400">
            Durante este mes.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">
            Hallazgos críticos
          </p>

          <h3 className="mt-3 text-5xl font-black text-red-400">
            {criticosPendientes}
          </h3>

          <p className="mt-4 text-sm text-slate-400">
            Pendientes por resolver.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-400 to-cyan-600 p-6 text-slate-950">
          <p className="text-sm font-bold uppercase">
            Estado general
          </p>

          <h3 className="mt-3 text-4xl font-black">
            {
              criticosPendientes === 0
                ? "Excelente"
                : criticosPendientes < 5
                ? "Controlado"
                : "Atención"
            }
          </h3>

          <p className="mt-4 font-medium">
            Basado en hallazgos críticos.
          </p>
        </div>

      </div>

      <div className="rounded-3xl border border-white/10 bg-slate-900">

        <div className="border-b border-white/10 p-6">
          <h3 className="text-xl font-black text-white">
            Ranking de Inspectores
          </h3>
        </div>

        <div className="divide-y divide-white/10">

          {inspectores.map((inspector, index) => (
            <div
              key={inspector.id}
              className="flex items-center justify-between p-6"
            >
              <div>
                <p className="font-bold text-white">
                  #{index + 1} {inspector.usuario.nombre}
                </p>

                <p className="text-sm text-slate-400">
                  {inspector.especialidad || "Inspector"}
                </p>
              </div>

              <div className="text-right">
                <p className="text-2xl font-black text-cyan-300">
                  {inspector._count.inspecciones}
                </p>

                <p className="text-xs text-slate-400">
                  inspecciones
                </p>
              </div>
            </div>
          ))}

          {inspectores.length === 0 && (
            <div className="p-8 text-center text-slate-400">
              No existen inspectores registrados.
            </div>
          )}

        </div>

      </div>

    </section>
  );
}