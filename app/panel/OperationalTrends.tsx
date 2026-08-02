import { ClasificacionHallazgo } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type MesOperativo = {
  clave: string;
  etiqueta: string;
  inicio: Date;
  fin: Date;
  inspecciones: number;
  certificados: number;
  criticos: number;
  ishPromedio: number | null;
};

function inicioDeMes(fecha: Date) {
  return new Date(
    fecha.getFullYear(),
    fecha.getMonth(),
    1,
  );
}

function sumarMeses(fecha: Date, cantidad: number) {
  return new Date(
    fecha.getFullYear(),
    fecha.getMonth() + cantidad,
    1,
  );
}

function crearMeses(cantidad: number): MesOperativo[] {
  const actual = inicioDeMes(new Date());

  return Array.from(
    { length: cantidad },
    (_, indice): MesOperativo => {
      const desplazamiento =
        indice - (cantidad - 1);

      const inicio = sumarMeses(
        actual,
        desplazamiento,
      );

      const fin = sumarMeses(inicio, 1);

      return {
        clave: `${inicio.getFullYear()}-${String(
          inicio.getMonth() + 1,
        ).padStart(2, "0")}`,

        etiqueta: new Intl.DateTimeFormat(
          "es-MX",
          {
            month: "short",
            year: "2-digit",
          },
        ).format(inicio),

        inicio,
        fin,
        inspecciones: 0,
        certificados: 0,
        criticos: 0,
        ishPromedio: null,
      };
    },
  );
}

function perteneceAlMes(
  fecha: Date,
  mes: MesOperativo,
) {
  return fecha >= mes.inicio && fecha < mes.fin;
}

function porcentaje(
  valor: number,
  maximo: number,
) {
  if (maximo <= 0) return 0;

  return Math.max(
    4,
    Math.round((valor / maximo) * 100),
  );
}

