"use server";
import { EstadoInspeccion, RolUsuario, TipoEvento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { vistaPreviaPartidasCotizadas } from "@/lib/vista-previa-partidas-cotizadas";

export async function guardarAuditoriaPrevia(formData: FormData) {
  const id = String(formData.get("inspeccionId") ?? "").trim();
  if (!id) redirect("/panel/inspecciones");
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const [usuario, inspeccion] = await Promise.all([
    prisma.usuario.findUnique({where:{id:session.user.id},select:{id:true,rol:true,activo:true,inspector:{select:{id:true,activo:true}}}}),
    prisma.inspeccion.findUnique({where:{id},select:{id:true,estado:true,inspectorId:true,cotizacion:{select:{versiones:{orderBy:{version:"desc"},take:1,select:{datos:true}}}}}}),
  ]);
  if (!usuario?.activo || !inspeccion) redirect("/acceso");
  const permitido = usuario.rol===RolUsuario.DIRECTOR ||
    (usuario.rol===RolUsuario.INSPECTOR && usuario.inspector?.activo===true && usuario.inspector.id===inspeccion.inspectorId);
  if (!permitido || inspeccion.estado!==EstadoInspeccion.PROGRAMADA) redirect("/acceso");
  const raw = inspeccion.cotizacion?.versiones[0]?.datos;
  const snapshot = raw && typeof raw==="object" && !Array.isArray(raw) ? raw as Record<string,unknown> : {};
  const partidas = vistaPreviaPartidasCotizadas(snapshot).map(partida=>({
    orden:partida.orden,nombre:partida.nombre,
    subpartidas:partida.subpartidas.map(subpartida=>({
      nombre:subpartida.nombre,
      conceptos:subpartida.conceptos.map((concepto,i)=>({
        nombre:concepto,aplica:formData.get(`concepto:${partida.orden}:${subpartida.nombre}:${i}`)!=="no",
      })),
    })),
  }));
  const actualizadas = await prisma.$executeRaw`
    INSERT INTO "PlanPrevioInspeccion" ("inspeccionId","partidas","actualizadoPorId")
    VALUES (${id}, ${JSON.stringify(partidas)}::jsonb, ${usuario.id})
    ON CONFLICT ("inspeccionId") DO UPDATE
    SET "partidas"=EXCLUDED."partidas", "version"="PlanPrevioInspeccion"."version"+1,
        "actualizadoEn"=NOW(),"actualizadoPorId"=EXCLUDED."actualizadoPorId"
    WHERE "PlanPrevioInspeccion"."confirmadoEn" IS NULL
  `;
  if (actualizadas===0) redirect(`/panel/inspecciones/${id}/revision-inicial?error=${encodeURIComponent("El plan ya está confirmado y no admite cambios.")}`);
  await registrarAuditoria({tipo:TipoEvento.EDITAR,entidad:"PlanPrevioInspeccion",entidadId:id,inspeccionId:id,usuarioId:usuario.id,descripcion:"Se guardó la aplicabilidad preliminar de los conceptos de inspección."});
  revalidatePath(`/panel/inspecciones/${id}/revision-inicial`);
  redirect(`/panel/inspecciones/${id}/revision-inicial?ok=${encodeURIComponent("Auditoría preliminar guardada.")}`);
}
