import { RolUsuario } from "@prisma/client";

export type AccionSistema =
  | "PORTAL_ACCEDER"
  | "PANEL_ACCEDER"
  | "AGENDA_VER_GENERAL"
  | "AGENDA_VER_PROPIA"
  | "COTIZACION_SOLICITAR"
  | "COTIZACION_VER"
  | "COTIZACION_CREAR"
  | "COTIZACION_EDITAR"
  | "COTIZACION_AUTORIZAR"
  | "COTIZACION_ACEPTAR_RECHAZAR"
  | "COTIZACION_IMPRIMIR"
  | "COTIZACION_DESCARGAR"
  | "COTIZACION_ENVIAR"
  | "PAQUETE_GESTIONAR"
  | "CLIENTE_CREAR"
  | "CLIENTE_EDITAR_ADMIN"
  | "INMUEBLE_CREAR"
  | "INMUEBLE_EDITAR_ADMIN"
  | "DATOS_ADMIN_VER"
  | "PAGO_VER"
  | "PAGO_CAPTURAR"
  | "LIBERACION_ADMINISTRATIVA"
  | "INSPECCION_PROGRAMAR"
  | "INSPECCION_REPROGRAMAR"
  | "INSPECCION_ASIGNAR_INSPECTOR"
  | "INSPECCION_REASIGNAR_PROPONER"
  | "INSPECCION_REASIGNAR_RESOLVER"
  | "INSPECCION_CREAR_SEGUIMIENTO"
  | "INSPECCION_INICIAR"
  | "HALLAZGO_CAPTURAR"
  | "HALLAZGO_EDITAR"
  | "EVIDENCIA_CAPTURAR"
  | "EVIDENCIA_EDITAR"
  | "SEGUIMIENTO_REGISTRAR"
  | "CAPTURA_FINALIZAR"
  | "EXPEDIENTE_VER_TECNICO"
  | "REPORTE_VER"
  | "REPORTE_IMPRIMIR"
  | "REPORTE_DESCARGAR"
  | "EXPEDIENTE_REVISAR_COORDINACION"
  | "EXPEDIENTE_DEVOLVER_INSPECTOR"
  | "EXPEDIENTE_VISTO_BUENO"
  | "EXPEDIENTE_REVISAR_GERENCIA"
  | "EXPEDIENTE_DEVOLVER_COORDINACION"
  | "EXPEDIENTE_AUTORIZAR"
  | "EXPEDIENTE_REABRIR_AUTORIZADO"
  | "EXPEDIENTE_DECLINAR_AUTORIZADO"
  | "CERTIFICADO_VER"
  | "CERTIFICADO_IMPRIMIR"
  | "CERTIFICADO_EMITIR"
  | "CERTIFICADO_REVOCAR"
  | "CERTIFICADO_REACTIVAR"
  | "OBSERVACION_CLIENTE_CREAR"
  | "OBSERVACION_CLIENTE_REVISAR"
  | "USUARIO_CREAR_BASICO"
  | "USUARIO_CREAR_ADMINISTRADOR"
  | "USUARIO_CREAR_DIRECTOR"
  | "USUARIO_ACTIVAR_DESACTIVAR_BASICO"
  | "USUARIO_RESTABLECER_PASSWORD_BASICO"
  | "USUARIO_GESTIONAR_ADMINISTRADOR"
  | "USUARIO_GESTIONAR_DIRECTOR"
  | "PASSWORD_EXISTENTE_VER"
  | "REGISTRO_ELIMINAR_FISICO"
  | "AUDITORIA_VER_OPERATIVA"
  | "AUDITORIA_VER_TOTAL"
  | "EXCEPCION_AUTORIZAR"
  | "CONFIGURACION_TOTAL"
  | "ESTRUCTURA_ORGANIZACIONAL_MODIFICAR"
  | "NOTIFICACIONES_VER";

type MatrizPermisos = Record<RolUsuario, ReadonlySet<AccionSistema>>;

