export async function normalizarImagenCliente(
  archivo: File,
  opciones?: { maxDimension?: number; maxBytes?: number },
): Promise<File> {
  const maxDimension = opciones?.maxDimension ?? 1920;
  const maxBytes = opciones?.maxBytes ?? 2_200_000;

  if (!archivo.type.startsWith("image/")) {
    throw new Error("El archivo seleccionado no es una imagen.");
  }

  const url = URL.createObjectURL(archivo);
  try {
    const imagen = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("No fue posible leer la fotografía seleccionada."));
      img.src = url;
    });

    const escala = Math.min(1, maxDimension / Math.max(imagen.naturalWidth, imagen.naturalHeight));
    const ancho = Math.max(1, Math.round(imagen.naturalWidth * escala));
    const alto = Math.max(1, Math.round(imagen.naturalHeight * escala));

    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No fue posible preparar la fotografía.");

    ctx.drawImage(imagen, 0, 0, ancho, alto);

    const convertir = (quality: number) =>
      new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error("No fue posible comprimir la fotografía.")),
          "image/jpeg",
          quality,
        );
      });

    let calidad = 0.82;
    let blob = await convertir(calidad);
    while (blob.size > maxBytes && calidad > 0.42) {
      calidad -= 0.08;
      blob = await convertir(calidad);
    }

    if (blob.size > maxBytes) {
      throw new Error("La fotografía sigue siendo demasiado pesada. Intenta tomarla nuevamente con menor resolución.");
    }

    const nombreBase = archivo.name.replace(/\.[^.]+$/, "") || "evidencia";
    return new File([blob], `${nombreBase}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(url);
  }
}
