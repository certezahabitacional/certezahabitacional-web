"use server";

import { redirect } from "next/navigation";

/**
 * Compatibilidad temporal con imports históricos del módulo Clientes.
 *
 * Flujo vigente:
 * - El cliente nace exclusivamente al incorporar una cotización formal.
 * - El panel Clientes es de consulta para Administración y Ventas.
 * - Dirección puede corregir datos desde actions-director.ts.
 * - El acceso del cliente se asigna o restablece exclusivamente desde
 *   /panel/clientes/accesos, sin vincular usuarios CLIENTE arbitrarios.
 *
 * Se conservan estos exports únicamente para no romper referencias antiguas
 * durante la transición. Cualquier invocación queda bloqueada en servidor.
 */
function accionHistoricaBloqueada(mensaje: string): never {
  redirect(`/panel/clientes?error=${encodeURIComponent(mensaje)}`);
}

export async function crearCliente(_formData: FormData) {
  accionHistoricaBloqueada(
    "La creación manual de clientes está deshabilitada. El cliente se genera al incorporar una cotización formal.",
  );
}

export async function actualizarCliente(_formData: FormData) {
  accionHistoricaBloqueada(
    "Esta edición pertenece al flujo histórico. Dirección debe usar la edición vigente del panel Clientes.",
  );
}

export async function vincularUsuarioCliente(_formData: FormData) {
  accionHistoricaBloqueada(
    "La vinculación manual de usuarios CLIENTE está deshabilitada. Usa Asignar acceso desde el expediente del cliente.",
  );
}

export async function desvincularUsuarioCliente(_formData: FormData) {
  accionHistoricaBloqueada(
    "La desvinculación arbitraria del usuario del cliente está deshabilitada. Gestiona el acceso desde el módulo vigente.",
  );
}

export async function eliminarCliente(_formData: FormData) {
  accionHistoricaBloqueada(
    "La eliminación física desde el flujo histórico está deshabilitada para proteger el expediente y sus antecedentes.",
  );
}