const accionesDirector: AccionSistema[] = [
  "PORTAL_ACCEDER","PANEL_ACCEDER","AGENDA_VER_GENERAL","AGENDA_VER_PROPIA",
  "COTIZACION_SOLICITAR","COTIZACION_VER","COTIZACION_CREAR","COTIZACION_EDITAR",
  "COTIZACION_AUTORIZAR","COTIZACION_IMPRIMIR","COTIZACION_DESCARGAR","COTIZACION_ENVIAR",
  "PAQUETE_GESTIONAR","CLIENTE_CREAR","CLIENTE_EDITAR_ADMIN","INMUEBLE_CREAR",
  "INMUEBLE_EDITAR_ADMIN","DATOS_ADMIN_VER","PAGO_VER","PAGO_CAPTURAR",
  "LIBERACION_ADMINISTRATIVA","INSPECCION_PROGRAMAR","INSPECCION_REPROGRAMAR",
  "INSPECCION_ASIGNAR_INSPECTOR","INSPECCION_REASIGNAR_PROPONER",
  "INSPECCION_REASIGNAR_RESOLVER","INSPECCION_CREAR_SEGUIMIENTO","INSPECCION_INICIAR",
  "HALLAZGO_CAPTURAR","HALLAZGO_EDITAR","EVIDENCIA_CAPTURAR","EVIDENCIA_EDITAR",
  "SEGUIMIENTO_REGISTRAR","CAPTURA_FINALIZAR","EXPEDIENTE_VER_TECNICO","REPORTE_VER",
  "REPORTE_IMPRIMIR","REPORTE_DESCARGAR","EXPEDIENTE_REVISAR_COORDINACION",
  "EXPEDIENTE_DEVOLVER_INSPECTOR","EXPEDIENTE_VISTO_BUENO","EXPEDIENTE_REVISAR_GERENCIA",
  "EXPEDIENTE_DEVOLVER_COORDINACION","EXPEDIENTE_AUTORIZAR","EXPEDIENTE_REABRIR_AUTORIZADO",
  "EXPEDIENTE_DECLINAR_AUTORIZADO","CERTIFICADO_VER","CERTIFICADO_IMPRIMIR",
  "CERTIFICADO_EMITIR","CERTIFICADO_REVOCAR","CERTIFICADO_REACTIVAR",
  "OBSERVACION_CLIENTE_CREAR","OBSERVACION_CLIENTE_REVISAR","USUARIO_CREAR_BASICO",
  "USUARIO_CREAR_ADMINISTRADOR","USUARIO_CREAR_DIRECTOR","USUARIO_ACTIVAR_DESACTIVAR_BASICO",
  "USUARIO_RESTABLECER_PASSWORD_BASICO","USUARIO_GESTIONAR_ADMINISTRADOR",
  "USUARIO_GESTIONAR_DIRECTOR","REGISTRO_ELIMINAR_FISICO","AUDITORIA_VER_OPERATIVA",
  "AUDITORIA_VER_TOTAL","EXCEPCION_AUTORIZAR","CONFIGURACION_TOTAL",
  "ESTRUCTURA_ORGANIZACIONAL_MODIFICAR","NOTIFICACIONES_VER",
];

