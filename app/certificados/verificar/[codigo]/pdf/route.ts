import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> },
) {
  const { codigo } = await params;
  const certificado = await prisma.certificado.findUnique({
    where: { codigoValidacion: codigo },
    include: {
      inspeccion: {
        include: {
          cliente: true,
          inmueble: true,
          inspector: { include: { usuario: true } },
          revisiones: {
            where: { rol: "DIRECTOR", decision: "APROBADO", estado: "VIGENTE" },
            orderBy: { creadaEn: "desc" },
            take: 1,
            include: { usuario: true },
          },
        },
      },
    },
  });

  if (!certificado || !certificado.vigente || certificado.inspeccion.estado !== "FINALIZADA") {
    return NextResponse.json({ error: "Certificado liberado no disponible." }, { status: 404 });
  }

  const inspeccion = certificado.inspeccion;
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([612, 792]);

  page.drawRectangle({ x: 24, y: 24, width: 564, height: 744, borderWidth: 3, borderColor: rgb(0.06,0.10,0.17) });
  page.drawRectangle({ x: 32, y: 32, width: 548, height: 728, borderWidth: 1, borderColor: rgb(0.82,0.62,0.20) });

  let y = 710;
  const line=(label:string,value:string,size=11)=>{
    page.drawText(label,{x:58,y,size:9,font:bold,color:rgb(0.42,0.47,0.55)});
    y-=15;
    page.drawText(value,{x:58,y,size,font:bold,color:rgb(0.08,0.12,0.20),maxWidth:496});
    y-=28;
  };

  page.drawText("CERTEZA HABITACIONAL",{x:58,y,size:23,font:bold,color:rgb(0.08,0.12,0.20)});
  y-=34;
  page.drawText("CERTIFICADO LIBERADO",{x:58,y,size:18,font:bold,color:rgb(0.82,0.52,0.08)});
  y-=42;

  line("CERTIFICADO",certificado.folio);
  line("INSPECCIÓN",inspeccion.folio);
  line("CLIENTE",inspeccion.cliente.nombre);
  line("INMUEBLE",inspeccion.inmueble?.alias ?? inspeccion.tipoInmueble);
  line("DIRECCIÓN",`${inspeccion.direccion}, ${inspeccion.ciudad}`,10);
  line("INSPECTOR",inspeccion.inspector?.usuario.nombre ?? "Inspector asignado");
  line("CALIFICACIÓN TÉCNICA CERTEZA",`${Number(certificado.ish).toFixed(2)} / 100`,16);

  if (inspeccion.revisiones[0]) {
    line("AUTORIZADO POR DIRECCIÓN",`${inspeccion.revisiones[0].usuario.nombre} · ${inspeccion.revisiones[0].creadaEn.toLocaleDateString("es-MX")}`,10);
  }

  page.drawText("DICTAMEN",{x:58,y,size:10,font:bold,color:rgb(0.42,0.47,0.55)});
  y-=18;
  const words=String(certificado.dictamen ?? "").split(/\s+/);
  let current="";
  const rows:string[]=[];
  for(const word of words){
    const test=current ? `${current} ${word}` : word;
    if(regular.widthOfTextAtSize(test,9)<=496) current=test;
    else { if(current) rows.push(current); current=word; }
  }
  if(current) rows.push(current);
  for(const row of rows.slice(0,10)){
    page.drawText(row,{x:58,y,size:9,font:regular,color:rgb(0.18,0.22,0.28)});
    y-=13;
  }

  y-=12;
  page.drawText(`Código de validación: ${certificado.codigoValidacion}`,{x:58,y,size:9,font:bold,color:rgb(0.08,0.12,0.20)});
  y-=18;
  page.drawText("Documento liberado por Dirección y vigente en la plataforma Certeza Habitacional.",{x:58,y,size:9,font:regular,color:rgb(0.35,0.40,0.47)});

  page.drawText("www.certezahabitacional.com",{x:58,y:52,size:9,font:bold,color:rgb(0.08,0.12,0.20)});

  const bytes=await pdf.save();
  const descargar=request.nextUrl.searchParams.get("download")==="1";
  const nombre=`${inspeccion.folio}-certificado-liberado.pdf`.replace(/[^A-Za-z0-9._-]/g,"_");

  return new NextResponse(Buffer.from(bytes),{
    status:200,
    headers:{
      "Content-Type":"application/pdf",
      "Content-Disposition":`${descargar?"attachment":"inline"}; filename="${nombre}"`,
      "Cache-Control":"private, no-store, max-age=0",
      "X-Robots-Tag":"noindex, nofollow",
    },
  });
}
