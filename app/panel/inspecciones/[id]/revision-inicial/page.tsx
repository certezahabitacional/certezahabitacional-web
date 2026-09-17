import Link from "next/link";
import { EstadoInspeccion, RolUsuario } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  iniciarInspeccionConfirmada,
  resolverSolicitudCorreccion,
  seleccionarMejorFachada,
  solicitarCorreccionPrevia,
  subirFotoFachadaPrevia,
} from "./actions";
import { FuentesAlternasFachada } from "./fuentes-fachada";

type FotoFachada = {
  fotografiaId: string;
  ruta: string;
  orden: number;
  candidataPortada: boolean;
  creadaEn: Date;
};

type Solicitud = {
  id: string;
  tipo: string;
  estado: string;
  detalle: string | null;
  solicitadaEn: Date;
  asignadaAId: string | null;
  asignadaA: string | null;
  rolAsignado: string | null;
  comentarioResolucion: string | null;
};

type Snapshot = Record<string, unknown>;

const ETIQUETAS_TIPO: Record<string, string> = {
  AREAS_DECLARADAS: "Áreas declaradas",
  DATOS_CLIENTE: "Datos del cliente",
  DATOS_INMUEBLE: "Datos del inmueble",
  IMPORTE_COTIZACION: "Importe de cotización",
};

const AREAS_BOOLEANAS: Array<[string, string]> = [
  ["cocina", "Cocina"],
  ["sala", "Sala"],
  ["comedor", "Comedor"],
  ["estancia", "Estancia"],
  ["areaLavado", "Área de lavado"],
  ["lavadero", "Lavadero"],
  ["cochera", "Cochera"],
  ["patio", "Patio"],
  ["jardin", "Jardín"],
  ["terraza", "Terraza"],
  ["balcon", "Balcón"],
  ["sotano", "Sótano"],
  ["cuartoServicio", "Cuarto de servicio"],
  ["bodega", "Bodega"],
];

function textoSnapshot(snapshot: Snapshot, campo: string, fallback = "—") {
  const valor = snapshot[campo];
  return typeof valor === "string" && valor.trim() ? valor.trim() : fallback;
}

function dinero(valor: unknown) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(Number(valor ?? 0));
}

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function urlTemporal(ruta: string) {
  const sb = supabaseAdmin();
  if (!sb) return null;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "evidencias";
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(ruta, 60 * 15);
  return error ? null : data.signedUrl;
}