export const MATRIZ_PERMISOS: MatrizPermisos = {
  [RolUsuario.CLIENTE]: new Set<AccionSistema>([
    "PORTAL_ACCEDER","COTIZACION_SOLICITAR","COTIZACION_VER",
    "COTIZACION_ACEPTAR_RECHAZAR","COTIZACION_IMPRIMIR","COTIZACION_DESCARGAR",
    "REPORTE_VER","REPORTE_IMPRIMIR","REPORTE_DESCARGAR","CERTIFICADO_VER",
    "CERTIFICADO_IMPRIMIR","OBSERVACION_CLIENTE_CREAR","NOTIFICACIONES_VER",
  ]),
  [RolUsuario.INSPECTOR]: new Set<AccionSistema>([
    "PANEL_ACCEDER","AGENDA_VER_PROPIA","INSPECCION_INICIAR","HALLAZGO_CAPTURAR",
    "HALLAZGO_EDITAR","EVIDENCIA_CAPTURAR","EVIDENCIA_EDITAR","SEGUIMIENTO_REGISTRAR",
    "CAPTURA_FINALIZAR","EXPEDIENTE_VER_TECNICO","REPORTE_VER","CERTIFICADO_VER",
    "NOTIFICACIONES_VER",
  ]),
  [RolUsuario.COORDINADOR]: new Set<AccionSistema>([
    "PANEL_ACCEDER","EXPEDIENTE_VER_TECNICO","REPORTE_VER","CERTIFICADO_VER",
    "EXPEDIENTE_REVISAR_COORDINACION","EXPEDIENTE_DEVOLVER_INSPECTOR",
    "EXPEDIENTE_VISTO_BUENO","NOTIFICACIONES_VER",
  ]),
  [RolUsuario.GERENTE]: new Set<AccionSistema>([
    "PANEL_ACCEDER","AGENDA_VER_GENERAL","AGENDA_VER_PROPIA","COTIZACION_VER",
    "INSPECCION_REASIGNAR_PROPONER","EXPEDIENTE_VER_TECNICO","REPORTE_VER",
    "CERTIFICADO_VER","CERTIFICADO_IMPRIMIR","CERTIFICADO_EMITIR",
    "EXPEDIENTE_REVISAR_GERENCIA","EXPEDIENTE_DEVOLVER_COORDINACION",
    "EXPEDIENTE_AUTORIZAR","OBSERVACION_CLIENTE_REVISAR","NOTIFICACIONES_VER",
  ]),
  [RolUsuario.VENDEDOR]: new Set<AccionSistema>([
    "PANEL_ACCEDER","AGENDA_VER_GENERAL","COTIZACION_VER",
    "CLIENTE_EDITAR_ADMIN","NOTIFICACIONES_VER",
  ]),
  [RolUsuario.ADMINISTRADOR]: new Set<AccionSistema>([
    "PANEL_ACCEDER","AGENDA_VER_GENERAL","COTIZACION_VER","COTIZACION_CREAR",
    "COTIZACION_EDITAR","COTIZACION_AUTORIZAR","COTIZACION_IMPRIMIR",
    "COTIZACION_DESCARGAR","COTIZACION_ENVIAR","PAQUETE_GESTIONAR","CLIENTE_CREAR",
    "CLIENTE_EDITAR_ADMIN","INMUEBLE_CREAR","INMUEBLE_EDITAR_ADMIN","DATOS_ADMIN_VER",
    "PAGO_VER","PAGO_CAPTURAR","LIBERACION_ADMINISTRATIVA","INSPECCION_PROGRAMAR",
    "INSPECCION_REPROGRAMAR","INSPECCION_ASIGNAR_INSPECTOR",
    "INSPECCION_REASIGNAR_RESOLVER","INSPECCION_CREAR_SEGUIMIENTO","REPORTE_VER",
    "REPORTE_IMPRIMIR","REPORTE_DESCARGAR","CERTIFICADO_VER","CERTIFICADO_IMPRIMIR",
    "OBSERVACION_CLIENTE_REVISAR","USUARIO_CREAR_BASICO","USUARIO_ACTIVAR_DESACTIVAR_BASICO",
    "USUARIO_RESTABLECER_PASSWORD_BASICO","NOTIFICACIONES_VER",
  ]),
  [RolUsuario.DIRECTOR]: new Set<AccionSistema>(accionesDirector),
};

export function puede(rol: RolUsuario, accion: AccionSistema): boolean {
  if (accion === "PASSWORD_EXISTENTE_VER") return false;
  return MATRIZ_PERMISOS[rol]?.has(accion) ?? false;
}

export function exigirPermiso(rol: RolUsuario, accion: AccionSistema): void {
  if (!puede(rol, accion)) {
    throw new Error(`El rol ${rol} no tiene facultad para ejecutar ${accion}.`);
  }
}

export function esRolAdministrativo(rol: RolUsuario): boolean {
  return rol === RolUsuario.ADMINISTRADOR || rol === RolUsuario.DIRECTOR;
}

export function esRolTecnico(rol: RolUsuario): boolean {
  return rol === RolUsuario.INSPECTOR || rol === RolUsuario.COORDINADOR ||
    rol === RolUsuario.GERENTE || rol === RolUsuario.DIRECTOR;
}

export const puedeVerDatosAdministrativos = (rol: RolUsuario) => puede(rol, "DATOS_ADMIN_VER");
export const puedeVerCotizaciones = (rol: RolUsuario) => puede(rol, "COTIZACION_VER");
export const cotizacionEsSoloLectura = (rol: RolUsuario) =>
  rol === RolUsuario.GERENTE || rol === RolUsuario.VENDEDOR;
export const puedeVerExpedienteTecnico = (rol: RolUsuario) => puede(rol, "EXPEDIENTE_VER_TECNICO");
export const puedeManipularExpedienteAutorizado = (rol: RolUsuario) => rol === RolUsuario.DIRECTOR;
export const puedeAutorizarExcepcion = (rol: RolUsuario) => rol === RolUsuario.DIRECTOR;
export const puedeVerPasswordExistente = () => false;

