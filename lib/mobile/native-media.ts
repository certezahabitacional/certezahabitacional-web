import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Directory, Filesystem } from "@capacitor/filesystem";

export function esAppNativa() {
  return Capacitor.isNativePlatform();
}

export async function capturarFotoNativa() {
  if (!esAppNativa()) return null;

  const foto = await Camera.getPhoto({
    quality: 90,
    allowEditing: false,
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Camera,
    saveToGallery: false,
    correctOrientation: true,
  });

  return foto.dataUrl ?? null;
}

export async function guardarEvidenciaTemporal(
  inspeccionId: string,
  nombre: string,
  dataUrl: string,
) {
  if (!esAppNativa()) return null;

  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  const path = `certeza/${inspeccionId}/${nombre}`;

  const resultado = await Filesystem.writeFile({
    path,
    data: base64,
    directory: Directory.Data,
    recursive: true,
  });

  return resultado.uri;
}
