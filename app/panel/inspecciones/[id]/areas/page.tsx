import Link from "next/link";
import { EstadoInspeccion, RolUsuario } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  agregarAreaManual,
  confirmarAreasV1,
  confirmarProyectoV1,
  generarAreasDesdeGuia,
  subirFotoArea,
} from "./actions";

type Area = {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  origen: string;
  obligatoria: boolean;
  estado: string;
  comentarioFinal: string | null;
  fotos: number;
  portada: boolean;
};

type Control = {
  proyectoConfirmado: boolean;
  areasConfirmadas: boolean;
} | null;

export default async function AreasPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { rol: true, activo: true, inspector: { select: { id: true } } },
  });
  if (!usuario?.activo) redirect("/acceso");

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    select: {
      id: true,
      folio: true,
      numeroInspeccion: true,
      estado: true,
      inspectorId: true,
      cliente: { select: { nombre: true } },
      inmueble: { select: { alias: true } },
    },
  });
  if (!inspeccion) notFound();
  if (inspeccion.numeroInspeccion > 1) redirect(`/panel/inspecciones/${id}/captura`);

  const esInspector = usuario.rol === RolUsuario.INSPECTOR && usuario.inspector?.id === inspeccion.inspectorId;
  const rolesConsulta: RolUsuario[] = [RolUsuario.DIRECTOR, RolUsuario.GERENTE, RolUsuario.COORDINADOR];
  const consulta = rolesConsulta.includes(usuario.rol);
  if (!esInspector && !consulta) redirect("/acceso");

  const [controlRows, areas] = await Promise.all([
    prisma.$queryRaw<Control[]>`
      SELECT "proyectoConfirmado","areasConfirmadas"
      FROM "InspeccionControlV2" WHERE "inspeccionId"=${id} LIMIT 1
    `,
    prisma.$queryRaw<Area[]>`
      SELECT a."id",a."codigo",a."nombre",a."tipo",a."origen",a."obligatoria",a."estado",a."comentarioFinal",
             COUNT(fa."id")::int AS "fotos",
             COALESCE(BOOL_OR(fa."candidataPortada"),false) AS "portada"
      FROM "AreaInspeccion" a
      LEFT JOIN "FotografiaArea" fa ON fa."areaId"=a."id"
      WHERE a."inspeccionId"=${id}
      GROUP BY a."id"
      ORDER BY a."orden",a."nombre"
    `,
  ]);

  const control = controlRows[0] ?? null;
  const puedeCapturar = esInspector && inspeccion.estado === EstadoInspeccion.EN_PROCESO;
  const completas = areas.filter((a) => a.estado === "REVISADA").length;
  const avance = areas.length ? Math.round((completas / areas.length) * 100) : 0;

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/panel/inspecciones/${id}/flujo`} className="text-sm font-black text-cyan-300">← Flujo de campo</Link>
          <div className="flex flex-wrap gap-2">
            <Link href={`/panel/inspecciones/${id}/campo-v1`} className="rounded-full border border-cyan-300/30 px-4 py-2 text-sm font-black text-cyan-300">Recorrido V1</Link>
            <Link href={`/panel/inspecciones/${id}/protocolo`} className="rounded-full border border-white/15 px-4 py-2 text-sm font-black text-amber-300">Protocolo V1</Link>
          </div>
        </div>

        <p className="mt-7 text-xs font-black uppercase tracking-[.24em] text-emerald-300">Preparación y evidencia V1</p>
        <h1 className="mt-2 text-4xl font-black">Áreas de la vivienda</h1>
        <p className="mt-2 text-slate-400">{inspeccion.folio} · {inspeccion.cliente.nombre} · {inspeccion.inmueble?.alias ?? "Inmueble"}</p>

        {(query.ok || query.error) && (
          <p className={`mt-5 rounded-2xl p-4 font-bold ${query.error ? "bg-rose-400/10 text-rose-300" : "bg-emerald-400/10 text-emerald-300"}`}>
            {query.error ?? query.ok}
          </p>
        )}

        <section className="mt-7 grid gap-4 sm:grid-cols-4">
          <Resumen titulo="Proyecto" valor={control?.proyectoConfirmado ? "Confirmado" : "Pendiente"} />
          <Resumen titulo="Áreas" valor={String(areas.length)} />
          <Resumen titulo="Cerradas" valor={`${completas}/${areas.length}`} />
          <Resumen titulo="Avance" valor={`${avance}%`} />
        </section>

        {puedeCapturar && !control?.proyectoConfirmado && (
          <section className="mt-6 rounded-3xl border border-amber-300/20 bg-amber-300/5 p-6">
            <h2 className="text-xl font-black">1. Confirmar información de proyecto</h2>
            <p className="mt-2 text-sm text-slate-300">Antes del recorrido, documenta si existe proyecto PDF o si la inspección se realizará formalmente sin proyecto disponible.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <form action={confirmarProyectoV1}><input type="hidden" name="inspeccionId" value={id}/><input type="hidden" name="modalidad" value="CON_PDF"/><button className="w-full rounded-xl bg-cyan-300 px-4 py-3 font-black text-slate-950">Confirmar PDF cargado</button></form>
              <form action={confirmarProyectoV1}><input type="hidden" name="inspeccionId" value={id}/><input type="hidden" name="modalidad" value="SIN_PDF"/><button className="w-full rounded-xl border border-white/15 px-4 py-3 font-black text-slate-200">Declarar sin proyecto PDF</button></form>
            </div>
          </section>
        )}

        {puedeCapturar && areas.length === 0 && (
          <section className="mt-6 rounded-3xl border border-cyan-300/20 bg-cyan-300/5 p-6">
            <h2 className="text-xl font-black">2. Construir ecosistema físico</h2>
            <p className="mt-2 text-sm text-slate-300">Genera las áreas a partir de la guía técnica. El sistema añadirá siempre la Fachada principal como primera área.</p>
            <form action={generarAreasDesdeGuia} className="mt-4"><input type="hidden" name="inspeccionId" value={id}/><button className="rounded-xl bg-cyan-300 px-5 py-3 font-black text-slate-950">Generar áreas desde guía</button></form>
          </section>
        )}

        {puedeCapturar && areas.length > 0 && !control?.areasConfirmadas && (
          <section className="mt-6 rounded-3xl border border-violet-300/20 bg-violet-300/5 p-6">
            <h2 className="text-xl font-black">3. Verificar y confirmar áreas</h2>
            <p className="mt-2 text-sm text-slate-300">Antes de confirmar, agrega cualquier recámara, baño, estancia, patio, cochera u otra área física que no haya surgido de la guía.</p>
            <form action={agregarAreaManual} className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
              <input type="hidden" name="inspeccionId" value={id}/>
              <input name="nombre" required placeholder="Ej. Recámara 3" className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3"/>
              <select name="tipo" defaultValue="INTERIOR" className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3"><option value="INTERIOR">Interior</option><option value="EXTERIOR">Exterior</option><option value="INSTALACION">Instalación</option></select>
              <button className="rounded-xl border border-violet-300/30 px-5 py-3 font-black text-violet-300">Agregar área</button>
            </form>
            <form action={confirmarAreasV1} className="mt-4"><input type="hidden" name="inspeccionId" value={id}/><button className="rounded-xl bg-violet-300 px-5 py-3 font-black text-slate-950">Confirmar ecosistema de áreas</button></form>
          </section>
        )}

        <div className="mt-7 space-y-4">
          {areas.map((area, index) => {
            const fotos = Number(area.fotos);
            const completa = area.estado === "REVISADA";
            const fachada = area.codigo === "FACHADA_PRINCIPAL";
            const minimo = fachada ? 4 : 1;
            const evidenciaLista = fotos >= minimo;
            return (
              <article key={area.id} className={`rounded-3xl border p-5 ${completa ? "border-emerald-400/20 bg-emerald-400/5" : fachada ? "border-cyan-300/30 bg-cyan-300/5" : "border-white/10 bg-slate-900"}`}>
                <div className="grid gap-4 lg:grid-cols-[65px_1fr_300px]">
                  <span className="font-mono text-lg font-black text-cyan-300">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <div className="flex flex-wrap gap-2 text-xs font-black"><span className="rounded-full bg-white/5 px-2 py-1 text-slate-400">{area.tipo}</span><span className="rounded-full bg-white/5 px-2 py-1 text-slate-400">{area.origen}</span>{fachada && <span className="rounded-full bg-cyan-300/10 px-2 py-1 text-cyan-300">IDENTIFICACIÓN / PORTADA</span>}</div>
                    <h2 className="mt-2 text-xl font-black">{area.nombre}</h2>
                    <p className={`mt-2 text-sm font-bold ${evidenciaLista ? "text-emerald-300" : "text-amber-300"}`}>{fotos}/{minimo} fotografía{minimo === 1 ? " mínima" : "s mínimas"}{area.portada ? " · portada seleccionada" : fachada ? " · portada pendiente" : ""}</p>
                    {area.comentarioFinal && <p className="mt-3 text-sm text-slate-300"><strong>Resultado del recorrido:</strong> {area.comentarioFinal}</p>}
                    <p className="mt-3 text-xs text-slate-500">El cierre técnico del área se realiza únicamente desde Recorrido V1.</p>
                  </div>

                  {puedeCapturar && control?.areasConfirmadas ? (
                    <div className="space-y-3">
                      <form action={subirFotoArea} className="rounded-2xl border border-white/10 bg-slate-950 p-4">
                        <input type="hidden" name="inspeccionId" value={id}/><input type="hidden" name="areaId" value={area.id}/>
                        <input name="archivo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" required className="block w-full text-xs text-slate-400"/>
                        <input name="descripcion" placeholder="Descripción opcional" className="mt-3 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm"/>
                        <button className="mt-3 w-full rounded-xl bg-cyan-300 px-3 py-2 text-sm font-black text-slate-950">Tomar / agregar foto</button>
                      </form>
                      <Link href={`/panel/inspecciones/${id}/campo-v1?area=${area.id}`} className="block rounded-xl border border-emerald-300/30 px-4 py-3 text-center text-sm font-black text-emerald-300">{completa ? "Ver resultado en Recorrido V1" : "Continuar revisión en Recorrido V1"}</Link>
                    </div>
                  ) : (
                    <div className={`rounded-2xl p-4 text-sm font-bold ${completa ? "bg-emerald-300/10 text-emerald-300" : "bg-white/5 text-slate-500"}`}>{completa ? "Área cerrada ✓" : control?.areasConfirmadas ? "Pendiente de recorrido" : "Confirma primero el ecosistema de áreas"}</div>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {areas.length > 0 && completas === areas.length && control?.areasConfirmadas && (
          <div className="mt-7 rounded-3xl border border-emerald-300/20 bg-emerald-300/5 p-6 text-emerald-200">
            <p className="font-black">Recorrido por áreas completo</p>
            <p className="mt-2 text-sm">Todas las áreas obligatorias están cerradas desde el recorrido V1. El cierre formal validará además procesos, hallazgos, fachada, portada, firmas y sincronización.</p>
          </div>
        )}
      </div>
    </main>
  );
}

function Resumen({ titulo, valor }: { titulo: string; valor: string }) {
  return <article className="rounded-2xl border border-white/10 bg-slate-900 p-5"><p className="text-[11px] font-black uppercase tracking-wider text-slate-500">{titulo}</p><p className="mt-2 text-2xl font-black text-cyan-300">{valor}</p></article>;
}
