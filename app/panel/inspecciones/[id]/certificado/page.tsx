import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { emitirCertificado } from "../actions";
import PrintButton from "./PrintButton";
import {
  reactivarCertificado,
  revocarCertificado,
} from "./actions";

export default async function CertificadoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    ok?: string;
    error?: string;
  }>;
}) {
  const { id } = await params;
  const query = await searchParams;

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    include: {
      cliente: true,
      inmueble: true,
      inspector: { include: { usuario: true } },
      certificado: true,
      hallazgos: true,
    },
  });

  if (!inspeccion) notFound();

  if (!inspeccion.certificado) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-900 p-8 text-center">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">
            Certeza Habitacional
          </p>
          <h1 className="mt-4 text-3xl font-black">Emitir certificado</h1>
          <p className="mt-3 leading-7 text-slate-400">
            El certificado cerrará la inspección y conservará el índice actual del expediente.
          </p>
          <div className="mt-6 rounded-3xl bg-slate-950 p-6">
            <p className="text-sm text-slate-400">Índice de Salud Habitacional</p>
            <p className="mt-2 text-6xl font-black text-cyan-300">
              {Math.round(Number(inspeccion.ish ?? 100))}
            </p>
            <p className="font-black">{inspeccion.semaforo ?? "SIN EVALUAR"}</p>
          </div>
          <form action={emitirCertificado} className="mt-7">
            <input type="hidden" name="inspeccionId" value={inspeccion.id} />
            <button className="w-full rounded-full bg-cyan-400 px-5 py-3 font-black text-slate-950">
              Emitir certificado definitivo
            </button>
          </form>
          <Link
            href={`/panel/inspecciones/${inspeccion.id}`}
            className="mt-5 inline-block font-bold text-slate-400"
          >
            ← Volver al expediente
          </Link>
        </section>
      </main>
    );
  }

  const certificado = inspeccion.certificado;
  const baseUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const urlValidacion =
  `${baseUrl}/certificados/verificar/${certificado.codigoValidacion}`;

const qrDataUrl = await QRCode.toDataURL(urlValidacion, {
  width: 260,
  margin: 1,
  errorCorrectionLevel: "M",
});

  return (
    <main className="min-h-screen bg-slate-200 px-4 py-8 text-slate-950 print:bg-white print:p-0">
      <div className="mx-auto mb-5 flex max-w-5xl items-center justify-between print:hidden">
        <Link
          href={`/panel/inspecciones/${inspeccion.id}`}
          className="font-bold text-slate-700"
        >
          ← Volver al expediente
        </Link>
        <PrintButton />
      </div>

      {query.ok && (
  <div className="mx-auto mb-5 max-w-5xl rounded-2xl bg-emerald-100 px-5 py-4 font-bold text-emerald-800 print:hidden">
    {query.ok}
  </div>
)}

{query.error && (
  <div className="mx-auto mb-5 max-w-5xl rounded-2xl bg-rose-100 px-5 py-4 font-bold text-rose-800 print:hidden">
    {query.error}
  </div>
)}
      <article className="mx-auto min-h-[900px] max-w-5xl border-[12px] border-slate-950 bg-white p-12 shadow-2xl print:min-h-screen print:max-w-none print:shadow-none">
        <div className="border-2 border-cyan-400 p-10 text-center">
          <p className="text-sm font-black uppercase tracking-[0.35em] text-cyan-600">
            Certeza Habitacional
          </p>
          <h1 className="mt-6 text-5xl font-black">Certificado de Estado Habitacional</h1>
          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            Se hace constar que el inmueble descrito fue objeto de una inspección visual y documental,
            conforme al expediente técnico identificado en este certificado.
          </p>

          <div className="mx-auto mt-10 max-w-3xl rounded-3xl bg-slate-950 p-8 text-left text-white">
            <dl className="grid gap-5 md:grid-cols-2">
              <Data label="Certificado" value={certificado.folio} />
              <Data label="Inspección" value={inspeccion.folio} />
              <Data label="Cliente" value={inspeccion.cliente.nombre} />
              <Data
                label="Inmueble"
                value={inspeccion.inmueble?.alias ?? inspeccion.tipoInmueble}
              />
              <Data label="Dirección" value={`${inspeccion.direccion}, ${inspeccion.ciudad}`} />
              <Data
                label="Inspector"
                value={inspeccion.inspector?.usuario.nombre ?? "Sin asignar"}
              />
            </dl>
          </div>

          <div className="mx-auto mt-10 grid max-w-3xl items-center gap-8 md:grid-cols-[220px_1fr]">
            <div className="rounded-3xl bg-cyan-300 p-8 text-slate-950">
              <p className="text-xs font-black uppercase tracking-widest">Índice</p>
              <p className="text-7xl font-black">{Math.round(Number(certificado.ish))}</p>
              <p className="font-black">{inspeccion.semaforo ?? "EVALUADO"}</p>
            </div>
            <div className="text-left">
              <h2 className="text-2xl font-black">Dictamen</h2>
              <p className="mt-4 text-lg leading-8 text-slate-700">{certificado.dictamen}</p>
            </div>
          </div>

          <div className="mx-auto mt-12 grid max-w-3xl gap-8 border-t border-slate-300 pt-8 text-sm text-slate-600 md:grid-cols-[1fr_180px] md:items-center">
  <div>
    <p>
      Emitido el{" "}
      {certificado.emitidoEn.toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })}
    </p>

    <p className="mt-3 font-black tracking-widest text-slate-950">
      CÓDIGO DE VALIDACIÓN: {certificado.codigoValidacion}
    </p>

    <p className="mt-5 leading-6">
      Este certificado debe interpretarse junto con el reporte técnico completo.
      No sustituye peritajes estructurales, dictámenes de instalaciones ocultas
      ni estudios especializados.
    </p>

    <p className="mt-5 text-xs">
      Escanee el código QR para verificar la autenticidad y vigencia del certificado.
    </p>
  </div>

  <div className="flex flex-col items-center justify-center self-center">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src={qrDataUrl}
      alt="Código QR de validación"
      className="mx-auto h-40 w-40"
    />
    <p className="mt-2 text-xs font-bold text-slate-700">
      Verificar certificado
    </p>
  </div>
