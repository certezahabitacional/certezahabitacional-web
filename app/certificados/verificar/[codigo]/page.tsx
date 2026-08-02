import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function VerificarCertificadoPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;

  const certificado = await prisma.certificado.findUnique({
    where: {
      codigoValidacion: codigo,
    },
    include: {
      inspeccion: {
        include: {
          cliente: true,
          inmueble: true,
          inspector: {
            include: {
              usuario: true,
            },
          },
        },
      },
    },
  });

  if (!certificado) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <section className="w-full max-w-xl rounded-3xl border border-rose-400/30 bg-slate-900 p-8 text-center shadow-2xl">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-rose-400/10 text-4xl">
            ✕
          </div>

          <p className="mt-6 text-sm font-black uppercase tracking-[0.25em] text-rose-300">
            Validación no satisfactoria
          </p>

          <h1 className="mt-3 text-3xl font-black">
            Certificado no encontrado
          </h1>

          <p className="mt-4 leading-7 text-slate-400">
            El código proporcionado no corresponde a un certificado registrado
            en Certeza Habitacional.
          </p>

          <div className="mt-6 rounded-2xl bg-slate-950 px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Código consultado
            </p>
            <p className="mt-2 break-all font-black text-rose-300">
              {codigo}
            </p>
          </div>

          <Link
            href="/"
            className="mt-7 inline-block rounded-full bg-cyan-400 px-6 py-3 font-black text-slate-950"
          >
            Ir a Certeza Habitacional
          </Link>
        </section>
      </main>
    );
  }

  const inspeccion = certificado.inspeccion;
  const vigente = certificado.vigente;

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <section className="mx-auto max-w-4xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900 shadow-2xl">
        <header
          className={
            vigente
              ? "bg-emerald-400 px-7 py-8 text-slate-950"
              : "bg-rose-400 px-7 py-8 text-slate-950"
          }
        >
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em]">
                Certeza Habitacional
              </p>

              <h1 className="mt-2 text-3xl font-black">
                Validación de certificado
              </h1>
            </div>

            <div className="rounded-full bg-slate-950 px-5 py-3 font-black text-white">
              {vigente ? "✓ CERTIFICADO VIGENTE" : "✕ CERTIFICADO REVOCADO"}
            </div>
          </div>
        </header>

        <div className="p-7 sm:p-10">
          <div className="rounded-3xl border border-white/10 bg-slate-950 p-6">
            <p className="text-xs font-black uppercase tracking-widest text-cyan-300">
              Código de validación
            </p>

            <p className="mt-2 break-all text-xl font-black">
              {certificado.codigoValidacion}
            </p>
          </div>

          {!vigente && certificado.motivoRevocacion && (
  <div className="mt-7 rounded-3xl border border-rose-400/30 bg-rose-400/10 p-6 text-rose-200">
    <p className="text-xs font-black uppercase tracking-widest">
      Motivo de revocación
    </p>

    <p className="mt-3 leading-7">
      {certificado.motivoRevocacion}
    </p>

    {certificado.revocadoEn && (
      <p className="mt-3 text-sm text-rose-300">
        Revocado el{" "}
        {certificado.revocadoEn.toLocaleString("es-MX")}
      </p>
    )}
  </div>
)}

          <dl className="mt-7 grid gap-4 sm:grid-cols-2">
            <Dato label="Certificado" value={certificado.folio} />
            <Dato label="Inspección" value={inspeccion.folio} />

            <Dato
              label="Fecha de emisión"
              value={certificado.emitidoEn.toLocaleDateString("es-MX", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            />

            <Dato
              label="Índice de Salud Habitacional"
              value={`${Math.round(Number(certificado.ish))} / 100`}
            />

            <Dato label="Cliente" value={inspeccion.cliente.nombre} />

            <Dato
              label="Inmueble"
              value={inspeccion.inmueble?.alias ?? inspeccion.tipoInmueble}
            />

            <Dato
              label="Dirección"
              value={`${inspeccion.direccion}, ${inspeccion.ciudad}`}
            />

            <Dato
              label="Inspector"
              value={
                inspeccion.inspector?.usuario.nombre ??
                "Inspector no especificado"
              }
            />
          </dl>

          <div className="mt-7 rounded-3xl border border-white/10 bg-slate-950 p-6">
            <p className="text-xs font-black uppercase tracking-widest text-cyan-300">
              Dictamen registrado
            </p>

            <p className="mt-3 leading-7 text-slate-300">
              {certificado.dictamen}
            </p>
          </div>

          <div className="mt-7 rounded-3xl bg-amber-400/10 p-5 text-sm leading-6 text-amber-200">
            La validación confirma que el certificado está registrado en la
            plataforma. El documento debe interpretarse junto con el reporte
            técnico completo de la inspección.
          </div>

          <footer className="mt-8 border-t border-white/10 pt-6 text-center text-sm text-slate-500">
            Consulta generada directamente desde el registro de Certeza
            Habitacional.
          </footer>
        </div>
      </section>
    </main>
  );
}

function Dato({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950 p-5">
      <dt className="text-xs font-black uppercase tracking-widest text-cyan-300">
        {label}
      </dt>

      <dd className="mt-2 font-bold text-white">
        {value}
      </dd>
    </div>
  );
}