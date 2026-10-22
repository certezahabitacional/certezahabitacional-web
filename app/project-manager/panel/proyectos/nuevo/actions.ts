"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectManagerDirector } from "@/lib/project-manager/access";

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function parseDate(value: string) {
  return value ? new Date(value + "T00:00:00.000Z") : null;
}

export async function crearProyectoPM(formData: FormData) {
  const { session } = await requireProjectManagerDirector();
  const usuarioId = String((session.user as { id?: string }).id ?? "");
  if (!usuarioId) redirect("/project-manager/login");

  const nombre = clean(formData.get("nombre"));
  const cliente = clean(formData.get("cliente"));
  const ubicacion = clean(formData.get("ubicacion"));
  const descripcion = clean(formData.get("descripcion"));
  const fechaInicio = clean(formData.get("fechaInicio"));
  const fechaFinPlan = clean(formData.get("fechaFinPlan"));
  const presupuestoRaw = clean(formData.get("presupuesto"));
  const presupuesto = presupuestoRaw ? Number(presupuestoRaw.replace(/,/g,"")) : 0;

  if (nombre.length < 3 || !Number.isFinite(presupuesto) || presupuesto < 0) {
    redirect("/project-manager/panel/proyectos/nuevo?error=datos");
  }

  const existentes = await prisma.proyectoPM.findMany({
    select:{codigo:true},
    where:{codigo:{startsWith:"PR-"}},
  });

  const max = existentes.reduce((acc,p)=>{
    const n = Number(p.codigo.replace(/^PR-/,""));
    return Number.isFinite(n) ? Math.max(acc,n) : acc;
  },2);

  const codigo = `PR-${String(max+1).padStart(4,"0")}`;

  await prisma.proyectoPM.create({
    data:{
      codigo,
      nombre,
      cliente: cliente || null,
      ubicacion: ubicacion || null,
      descripcion: descripcion || null,
      fechaInicio: parseDate(fechaInicio),
      fechaFinPlan: parseDate(fechaFinPlan),
      presupuesto,
      estado:"PLANEACION",
      creadoPorId:usuarioId,
      participantes:{
        create:{
          usuarioId,
          rolEnProyecto:"DIRECTOR",
          soloLectura:false,
        }
      }
    }
  });

  redirect(`/project-manager/panel/proyectos/${codigo.toLowerCase()}?creado=1`);
}