</div>
        </div>
      </article>
      <section className="mx-auto mt-6 max-w-5xl rounded-3xl border border-slate-300 bg-white p-7 shadow-xl print:hidden">
  <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
    <div>
      <p className="text-xs font-black uppercase tracking-widest text-slate-500">
        Estado administrativo
      </p>

      <p
        className={
          certificado.vigente
            ? "mt-2 text-2xl font-black text-emerald-700"
            : "mt-2 text-2xl font-black text-rose-700"
        }
      >
        {certificado.vigente
          ? "CERTIFICADO VIGENTE"
          : "CERTIFICADO REVOCADO"}
      </p>

      {!certificado.vigente && certificado.motivoRevocacion && (
        <div className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm text-rose-800">
          <p className="font-black">Motivo de revocación</p>

          <p className="mt-1 leading-6">
            {certificado.motivoRevocacion}
          </p>

          {certificado.revocadoEn && (
            <p className="mt-2 text-xs">
              Revocado el{" "}
              {certificado.revocadoEn.toLocaleString("es-MX")}
            </p>
          )}
        </div>
      )}
    </div>

    {!certificado.vigente && (
      <form action={reactivarCertificado}>
        <input
          type="hidden"
          name="inspeccionId"
          value={inspeccion.id}
        />

        <button
          type="submit"
          className="rounded-full bg-emerald-500 px-6 py-3 font-black text-white"
        >
          Reactivar certificado
        </button>
      </form>
    )}
  </div>

  {certificado.vigente && (
    <form
      action={revocarCertificado}
      className="mt-7 border-t border-slate-200 pt-6"
    >
      <input
        type="hidden"
        name="inspeccionId"
        value={inspeccion.id}
      />

      <label className="block">
        <span className="mb-2 block text-sm font-black">
          Motivo de revocación
        </span>

        <textarea
          name="motivo"
          required
          minLength={10}
          rows={3}
          placeholder="Ejemplo: certificado sustituido por una nueva inspección..."
          className="w-full rounded-2xl border border-slate-300 px-4 py-3"
        />
      </label>

      <button
        type="submit"
        className="mt-4 rounded-full bg-rose-600 px-6 py-3 font-black text-white"
      >
        Revocar certificado
      </button>
    </form>
  )}
</section>
    </main>
  );
}

function Data({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-black uppercase tracking-widest text-cyan-300">{label}</dt>
      <dd className="mt-1 font-bold">{value}</dd>
    </div>
  );
}
