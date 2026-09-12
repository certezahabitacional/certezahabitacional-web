import Link from "next/link";
import { redirect } from "next/navigation";
import { RolUsuario, TipoCliente } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { actualizarCliente } from "./actions";

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
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const usuarioActual = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { rol: true, activo: true },
  });

  if (
    !usuarioActual?.activo ||
    (usuarioActual.rol !== RolUsuario.DIRECTOR &&
      usuarioActual.rol !== RolUsuario.ADMINISTRADOR)
  ) {
    redirect("/acceso");
  }

  const params = await searchParams;
  const q = (params.q ?? "").trim();

  const clientes = await prisma.cliente.findMany({
    where: q
      ? {
          OR: [
            { folio: { contains: q, mode: "insensitive" } },
            { nombre: { contains: q, mode: "insensitive" } },
            { telefono: { contains: q, mode: "insensitive" } },
            { correo: { contains: q, mode: "insensitive" } },
            { rfc: { contains: q, mode: "insensitive" } },
            { curp: { contains: q, mode: "insensitive" } },
            { ciudad: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: {
      usuario: {
        select: { id: true, email: true, activo: true },
      },
      _count: {
        select: { inspecciones: true, inmuebles: true, cotizaciones: true },
      },
    },
    orderBy: { creadoEn: "desc" },
  });

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <Link href="/panel" className="text-sm font-black text-cyan-300">
              ← Panel
            </Link>
            <p className="mt-7 text-xs font-black uppercase tracking-[0.3em] text-amber-300">
              Directorio automático
            </p>
            <h1 className="mt-2 text-4xl font-black">Clientes</h1>
            <p className="mt-3 max-w-3xl text-slate-400">
              Los clientes se crean exclusivamente desde una cotización formal. Aquí se consultan y, cuando cambian sus datos, se actualiza el mismo registro sin duplicarlo.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/panel/clientes/accesos"
              className="rounded-full border border-white/15 px-5 py-3 text-sm font-black"
            >
              Acceso de clientes
            </Link>
            <Link
              href="/panel/cotizaciones/carga"
              className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950"
            >
              Cargar cotización formal
            </Link>
          </div>
        </div>

        {(params.ok || params.error) && (
          <div
            className={`mt-7 rounded-2xl border p-5 ${
              params.error
                ? "border-rose-400/20 bg-rose-400/5 text-rose-300"
                : "border-emerald-400/20 bg-emerald-400/5 text-emerald-300"
            }`}
          >
            <p className="font-bold">{params.error ?? params.ok}</p>
          </div>
        )}

        <form className="mt-8 flex max-w-3xl gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Folio, nombre, teléfono, correo, RFC, CURP o ciudad"
            className="min-w-0 flex-1 rounded-full border border-white/10 bg-slate-900 px-5 py-3 outline-none focus:border-cyan-300"
          />
          <button className="rounded-full border border-white/15 px-5 py-3 font-black">
            Buscar
          </button>
        </form>

        <div className="mt-8 space-y-5">
          {clientes.map((cliente) => (
            <article
              key={cliente.id}
              className="rounded-3xl border border-white/10 bg-slate-900 p-6"
            >
              <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-cyan-400/10 px-3 py-1 font-mono text-xs font-black text-cyan-300">
                      {cliente.folio}
                    </span>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-black text-slate-300">
                      {etiquetas[cliente.tipo]}
                    </span>
                  </div>
                  <h2 className="mt-3 text-2xl font-black">{cliente.nombre}</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    {cliente.telefono ?? "Sin teléfono"} · {cliente.correo ?? "Sin correo"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {cliente.ciudad ?? "Sin ciudad"}
                    {cliente.rfc ? ` · RFC ${cliente.rfc}` : ""}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-4 text-xs font-bold">
                    <span className="text-cyan-300">{cliente._count.inmuebles} inmueble(s)</span>
                    <span className="text-amber-300">{cliente._count.cotizaciones} cotización(es)</span>
                    <span className="text-emerald-300">{cliente._count.inspecciones} inspección(es)</span>
                  </div>
                </div>

                <div className="lg:text-right">
                  {cliente.usuario ? (
                    <div>
                      <span className="inline-flex rounded-full bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-300">
                        Acceso asignado
                      </span>
                      <p className="mt-2 text-xs text-slate-500">{cliente.usuario.email}</p>
                      {!cliente.usuario.activo && (
                        <p className="mt-1 text-xs font-black text-rose-300">Acceso inactivo</p>
                      )}
                    </div>
                  ) : (
                    <Link
                      href="/panel/clientes/accesos"
                      className="inline-flex rounded-full bg-amber-300 px-4 py-2 text-xs font-black text-slate-950"
                    >
                      Asignar acceso
                    </Link>
                  )}
                </div>
              </div>

              <details className="mt-6 rounded-2xl border border-white/10 bg-slate-950/60">
                <summary className="cursor-pointer px-5 py-4 font-black text-cyan-300">
                  Editar datos del cliente
                </summary>
                <form action={actualizarCliente} className="grid gap-4 border-t border-white/10 p-5 md:grid-cols-2">
                  <input type="hidden" name="id" value={cliente.id} />
                  <Campo name="nombre" label="Nombre o razón social *" defaultValue={cliente.nombre} />
                  <Campo name="telefono" label="Teléfono o WhatsApp *" defaultValue={cliente.telefono ?? ""} />
                  <Campo name="correo" label="Correo" type="email" defaultValue={cliente.correo ?? ""} />
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-300">Tipo</span>
                    <select
                      name="tipo"
                      defaultValue={cliente.tipo}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
                    >
                      {Object.entries(etiquetas).map(([valor, etiqueta]) => (
                        <option key={valor} value={valor}>{etiqueta}</option>
                      ))}
                    </select>
                  </label>
                  <Campo name="empresa" label="Empresa" defaultValue={cliente.empresa ?? ""} />
                  <Campo name="rfc" label="RFC" defaultValue={cliente.rfc ?? ""} />
                  <Campo name="curp" label="CURP" defaultValue={cliente.curp ?? ""} />
                  <Campo name="ciudad" label="Ciudad" defaultValue={cliente.ciudad ?? ""} />
                  <Campo name="estado" label="Estado" defaultValue={cliente.estado ?? ""} />
                  <Campo name="codigoPostal" label="Código postal" defaultValue={cliente.codigoPostal ?? ""} />
                  <div className="md:col-span-2">
                    <Campo name="direccion" label="Dirección" defaultValue={cliente.direccion ?? ""} />
                  </div>
                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-sm font-bold text-slate-300">Notas</span>
                    <textarea
                      name="notas"
                      rows={3}
                      defaultValue={cliente.notas ?? ""}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
                    />
                  </label>
                  <div className="md:col-span-2">
                    <button className="rounded-full bg-cyan-400 px-5 py-3 font-black text-slate-950">
                      Guardar cambios
                    </button>
                  </div>
                </form>
              </details>
            </article>
          ))}

          {clientes.length === 0 && (
            <div className="rounded-3xl border border-dashed border-white/15 p-10 text-center text-slate-400">
              No hay clientes con ese filtro.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Campo({
  name,
  label,
  type = "text",
  defaultValue = "",
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-300">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
      />
    </label>
  );
}
