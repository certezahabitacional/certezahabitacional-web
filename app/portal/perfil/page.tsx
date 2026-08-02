import { obtenerClienteActual } from "@/lib/cliente-actual";

export default async function PortalPerfilPage() {
  const cliente = await obtenerClienteActual();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
          Portal del cliente
        </p>

        <h1 className="mt-2 text-4xl font-black">
          Mi perfil
        </h1>

        <p className="mt-2 text-slate-400">
          Información asociada a tu cuenta.
        </p>
      </header>

      <section className="mt-8 rounded-3xl border border-white/10 bg-slate-900 p-7">
        <dl className="grid gap-5 md:grid-cols-2">
          <Dato
            etiqueta="Nombre"
            valor={cliente.nombre}
          />

          <Dato
            etiqueta="Correo"
            valor={cliente.correo ?? "No registrado"}
          />

          <Dato
            etiqueta="Teléfono"
            valor={cliente.telefono ?? "No registrado"}
          />

          <Dato
            etiqueta="Tipo de cliente"
            valor={cliente.tipo.replaceAll("_", " ")}
          />

          <Dato
            etiqueta="Empresa"
            valor={cliente.empresa ?? "No registrada"}
          />

          <Dato
            etiqueta="RFC"
            valor={cliente.rfc ?? "No registrado"}
          />

          <Dato
            etiqueta="CURP"
            valor={cliente.curp ?? "No registrada"}
          />

          <Dato
            etiqueta="Ciudad"
            valor={cliente.ciudad ?? "No registrada"}
          />

          <Dato
            etiqueta="Estado"
            valor={cliente.estado ?? "No registrado"}
          />

          <Dato
            etiqueta="Código postal"
            valor={cliente.codigoPostal ?? "No registrado"}
          />
        </dl>

        {cliente.direccion && (
          <div className="mt-5 rounded-2xl bg-slate-950 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-slate-600">
              Dirección
            </p>

            <p className="mt-2 font-bold text-slate-200">
              {cliente.direccion}
              {cliente.colonia
                ? `, ${cliente.colonia}`
                : ""}
              {cliente.codigoPostal
                ? `, C.P. ${cliente.codigoPostal}`
                : ""}
            </p>
          </div>
        )}

        {cliente.notas && (
          <div className="mt-5 rounded-2xl bg-slate-950 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-slate-600">
              Notas
            </p>

            <p className="mt-2 whitespace-pre-line text-slate-300">
              {cliente.notas}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

function Dato({
  etiqueta,
  valor,
}: {
  etiqueta: string;
  valor: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-950 p-5">
      <dt className="text-xs font-black uppercase tracking-widest text-slate-600">
        {etiqueta}
      </dt>

      <dd className="mt-2 font-bold text-slate-200">
        {valor}
      </dd>
    </div>
  );
}