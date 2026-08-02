import Link from "next/link";
import { TipoCliente } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { crearCliente, eliminarCliente } from "./actions";

const etiquetas: Record<TipoCliente, string> = {
  PARTICULAR: "Particular",
  INMOBILIARIA: "Inmobiliaria",
  CONSTRUCTORA: "Constructora",
  INVERSIONISTA: "Inversionista",
};

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const clientes = await prisma.cliente.findMany({
    where: q
      ? {
          OR: [
            { nombre: { contains: q, mode: "insensitive" } },
            { telefono: { contains: q, mode: "insensitive" } },
            { correo: { contains: q, mode: "insensitive" } },
            { ciudad: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: { _count: { select: { inspecciones: true } } },
    orderBy: { creadoEn: "desc" },
  });

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <Link href="/panel" className="text-sm font-bold text-cyan-300">← Panel</Link>
            <h1 className="mt-2 text-3xl font-black">Clientes</h1>
            <p className="mt-1 text-slate-400">Directorio conectado a Supabase.</p>
          </div>
          <form action="/panel/clientes" className="flex gap-2">
            <input name="q" defaultValue={q} placeholder="Buscar cliente" className="rounded-full border border-white/10 bg-slate-900 px-5 py-3 outline-none focus:border-cyan-300" />
            <button className="rounded-full border border-white/15 px-5 py-3 font-bold">Buscar</button>
          </form>
        </div>

        {(params.ok || params.error) && (
          <p className={`mt-6 rounded-2xl px-5 py-4 font-bold ${params.error ? "bg-rose-400/10 text-rose-300" : "bg-emerald-400/10 text-emerald-300"}`}>
            {params.error ?? params.ok}
          </p>
        )}

        <div className="mt-8 grid gap-8 xl:grid-cols-[380px_1fr]">
          <section className="h-fit rounded-3xl border border-white/10 bg-slate-900 p-6">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">Alta rápida</p>
            <h2 className="mt-2 text-2xl font-black">Nuevo cliente</h2>
            <form action={crearCliente} className="mt-6 space-y-4">
              <Campo name="nombre" label="Nombre o razón social *" />
              <Campo name="telefono" label="Teléfono o WhatsApp *" />
              <Campo name="correo" label="Correo" type="email" />
              <label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">Tipo</span><select name="tipo" className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3">{Object.entries(etiquetas).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
              <Campo name="empresa" label="Empresa" />
              <Campo name="ciudad" label="Ciudad" defaultValue="Hermosillo, Sonora" />
              <Campo name="direccion" label="Dirección" />
              <label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">Notas</span><textarea name="notas" rows={3} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3" /></label>
              <button className="w-full rounded-full bg-cyan-400 px-5 py-3 font-black text-slate-950">Guardar cliente</button>
            </form>
          </section>

          <section className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
            <div className="border-b border-white/10 p-6"><p className="text-sm text-slate-400">{clientes.length} registro(s)</p></div>
            {clientes.length === 0 ? <p className="p-12 text-center text-slate-400">No hay clientes registrados.</p> : (
              <div className="divide-y divide-white/10">
                {clientes.map((cliente) => (
                  <article key={cliente.id} className="grid gap-4 p-6 md:grid-cols-[1fr_1fr_auto] md:items-center">
                    <div><p className="text-lg font-black text-cyan-300">{cliente.nombre}</p><p className="mt-1 text-sm text-slate-400">{cliente.telefono ?? "Sin teléfono"}</p><p className="text-sm text-slate-500">{cliente.correo ?? "Sin correo"}</p></div>
                    <div><span className="rounded-full bg-white/5 px-3 py-2 text-xs font-black">{etiquetas[cliente.tipo]}</span><p className="mt-3 text-sm text-slate-400">{cliente.ciudad ?? "Sin ciudad"}</p><p className="mt-1 text-sm font-bold text-emerald-300">{cliente._count.inspecciones} inspección(es)</p></div>
                    <form action={eliminarCliente}><input type="hidden" name="id" value={cliente.id} /><button className="rounded-full border border-rose-400/20 px-4 py-2 text-sm font-bold text-rose-300">Eliminar</button></form>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function Campo({ name, label, type = "text", defaultValue }: { name: string; label: string; type?: string; defaultValue?: string }) {
  return <label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">{label}</span><input name={name} type={type} defaultValue={defaultValue} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300" /></label>;
}