export default async function OperationalTrends() {
  const meses = crearMeses(6);
  const fechaInicial = meses[0].inicio;

  const [
    inspecciones,
    certificados,
    hallazgosCriticos,
  ] = await Promise.all([
    prisma.inspeccion.findMany({
      where: {
        creadoEn: {
          gte: fechaInicial,
        },
      },
      select: {
        creadoEn: true,
        ish: true,
      },
      orderBy: {
        creadoEn: "asc",
      },
    }),

    prisma.certificado.findMany({
      where: {
        emitidoEn: {
          gte: fechaInicial,
        },
      },
      select: {
        emitidoEn: true,
      },
      orderBy: {
        emitidoEn: "asc",
      },
    }),

    prisma.hallazgo.findMany({
      where: {
        clasificacion:
          ClasificacionHallazgo.CR,
        creadoEn: {
          gte: fechaInicial,
        },
      },
      select: {
        creadoEn: true,
      },
      orderBy: {
        creadoEn: "asc",
      },
    }),
  ]);

  for (const mes of meses) {
    const inspeccionesDelMes =
      inspecciones.filter((inspeccion) =>
        perteneceAlMes(
          inspeccion.creadoEn,
          mes,
        ),
      );

    const inspeccionesConIsh =
      inspeccionesDelMes.filter(
        (inspeccion) =>
          inspeccion.ish !== null,
      );

    mes.inspecciones =
      inspeccionesDelMes.length;

    mes.certificados = certificados.filter(
      (certificado) =>
        perteneceAlMes(
          certificado.emitidoEn,
          mes,
        ),
    ).length;

    mes.criticos = hallazgosCriticos.filter(
      (hallazgo) =>
        perteneceAlMes(
          hallazgo.creadoEn,
          mes,
        ),
    ).length;

    mes.ishPromedio =
      inspeccionesConIsh.length > 0
        ? inspeccionesConIsh.reduce(
            (total, inspeccion) =>
              total +
              Number(inspeccion.ish ?? 0),
            0,
          ) / inspeccionesConIsh.length
        : null;
  }

  const maximoInspecciones = Math.max(
    1,
    ...meses.map(
      (mes) => mes.inspecciones,
    ),
  );

  const maximoCertificados = Math.max(
    1,
    ...meses.map(
      (mes) => mes.certificados,
    ),
  );

  const totalInspecciones = meses.reduce(
    (total, mes) =>
      total + mes.inspecciones,
    0,
  );

  const totalCertificados = meses.reduce(
    (total, mes) =>
      total + mes.certificados,
    0,
  );

  const totalCriticos = meses.reduce(
    (total, mes) =>
      total + mes.criticos,
    0,
  );

  const mesesConIsh = meses.filter(
    (mes) => mes.ishPromedio !== null,
  );

  const ishPeriodo =
    mesesConIsh.length > 0
      ? mesesConIsh.reduce(
          (total, mes) =>
            total +
            Number(mes.ishPromedio ?? 0),
          0,
        ) / mesesConIsh.length
      : null;

  return (
    <section className="mt-10 space-y-8">
      <div>
        <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">
          Tendencias operativas
        </p>

        <h2 className="mt-2 text-3xl font-black">
          Evolución de los últimos 6 meses
        </h2>

        <p className="mt-2 text-slate-400">
          Inspecciones, certificados, alertas
          críticas e Índice de Salud
          Habitacional.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Resumen
          titulo="Inspecciones"
          valor={totalInspecciones}
          detalle="Registradas en el periodo"
        />

        <Resumen
          titulo="Certificados"
          valor={totalCertificados}
          detalle="Emitidos en el periodo"
        />

        <Resumen
          titulo="Hallazgos críticos"
          valor={totalCriticos}
          detalle="Detectados en el periodo"
          alerta={totalCriticos > 0}
        />

        <Resumen
          titulo="ISH del periodo"
          valor={
            ishPeriodo !== null
              ? ishPeriodo.toFixed(1)
              : "—"
          }
          detalle="Promedio mensual"
        />
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        <GraficaBarras
          titulo="Inspecciones registradas"
          descripcion="Volumen mensual de nuevas inspecciones."
          meses={meses}
          campo="inspecciones"
          maximo={maximoInspecciones}
        />

        <GraficaBarras
          titulo="Certificados emitidos"
          descripcion="Documentos generados durante cada mes."
          meses={meses}
          campo="certificados"
          maximo={maximoCertificados}
        />
      </div>

      <div className="grid gap-8 xl:grid-cols-[1fr_380px]">
        <article className="rounded-3xl border border-white/10 bg-slate-900 p-7">
          <div>
            <h3 className="text-xl font-black">
              Evolución del ISH
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Promedio mensual del Índice de
              Salud Habitacional.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-6 gap-3">
            {meses.map((mes) => {
              const ish = mes.ishPromedio;

              return (
                <div
                  key={mes.clave}
                  className="flex min-w-0 flex-col items-center"
                >
                  <div className="flex h-52 w-full items-end justify-center rounded-2xl bg-slate-950 p-2">
                    {ish !== null ? (
                      <div
                        className="w-full rounded-xl bg-cyan-400"
                        style={{
                          height: `${Math.max(
                            5,
                            Math.min(100, ish),
                          )}%`,
                        }}
                      />
                    ) : (
                      <div className="mb-3 text-xs text-slate-700">
                        Sin datos
                      </div>
                    )}
                  </div>

                  <p className="mt-3 text-center text-xs font-bold uppercase text-slate-500">
                    {mes.etiqueta}
                  </p>

                  <p className="mt-1 text-sm font-black text-cyan-300">
                    {ish !== null
                      ? ish.toFixed(1)
                      : "—"}
                  </p>
                </div>
              );
            })}
          </div>
        </article>

        <article className="rounded-3xl border border-white/10 bg-slate-900 p-7">
          <h3 className="text-xl font-black">
            Alertas críticas por mes
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Hallazgos clasificados como críticos.
          </p>

          <div className="mt-7 space-y-4">
            {meses.map((mes) => (
              <div
                key={mes.clave}
                className="flex items-center justify-between rounded-2xl bg-slate-950 p-4"
              >
                <span className="text-sm font-bold uppercase text-slate-400">
                  {mes.etiqueta}
                </span>

                <span
                  className={
                    mes.criticos > 0
                      ? "rounded-full bg-rose-400/10 px-4 py-2 font-black text-rose-300"
                      : "rounded-full bg-emerald-400/10 px-4 py-2 font-black text-emerald-300"
                  }
                >
                  {mes.criticos}
                </span>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

function Resumen({
  titulo,
  valor,
  detalle,
  alerta = false,
}: {
  titulo: string;
  valor: number | string;
  detalle: string;
  alerta?: boolean;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-slate-900 p-6">
      <p className="text-sm font-bold text-slate-400">
        {titulo}
      </p>

      <p
        className={
          alerta
            ? "mt-4 text-4xl font-black text-rose-300"
            : "mt-4 text-4xl font-black text-cyan-300"
        }
      >
        {valor}
      </p>

      <p className="mt-2 text-xs text-slate-600">
        {detalle}
      </p>
    </article>
  );
}

function GraficaBarras({
  titulo,
  descripcion,
  meses,
  campo,
  maximo,
}: {
  titulo: string;
  descripcion: string;
  meses: MesOperativo[];
  campo: "inspecciones" | "certificados";
  maximo: number;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-slate-900 p-7">
      <h3 className="text-xl font-black">
        {titulo}
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        {descripcion}
      </p>

      <div className="mt-8 grid grid-cols-6 gap-3">
        {meses.map((mes) => {
          const valor = mes[campo];

          return (
            <div
              key={mes.clave}
              className="flex min-w-0 flex-col items-center"
            >
              <div className="flex h-52 w-full items-end rounded-2xl bg-slate-950 p-2">
                <div
                  className="w-full rounded-xl bg-cyan-400"
                  style={{
                    height: `${porcentaje(
                      valor,
                      maximo,
                    )}%`,
                  }}
                />
              </div>

              <p className="mt-3 text-center text-xs font-bold uppercase text-slate-500">
                {mes.etiqueta}
              </p>

              <p className="mt-1 text-sm font-black text-cyan-300">
                {valor}
              </p>
            </div>
          );
        })}
      </div>
    </article>
  );
}