export function puedeAdministrarUsuario(actor: RolUsuario, objetivo: RolUsuario): boolean {
  if (actor === RolUsuario.DIRECTOR) return true;
  if (actor !== RolUsuario.ADMINISTRADOR) return false;
  return (
    objetivo === RolUsuario.CLIENTE ||
    objetivo === RolUsuario.VENDEDOR ||
    objetivo === RolUsuario.INSPECTOR ||
    objetivo === RolUsuario.COORDINADOR ||
    objetivo === RolUsuario.GERENTE
  );
}
export const puedeCrearUsuario = puedeAdministrarUsuario;
export const puedeCambiarPasswordDeUsuario = puedeAdministrarUsuario;
export const puedeActivarDesactivarUsuario = puedeAdministrarUsuario;
export const puedeEliminarFisicamente = (rol: RolUsuario) => rol === RolUsuario.DIRECTOR;

export type ContextoUsuario = {
  id: string;
  rol: RolUsuario;
  zonaId?: string | null;
  gerenteId?: string | null;
  coordinadorId?: string | null;
  clienteId?: string | null;
  inspectorId?: string | null;
};

export type ContextoInspeccion = {
  id: string;
  zonaId?: string | null;
  clienteId?: string | null;
  inspectorId?: string | null;
  inspectorUsuarioId?: string | null;
  inspectorZonaId?: string | null;
  coordinadorUsuarioId?: string | null;
  gerenteUsuarioId?: string | null;
  requiereGerenteZona?: boolean;
  requiereCoordinador?: boolean;
};

export function estaDentroDelAlcanceDeInspeccion(
  usuario: ContextoUsuario,
  inspeccion: ContextoInspeccion,
): boolean {
  switch (usuario.rol) {
    case RolUsuario.DIRECTOR:
      return true;
    case RolUsuario.ADMINISTRADOR:
    case RolUsuario.VENDEDOR:
      return false;
    case RolUsuario.GERENTE:
      return Boolean(
        inspeccion.requiereGerenteZona &&
        inspeccion.gerenteUsuarioId === usuario.id
      );
    case RolUsuario.COORDINADOR:
      return Boolean(
        inspeccion.requiereCoordinador &&
        inspeccion.coordinadorUsuarioId === usuario.id
      );
    case RolUsuario.INSPECTOR:
      if (usuario.inspectorId && inspeccion.inspectorId) {
        return usuario.inspectorId === inspeccion.inspectorId;
      }
      return Boolean(inspeccion.inspectorUsuarioId === usuario.id);
    case RolUsuario.CLIENTE:
      return Boolean(
        usuario.clienteId &&
        inspeccion.clienteId &&
        usuario.clienteId === inspeccion.clienteId
      );
    default:
      return false;
  }
}

export function puedeAbrirExpedienteTecnico(usuario: ContextoUsuario, inspeccion: ContextoInspeccion): boolean {
  return puedeVerExpedienteTecnico(usuario.rol) &&
    estaDentroDelAlcanceDeInspeccion(usuario, inspeccion);
}

export function puedeEditarComoInspector(usuario: ContextoUsuario, inspeccion: ContextoInspeccion): boolean {
  if (usuario.rol === RolUsuario.DIRECTOR) return true;
  return usuario.rol === RolUsuario.INSPECTOR &&
    estaDentroDelAlcanceDeInspeccion(usuario, inspeccion);
}

export function puedeRevisarComoCoordinador(usuario: ContextoUsuario, inspeccion: ContextoInspeccion): boolean {
  if (usuario.rol === RolUsuario.DIRECTOR) return true;
  return usuario.rol === RolUsuario.COORDINADOR &&
    estaDentroDelAlcanceDeInspeccion(usuario, inspeccion);
}

export function puedeRevisarComoGerente(usuario: ContextoUsuario, inspeccion: ContextoInspeccion): boolean {
  if (usuario.rol === RolUsuario.DIRECTOR) return true;
  return usuario.rol === RolUsuario.GERENTE &&
    estaDentroDelAlcanceDeInspeccion(usuario, inspeccion);
}

export function puedeAsignarInspectorEnZona(usuario: ContextoUsuario, _zonaId: string | null | undefined): boolean {
  return usuario.rol === RolUsuario.DIRECTOR || usuario.rol === RolUsuario.ADMINISTRADOR;
}

export function puedeAuditarUsuario(
  actor: ContextoUsuario,
  _objetivo: { rol: RolUsuario; zonaId?: string | null },
): boolean {
  return actor.rol === RolUsuario.DIRECTOR;
}

export function puedeSuplantarUsuario(): boolean {
  return false;
}
