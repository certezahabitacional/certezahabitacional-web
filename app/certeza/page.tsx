import Image from "next/image";

import { contactoDocumentoPorZona, DATOS_DOCUMENTALES } from "@/lib/datos-documentales";

export default async function CertezaPublicaPage({
  searchParams,
}: {
  searchParams: Promise<{ zona?: string; ciudad?: string }>;
}) {
  const params = await searchParams;
  const contacto = contactoDocumentoPorZona(params.zona, params.ciudad);

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <section className="mx-auto max-w-2xl rounded-[2rem] border border-amber-300/30 bg-slate-900 p-7 shadow-2xl sm:p-10">
        <div className="flex flex-col items-center text-center">
          <Image src={DATOS_DOCUMENTALES.logo} alt="Certeza Habitacional" width={240} height={120} className="h-auto w-56 object-contain" priority />
          <p className="mt-6 text-xs font-black uppercase tracking-[.24em] text-amber-300">Información institucional</p>
          <h1 className="mt-2 text-3xl font-black">CERTEZA HABITACIONAL</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">{DATOS_DOCUMENTALES.eslogan}</p>
        </div>

        <div className="mt-8 grid gap-3">
          <Dato label="Zona" value={contacto.zona} />
          <Dato label="Correo" value={contacto.email} href={`mailto:${contacto.email}`} />
          <Dato label="Teléfono / WhatsApp" value={contacto.telefono} href={`tel:${contacto.telefono.replace(/\D/g,"")}`} />
          <Dato label="Sitio web" value={contacto.web.replace(/^https?:\/\//,"")} href={contacto.web} />
        </div>

        <p className="mt-8 rounded-2xl border border-white/10 bg-slate-950 p-4 text-xs leading-5 text-slate-400">
          Esta página corresponde a la información institucional de Certeza Habitacional utilizada en reportes, certificados y códigos QR.
        </p>
      </section>
    </main>
  );
}

function Dato({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950 p-4">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p>
      {href ? <a href={href} className="mt-1 block break-words text-lg font-black text-cyan-300">{value}</a> : <p className="mt-1 text-lg font-black">{value}</p>}
    </div>
  );
}
