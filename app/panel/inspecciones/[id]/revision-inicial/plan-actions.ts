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
  // Preservar conceptos adicionales capturados anteriormente al guardar aplicabilidad.
  const existentes = await prisma.$queryRaw<Array<{ partidas: unknown }>>`
    SELECT "partidas" FROM "PlanPrevioInspeccion" WHERE "inspeccionId"=${id} AND "confirmadoEn" IS NULL LIMIT 1
  `;
  const previo = existentes[0]?.partidas;
  if (Array.isArray(previo)) {
    for (const anterior of previo) {
      if (!anterior || typeof anterior !== "object") continue;
      const p = anterior as {orden?: number;subpartidas?: Array<{nombre:string;conceptos:Array<{nombre:string;aplica:boolean;adicional?:boolean}>}>};
      const actual = partidas.find(x=>x.orden===p.orden);
      if (!actual || !Array.isArray(p.subpartidas)) continue;
      for (const sub of p.subpartidas) {
        const actualSub = actual.subpartidas.find(x=>x.nombre===sub.nombre);
        if (!actualSub || !Array.isArray(sub.conceptos)) continue;
        for (const concepto of sub.conceptos) {
          if (concepto?.adicional===true && concepto.nombre) {
            actualSub.conceptos.push({nombre:concepto.nombre,aplica:concepto.aplica!==false,adicional:true} as {nombre:string;aplica:boolean});
          }
        }
      }
    }
  }
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

export async function agregarConceptoPrevio(formData: FormData) {
  const id=String(formData.get("inspeccionId")??"").trim();
  const partidaOrden=Number(formData.get("partidaOrden"));
  const subpartidaNombre=String(formData.get("subpartidaNombre")??"").trim();
  const concepto=String(formData.get("conceptoNuevo")??"").trim();
  if (!id) redirect("/panel/inspecciones");
  const destino=`/panel/inspecciones/${id}/revision-inicial`;
  if (!concepto || concepto.length>160 || !subpartidaNombre || !Number.isInteger(partidaOrden)) redirect(`${destino}?error=Datos%20de%20concepto%20invalidos`);
  const session=await auth();
  if (!session?.user?.id) redirect("/login");
  const [usuario,inspeccion]=await Promise.all([
    prisma.usuario.findUnique({where:{id:session.user.id},select:{id:true,activo:true,rol:true,inspector:{select:{id:true,activo:true}}}}),
    prisma.inspeccion.findUnique({where:{id},select:{estado:true,inspectorId:true,cotizacion:{select:{versiones:{orderBy:{version:"desc"},take:1,select:{datos:true}}}}}}),
  ]);
  if (!usuario?.activo || !inspeccion || inspeccion.estado!==EstadoInspeccion.PROGRAMADA) redirect("/acceso");
  if (usuario.rol!==RolUsuario.DIRECTOR && !(usuario.rol===RolUsuario.INSPECTOR && usuario.inspector?.activo && usuario.inspector.id===inspeccion.inspectorId)) redirect("/acceso");
  const raw=inspeccion.cotizacion?.versiones[0]?.datos;
  const snapshot=raw && typeof raw==="object" && !Array.isArray(raw) ? raw as Record<string,unknown> : {};
  const base=vistaPreviaPartidasCotizadas(snapshot);
  const area=base.find(p=>p.orden===partidaOrden);
  if (!area || !area.subpartidas.some(x=>x.nombre===subpartidaNombre)) redirect(`${destino}?error=Area%20no%20disponible`);
  const rows=await prisma.$queryRaw<Array<{partidas: unknown;confirmadoEn:Date|null}>>`
    SELECT "partidas","confirmadoEn" FROM "PlanPrevioInspeccion" WHERE "inspeccionId"=${id} LIMIT 1
  `;
  if(rows[0]?.confirmadoEn) redirect(`${destino}?error=Plan%20confirmado`);
  const partidas=Array.isArray(rows[0]?.partidas)?rows[0].partidas as Array<{orden:number;nombre:string;subpartidas:Array<{nombre:string;conceptos:Array<{nombre:string;aplica:boolean;adicional?:boolean}>}>}>:
    base.map(p=>({orden:p.orden,nombre:p.nombre,subpartidas:p.subpartidas.map(sub=>({nombre:sub.nombre,conceptos:sub.conceptos.map(nombre=>({nombre,aplica:true}))}))}));
  const sub=partidas.find(p=>p.orden===partidaOrden)?.subpartidas.find(x=>x.nombre===subpartidaNombre);
  if(!sub) redirect(`${destino}?error=Area%20no%20encontrada`);
  if(sub.conceptos.some(x=>x.nombre.toLocaleLowerCase("es-MX")===concepto.toLocaleLowerCase("es-MX"))) redirect(`${destino}?error=Concepto%20ya%20existente`);
  sub.conceptos.push({nombre:concepto,aplica:true,adicional:true} as {nombre:string;aplica:boolean});
  await prisma.$executeRaw`
    INSERT INTO "PlanPrevioInspeccion" ("inspeccionId","partidas","actualizadoPorId")
    VALUES (${id},${JSON.stringify(partidas)}::jsonb,${usuario.id})
    ON CONFLICT ("inspeccionId") DO UPDATE SET
      "partidas"=EXCLUDED."partidas","version"="PlanPrevioInspeccion"."version"+1,
      "actualizadoEn"=NOW(),"actualizadoPorId"=EXCLUDED."actualizadoPorId"
    WHERE "PlanPrevioInspeccion"."confirmadoEn" IS NULL
  `;
  await registrarAuditoria({tipo:TipoEvento.EDITAR,entidad:"PlanPrevioInspeccion",entidadId:id,inspeccionId:id,usuarioId:usuario.id,descripcion:`Concepto adicional de auditoría previa en ${subpartidaNombre}: ${concepto}`});
  revalidatePath(destino);
  redirect(`${destino}?ok=${encodeURIComponent("Concepto adicional guardado.")}`);
}
