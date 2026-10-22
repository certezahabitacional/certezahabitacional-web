"use server";

import { signOut } from "@/auth";

export async function cerrarSesionProjectManager() {
  await signOut({ redirectTo: "/project-manager/login" });
}
