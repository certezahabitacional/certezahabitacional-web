import { redirect } from "next/navigation";

import { obtenerUsuarioConAlcanceZona } from "@/lib/alcance-zona";

export async function obtenerAdministradorActual() {
  const administrador = await obtenerUsuarioConAlcanceZona("/panel/usuarios");

  const tieneAcceso =
    administrador.rol === "DIRECTOR" ||
    administrador.rol === "ADMINISTRADOR";

  if (!tieneAcceso) redirect("/panel");

  return administrador;
}
