import { RolUsuario } from "@prisma/client";

export type ModuloPanel =
  | "INSPECCIONES"
  | "CLIENTES"
  | "INMUEBLES"
  | "AGENDA"
  | "PRE_COTIZACIONES"
  | "COTIZACIONES"
  | "CAJA"
  | "INSPECTORES"
  | "AUDITORIA"
  | "USUARIOS"
  | "CONFIGURACION"
  | "NUEVA_INSPECCION";

export type OpcionNavegacionPanel = {
  modulo: ModuloPanel;
  etiqueta: string;
  href: string;
};

export const OPCIONES_PANEL: readonly OpcionNavegacionPanel[] = [
  { modulo: "INSPECCIONES", etiqueta: "Inspecciones", href: "/panel/inspecciones" },
  { modulo: "CLIENTES", etiqueta: "Clientes", href: "/panel/clientes" },
  { modulo: "INMUEBLES", etiqueta: "Inmuebles", href: "/panel/inmuebles" },
  { modulo: "AGENDA", etiqueta: "Agenda", href: "/panel/agenda" },
  { modulo: "PRE_COTIZACIONES", etiqueta: "Pre-cotizaciones", href: "/panel/pre-cotizaciones" },
  { modulo: "COTIZACIONES", etiqueta: "Cotizaciones", href: "/panel/cotizaciones" },
  { modulo: "CAJA", etiqueta: "Caja", href: "/panel/caja" },
  { modulo: "INSPECTORES", etiqueta: "Inspectores", href: "/panel/inspectores" },
  { modulo: "AUDITORIA", etiqueta: "Auditoría", href: "/panel/auditoria" },
  { modulo: "USUARIOS", etiqueta: "Usuarios", href: "/panel/usuarios" },
  { modulo: "CONFIGURACION", etiqueta: "Configuración", href: "/panel/configuracion" },
  { modulo: "NUEVA_INSPECCION", etiqueta: "Nueva inspección", href: "/panel/inspecciones/nueva" },
] as const;

const MODULOS_POR_ROL: Record<RolUsuario, ReadonlySet<ModuloPanel>> = {
  [RolUsuario.DIRECTOR]: new Set<ModuloPanel>([
    "INSPECCIONES",
    "CLIENTES",
    "INMUEBLES",
    "AGENDA",
    "PRE_COTIZACIONES",
    "COTIZACIONES",
    "CAJA",
    "INSPECTORES",
    "AUDITORIA",
    "USUARIOS",
    "CONFIGURACION",
    "NUEVA_INSPECCION",
  ]),
  [RolUsuario.ADMINISTRADOR]: new Set<ModuloPanel>([
    "INSPECCIONES",
    "CLIENTES",
    "INMUEBLES",
    "AGENDA",
    "PRE_COTIZACIONES",
    "COTIZACIONES",
    "CAJA",
    "INSPECTORES",
    "USUARIOS",
    "NUEVA_INSPECCION",
  ]),
  [RolUsuario.VENDEDOR]: new Set<ModuloPanel>([
    "INSPECCIONES",
    "CLIENTES",
    "INMUEBLES",
    "AGENDA",
    "PRE_COTIZACIONES",
    "COTIZACIONES",
  ]),
  [RolUsuario.GERENTE]: new Set<ModuloPanel>([
    "INSPECCIONES",
    "AGENDA",
    "INSPECTORES",
    "NUEVA_INSPECCION",
  ]),
  [RolUsuario.COORDINADOR]: new Set<ModuloPanel>([
    "INSPECCIONES",
    "AGENDA",
    "INSPECTORES",
  ]),
  [RolUsuario.INSPECTOR]: new Set<ModuloPanel>([
    "INSPECCIONES",
    "AGENDA",
  ]),
  [RolUsuario.CLIENTE]: new Set<ModuloPanel>(),
};

export function puedeVerModuloPanel(rol: RolUsuario, modulo: ModuloPanel): boolean {
  if (rol === RolUsuario.DIRECTOR) return true;
  return MODULOS_POR_ROL[rol]?.has(modulo) ?? false;
}

export function opcionesPanelPorRol(rol: RolUsuario): OpcionNavegacionPanel[] {
  return OPCIONES_PANEL.filter((opcion) => puedeVerModuloPanel(rol, opcion.modulo));
}
