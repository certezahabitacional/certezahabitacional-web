import Link from "next/link";
import { RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { asignarAccesoCliente } from "./actions";

export default async function AccesosClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { rol: true, activo: true },
  });

  if (
    !usuario ||
    !usuario.activo ||
    (usuario.rol !== RolUsuario.DIRECTOR && usuario.rol !== RolUsuario.ADMINISTRADOR)
  ) {
    redirect("/acceso");
  }

  const params = await searchParams;
  const clientes = await prisma.cliente.findMany({
    select: {
      id: true,
      nombre: true,
      correo: true,
      telefono: true,
      usuario: { select: { email: true, activo: true } },
    },
    orderBy: { nombre: "asc" },
  });

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <Link href="/panel/clientes" className="text-sm font-bold text-cyan-300">
          ← Clientes
        </Link>
        <h1 className="mt-3 text-3xl font-black">Acceso de clientes</h1>
        <p className="mt-2 max-w-3xl text-slate-400">
          Aquí no se crea un cliente nuevo. Se asignan o restablecen credenciales únicamente a clientes que ya existen por el flujo comercial.
        </p>

        {(params.ok || params.error) && (
          <p className={`mt-6 rounded-2xl p-4 font-bold ${params.error ? "bg-rose-400/10 text-rose-300" : "bg-emerald-400/10 text-emerald-300"}`}>
            {params.error ?? params.ok}
          </p>
        )}

        <div className="mt-8 space-y-4">
          {clientes.map((cliente) => (
            <details key={cliente.id} className="rounded-3xl border border-white/10 bg-slate-900 p-5">
              <summary className="cursor-pointer font-black text-cyan-300">
                {cliente.nombre} · {cliente.usuario ? `Acceso: ${cliente.usuario.email}` : "Sin acceso"}
              </summary>
              <p className="mt-3 text-sm text-slate-400">
                {cliente.correo ?? "Sin correo comercial"} · {cliente.telefono ?? "Sin teléfono"}
              </p>
              <form action={asignarAccesoCliente} className="mt-5 grid gap-4 md:grid-cols-3">
                <input type="hidden" name="clienteId" value={cliente.id} />
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-300">Usuario / correo</span>
                  <input name="email" type="email" required defaultValue={cliente.usuario?.email ?? cliente.correo ?? ""} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-300">Contraseña temporal</span>
                  <input name="password" type="password" minLength={8} required className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3" />
                </label>
                <div className="flex items-end">
                  <button className="w-full rounded-full bg-cyan-400 px-5 py-3 font-black text-slate-950">
                    {cliente.usuario ? "Restablecer acceso" : "Asignar acceso"}
                  </button>
                </div>
              </form>
            </details>
          ))}
        </div>
      </div>
    </main>
  );
}
