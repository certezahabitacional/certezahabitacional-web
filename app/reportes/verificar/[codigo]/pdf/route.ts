import { NextRequest, NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> },
) {
  const { codigo } = await params;

  const certificado = await prisma.certificado.findUnique({
    where: { codigoValidacion: codigo },
    select: {
      vigente: true,
      inspeccion: {
        select: {
          folio: true,
          estado: true,
          numeroInspeccion: true,
        },
      },
    },
  });

  if (
    !certificado?.vigente ||
    certificado.inspeccion.estado !== "FINALIZADA" ||
    certificado.inspeccion.numeroInspeccion !== 1
  ) {
    return NextResponse.json({ error: "Reporte oficial no disponible." }, { status: 404 });
  }

  const urlReporte = `${request.nextUrl.origin}/reportes/verificar/${encodeURIComponent(codigo)}`;
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: {
        width: 816,
        height: 1056,
        deviceScaleFactor: 1,
      },
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();
    await page.emulateMediaType("screen");
    await page.goto(urlReporte, {
      waitUntil: "networkidle0",
      timeout: 45000,
    });

    await page.evaluate(async () => {
      const images = Array.from(document.images);
      await Promise.all(
        images.map((img) => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          return new Promise<void>((resolve) => {
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
            window.setTimeout(done, 5000);
          });
        }),
      );
      if (document.fonts?.ready) await document.fonts.ready;
    });

    await new Promise((resolve) => setTimeout(resolve, 750));

    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "0",
        right: "0",
        bottom: "0",
        left: "0",
      },
    });

    const descargar = request.nextUrl.searchParams.get("download") === "1";
    const nombre = `${certificado.inspeccion.folio}-reporte-oficial.pdf`.replace(
      /[^A-Za-z0-9._-]/g,
      "_",
    );

    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${descargar ? "attachment" : "inline"}; filename="${nombre}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (error) {
    console.error("Error generando PDF exacto del reporte:", error);
    return NextResponse.json(
      { error: "No fue posible generar el PDF oficial en este momento." },
      { status: 500 },
    );
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