export default async function RevisionInicialPage({
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
    select: { id: true, nombre: true, rol: true, activo: true, inspector: { select: { id: true, activo: true } } },
  });
  if (!usuario?.activo) redirect("/acceso");

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    include: {
      cliente: true,
      inmueble: true,
      inspector: { select: { usuarioId: true } },
      cotizacion: {
        include: {
          versiones: { orderBy: { version: "desc" }, take: 1 },
        },
      },
    },
  });
  if (!inspeccion) notFound();

  if (inspeccion.estado !== EstadoInspeccion.PROGRAMADA) {
    redirect(inspeccion.numeroInspeccion === 1 ? `/panel/inspecciones/${id}/areas` : `/panel/inspecciones/${id}/captura`);
  }

  const inspectorAsignado =
    usuario.rol === RolUsuario.INSPECTOR &&
    Boolean(usuario.inspector?.activo) &&
    inspeccion.inspectorId === usuario.inspector?.id &&
    inspeccion.inspector?.usuarioId === usuario.id;
  const esDirector = usuario.rol === RolUsuario.DIRECTOR;
  const esAdministrador = usuario.rol === RolUsuario.ADMINISTRADOR;
  if (!inspectorAsignado && !esDirector && !esAdministrador) redirect("/acceso");
  const responsableRevision = inspectorAsignado || esDirector;

  const snapshotRaw = inspeccion.cotizacion?.versiones[0]?.datos;
  const snapshot = snapshotRaw && typeof snapshotRaw === "object" && !Array.isArray(snapshotRaw)
    ? (snapshotRaw as Snapshot)
    : {};

  const [fotos, solicitudes] = await Promise.all([
    prisma.$queryRaw<FotoFachada[]>`
      SELECT fa."fotografiaId",f."url" AS "ruta",fa."orden",fa."candidataPortada",fa."creadoEn"
      FROM "FotografiaArea" fa
      JOIN "AreaInspeccion" a ON a."id"=fa."areaId"
      JOIN "Fotografia" f ON f."id"=fa."fotografiaId"
      WHERE a."inspeccionId"=${id} AND a."codigo"='FACHADA_PRINCIPAL'
      ORDER BY fa."orden",fa."creadoEn"
    `,
    prisma.$queryRaw<Solicitud[]>`
      SELECT s."id"::text,s."tipo",s."estado",s."detalle",s."solicitadaEn",s."asignadaAId",
             u."nombre" AS "asignadaA",u."rol"::text AS "rolAsignado",s."comentarioResolucion"
      FROM "SolicitudCorreccionInspeccion" s
      LEFT JOIN "Usuario" u ON u."id"=s."asignadaAId"
      WHERE s."inspeccionId"=${id}
      ORDER BY s."solicitadaEn" DESC
    `,
  ]);

  const fotosConUrl = await Promise.all(
    fotos.map(async (foto) => ({ ...foto, urlTemporal: await urlTemporal(foto.ruta) })),
  );
  const pendientes = solicitudes.filter((s) => s.estado === "PENDIENTE");
  const fotoDefinitiva = fotos.length === 1 && fotos[0]?.candidataPortada;
  const etapaSeleccion = fotos.length === 4 && !fotos.some((f) => f.candidataPortada);
  const puedeTomarFotos = responsableRevision;
  const puedeSolicitar = responsableRevision;
  const puedeIniciar = responsableRevision && Boolean(fotoDefinitiva) && pendientes.length === 0;

  const areasDeclaradas = AREAS_BOOLEANAS
    .filter(([campo]) => snapshot[campo] === true)
    .map(([, etiqueta]) => etiqueta);
  const otrosEspacios = textoSnapshot(snapshot, "otrosEspacios", "");

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/panel/inspecciones/${id}`} className="text-sm font-black text-cyan-300">← Expediente</Link>
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-black text-slate-300">{inspeccion.folio}</span>
        </div>

        <section className="mt-6 text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-cyan-300/30 bg-cyan-300/10 text-4xl" aria-label="Cámara">📷</div>
          <p className="mt-2 text-xs font-bold text-cyan-200">Toca la cámara para tomar fotografía en sitio</p>
          <p className="mt-5 text-xs font-black uppercase tracking-[.28em] text-cyan-300">Revisión final con el cliente</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Confirmación previa al inicio físico</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-400">Revisa con el cliente la información proporcionada desde la precotización. La inspección seguirá PROGRAMADA hasta presionar INICIAR al final.</p>
        </section>

        {(query.ok || query.error) && (
          <p className={`mt-6 rounded-2xl p-4 text-sm font-bold ${query.error ? "bg-rose-400/10 text-rose-300" : "bg-emerald-400/10 text-emerald-300"}`}>
            {query.error ?? query.ok}
          </p>
        )}

        <section className="mt-7 rounded-3xl border border-cyan-300/20 bg-slate-900 p-5 sm:p-6">
          <div className="text-center">
            <h2 className="text-xl font-black">Fotografía definitiva de la fachada principal</h2>
            {!fotoDefinitiva ? (
              <p className="mt-2 text-sm text-slate-400">Elige una ruta: tomar 4 fotografías en sitio y seleccionar la mejor, o usar 1 fotografía existente desde la base de evidencias o desde galería/archivos.</p>
            ) : (
              <p className="mt-2 text-sm font-bold text-emerald-300">Selección terminada: quedó una sola fotografía definitiva de fachada/portada.</p>
            )}
            <p className={`mt-3 font-black ${fotoDefinitiva ? "text-emerald-300" : fotos.length === 4 ? "text-cyan-300" : "text-amber-300"}`}>
              {fotoDefinitiva ? "1 fotografía definitiva" : fotos.length > 0 ? `${fotos.length}/4 tomadas en sitio` : "Sin fotografía definitiva"}
            </p>
          </div>

          {!fotoDefinitiva && fotos.length === 0 && puedeTomarFotos && (
            <FuentesAlternasFachada inspeccionId={id} />
          )}

          {!fotoDefinitiva && puedeTomarFotos && (
            <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-4 text-center">
              <p className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">Tomar en sitio · 4 fotografías obligatorias</p>
              <p className="mt-2 text-sm text-slate-300">Si eliges esta ruta, deberás completar las 4 tomas y después seleccionar la mejor. Las otras tres se eliminarán y no podrás cerrar esta revisión hasta definir la fotografía definitiva.</p>
            </div>
          )}

          <div className={`mt-5 grid gap-4 ${fotoDefinitiva ? "mx-auto max-w-md" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
            {(fotoDefinitiva ? fotosConUrl : [0, 1, 2, 3].map((indice) => fotosConUrl[indice] ?? null)).map((foto, indice) => (
              <article key={foto?.fotografiaId ?? indice} className={`overflow-hidden rounded-2xl border ${foto?.candidataPortada ? "border-emerald-300/40 bg-emerald-300/5" : "border-white/10 bg-slate-950"}`}>
                {foto?.urlTemporal ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={foto.urlTemporal} alt={`Fachada ${indice + 1}`} className="h-44 w-full object-cover" />
                ) : (
                  <div className="grid h-44 place-items-center text-3xl text-slate-600">📷</div>
                )}
                <div className="p-3">
                  <p className="text-xs font-black text-slate-300">{fotoDefinitiva ? "FOTOGRAFÍA DEFINITIVA" : `Fotografía ${indice + 1}`}</p>
                  {!foto && puedeTomarFotos && (
                    <form action={subirFotoFachadaPrevia} className="mt-3">
                      <input type="hidden" name="inspeccionId" value={id} />
                      <input name="archivo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" required className="block w-full text-xs text-slate-400" />
                      <button className="mt-3 w-full rounded-xl bg-cyan-300 px-3 py-2 text-xs font-black text-slate-950">TOMAR FOTO EN SITIO</button>
                    </form>
                  )}
                  {foto && etapaSeleccion && puedeTomarFotos && (
                    <form action={seleccionarMejorFachada} className="mt-3">
                      <input type="hidden" name="inspeccionId" value={id} />
                      <input type="hidden" name="fotografiaId" value={foto.fotografiaId} />
                      <button className="w-full rounded-xl border border-emerald-300/40 px-3 py-2 text-xs font-black text-emerald-300">ELEGIR COMO MEJOR</button>
                    </form>
                  )}
                  {foto?.candidataPortada && <p className="mt-3 text-xs font-black text-emerald-300">PORTADA DEFINITIVA ✓</p>}
                </div>
              </article>
            ))}
          </div>

          {etapaSeleccion && puedeTomarFotos && (
            <p className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4 text-center text-sm font-black text-amber-200">Ya completaste las 4 fotografías en sitio. Debes elegir una como definitiva antes de continuar. Al elegirla, las otras tres se eliminarán.</p>
          )}
        </section>

        <Bloque titulo="Datos del cliente">
          <Dato etiqueta="Nombre" valor={textoSnapshot(snapshot, "nombre", inspeccion.cliente.nombre)} />
          <Dato etiqueta="Teléfono" valor={textoSnapshot(snapshot, "telefono", inspeccion.cliente.telefono ?? "—")} />
          <Dato etiqueta="Correo" valor={textoSnapshot(snapshot, "correo", inspeccion.cliente.correo ?? "—")} />
          <Dato etiqueta="Tipo de cliente" valor={textoSnapshot(snapshot, "tipoCliente", String(inspeccion.cliente.tipo))} />
          <Dato etiqueta="Empresa" valor={textoSnapshot(snapshot, "empresa", inspeccion.cliente.empresa ?? "—")} />
          <Dato etiqueta="Ciudad" valor={textoSnapshot(snapshot, "ciudadCliente", inspeccion.cliente.ciudad ?? "—")} />
        </Bloque>

        <Bloque titulo="Datos del inmueble">
          <Dato etiqueta="Dirección" valor={textoSnapshot(snapshot, "direccionInmueble", inspeccion.inmueble?.direccion ?? inspeccion.direccion)} />
          <Dato etiqueta="Ciudad" valor={textoSnapshot(snapshot, "ciudadInmueble", inspeccion.inmueble?.ciudad ?? inspeccion.ciudad)} />
          <Dato etiqueta="m² de terreno" valor={textoSnapshot(snapshot, "m2Terreno", inspeccion.inmueble?.superficieTerrenoM2?.toString() ?? "—")} />
          <Dato etiqueta="m² de construcción" valor={textoSnapshot(snapshot, "m2Construccion", inspeccion.inmueble?.superficieConstruccionM2?.toString() ?? "—")} />
          <Dato etiqueta="Niveles" valor={textoSnapshot(snapshot, "niveles")} />
          <Dato etiqueta="Recámaras" valor={textoSnapshot(snapshot, "recamaras")} />
          <Dato etiqueta="Baños" valor={textoSnapshot(snapshot, "banos")} />
        </Bloque>

        <section className="mt-5 rounded-3xl border border-white/10 bg-slate-900 p-5 sm:p-6">
          <h2 className="text-xl font-black">Áreas declaradas</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {areasDeclaradas.map((area) => <span key={area} className="rounded-full bg-cyan-300/10 px-3 py-2 text-sm font-bold text-cyan-200">{area}</span>)}
            {areasDeclaradas.length === 0 && <span className="text-sm text-slate-500">No hay áreas binarias registradas en la versión disponible.</span>}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Dato etiqueta="Recámaras" valor={textoSnapshot(snapshot, "recamaras")} />
            <Dato etiqueta="Baños" valor={textoSnapshot(snapshot, "banos")} />
            <Dato etiqueta="Niveles" valor={textoSnapshot(snapshot, "niveles")} />
          </div>
          {otrosEspacios && <p className="mt-4 rounded-2xl bg-white/5 p-4 text-sm text-slate-300"><strong>Otros espacios:</strong> {otrosEspacios}</p>}
        </section>

        <section className="mt-5 rounded-3xl border border-amber-300/20 bg-amber-300/5 p-5 sm:p-6">
          <h2 className="text-xl font-black">Importe de cotización</h2>
          <p className="mt-3 text-3xl font-black text-amber-300">{dinero(inspeccion.cotizacion?.total ?? 0)}</p>
          <p className="mt-1 text-sm text-slate-400">Folio: {inspeccion.cotizacion?.folio ?? "Sin cotización"}</p>
        </section>

        {solicitudes.length > 0 && (
          <section className="mt-5 rounded-3xl border border-white/10 bg-slate-900 p-5 sm:p-6">
            <h2 className="text-xl font-black">Solicitudes de corrección</h2>
            <div className="mt-4 space-y-3">
              {solicitudes.map((s) => {
                const puedeResolver = s.estado === "PENDIENTE" && (esDirector || (esAdministrador && s.asignadaAId === usuario.id));
                return (
                  <article key={s.id} className={`rounded-2xl border p-4 ${s.estado === "PENDIENTE" ? "border-amber-300/20 bg-amber-300/5" : "border-emerald-300/20 bg-emerald-300/5"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-black">{ETIQUETAS_TIPO[s.tipo] ?? s.tipo}</p>
                      <span className="text-xs font-black">{s.estado}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-300">Responsable: {s.asignadaA ?? "Sin asignar"} {s.rolAsignado ? `(${s.rolAsignado})` : ""}</p>
                    {s.detalle && <p className="mt-2 text-sm text-slate-400">{s.detalle}</p>}
                    {s.comentarioResolucion && <p className="mt-2 text-sm text-emerald-200">Resolución: {s.comentarioResolucion}</p>}
                    {puedeResolver && (
                      <form action={resolverSolicitudCorreccion} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                        <input type="hidden" name="inspeccionId" value={id} />
                        <input type="hidden" name="solicitudId" value={s.id} />
                        <input name="comentario" required placeholder="Indica qué se corrigió" className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm" />
                        <button className="rounded-xl bg-emerald-300 px-5 py-3 font-black text-slate-950">MARCAR CORREGIDA</button>
                      </form>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {puedeSolicitar && (
          <section className="mt-7 rounded-3xl border border-rose-300/20 bg-rose-300/5 p-5 sm:p-6">
            <h2 className="text-xl font-black">¿El cliente detectó un dato incorrecto?</h2>
            <p className="mt-2 text-sm text-slate-300">El responsable de la revisión no modifica directamente los datos. Selecciona la sección y el sistema enviará la instrucción al Administrador; si no hay uno disponible, al Director.</p>
            <form action={solicitarCorreccionPrevia} className="mt-4 grid gap-3">
              <input type="hidden" name="inspeccionId" value={id} />
              <select name="tipoCorreccion" required defaultValue="" className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 font-bold">
                <option value="" disabled>CORREGIR...</option>
                <option value="AREAS_DECLARADAS">ÁREAS DECLARADAS</option>
                <option value="DATOS_CLIENTE">DATOS DEL CLIENTE</option>
                <option value="DATOS_INMUEBLE">DATOS DEL INMUEBLE</option>
                <option value="IMPORTE_COTIZACION">IMPORTE DE COTIZACIÓN</option>
              </select>
              <textarea name="detalle" rows={3} placeholder="Describe brevemente qué indicó el cliente que debe corregirse" className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm" />
              <button className="rounded-xl border border-rose-300/30 px-5 py-3 font-black text-rose-200">ENVIAR SOLICITUD DE CORRECCIÓN</button>
            </form>
          </section>
        )}

        {responsableRevision && (
          <section className={`mt-7 rounded-3xl border p-6 text-center ${puedeIniciar ? "border-emerald-300/30 bg-emerald-300/10" : "border-white/10 bg-slate-900"}`}>
            <h2 className="text-2xl font-black">Inicio físico de la inspección</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-300">INICIAR solo se habilita cuando la información fue revisada con el cliente, existe una sola fotografía definitiva —elegida entre 4 tomadas en sitio o cargada como 1 foto existente— y no hay correcciones pendientes.</p>
            {pendientes.length > 0 && <p className="mt-3 font-black text-amber-300">Bloqueado: hay {pendientes.length} corrección(es) pendiente(s).</p>}
            {!fotoDefinitiva && <p className="mt-3 font-black text-amber-300">Bloqueado: define la fachada mediante 4 fotografías en sitio o 1 fotografía existente.</p>}
            <form action={iniciarInspeccionConfirmada} className="mt-5">
              <input type="hidden" name="inspeccionId" value={id} />
              <button disabled={!puedeIniciar} className="rounded-full bg-emerald-300 px-10 py-4 text-lg font-black text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">INICIAR</button>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 rounded-3xl border border-white/10 bg-slate-900 p-5 sm:p-6">
      <h2 className="text-xl font-black">{titulo}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-2xl bg-slate-950 p-4">
      <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">{etiqueta}</p>
      <p className="mt-1 font-bold text-slate-100">{valor || "—"}</p>
    </div>
  );
}
