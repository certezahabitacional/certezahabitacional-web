import { RolUsuario } from "@prisma/client";

/**
 * MATRIZ MAESTRA DE FACULTADES V1.0
 * Certeza Habitacional
 *
 * Este archivo concentra reglas de autorización y alcance.
 * No reemplaza validaciones de estado de expediente ni validaciones
 * administrativas específicas de cada Server Action.
 *
 * Reglas principales:
 * - DIRECTOR: acceso total operativo/administrativo, excepto decisiones personales de otro actor y visualizar contraseñas existentes.
 * - ADMINISTRADOR: alcance administrativo transversal; sin acceso técnico.
 * - GERENTE: alcance operativo/técnico de su Gerencia; cotizaciones solo lectura.
 * - COORDINADOR: alcance técnico de su Coordinación; sin cotizaciones.
 * - INSPECTOR: solo inspecciones asignadas; sin cotizaciones.
 * - CLIENTE: solo portal y recursos propios.
 */

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
  "PORTAL_ACCEDER",
  "PANEL_ACCEDER",
  "AGENDA_VER_GENERAL",
  "AGENDA_VER_PROPIA",
  "COTIZACION_SOLICITAR",
  "COTIZACION_VER",
  "COTIZACION_CREAR",
  "COTIZACION_EDITAR",
  "COTIZACION_AUTORIZAR",
  "COTIZACION_IMPRIMIR",
  "COTIZACION_DESCARGAR",
  "COTIZACION_ENVIAR",
  "PAQUETE_GESTIONAR",
  "CLIENTE_CREAR",
  "CLIENTE_EDITAR_ADMIN",
  "INMUEBLE_CREAR",
  "INMUEBLE_EDITAR_ADMIN",
  "DATOS_ADMIN_VER",
  "PAGO_VER",
  "PAGO_CAPTURAR",
  "LIBERACION_ADMINISTRATIVA",
  "INSPECCION_PROGRAMAR",
  "INSPECCION_REPROGRAMAR",
  "INSPECCION_ASIGNAR_INSPECTOR",
  "INSPECCION_REASIGNAR_PROPONER",
  "INSPECCION_REASIGNAR_RESOLVER",
  "INSPECCION_CREAR_SEGUIMIENTO",
  "INSPECCION_INICIAR",
  "HALLAZGO_CAPTURAR",
  "HALLAZGO_EDITAR",
  "EVIDENCIA_CAPTURAR",
  "EVIDENCIA_EDITAR",
  "SEGUIMIENTO_REGISTRAR",
  "CAPTURA_FINALIZAR",
  "EXPEDIENTE_VER_TECNICO",
  "REPORTE_VER",
  "REPORTE_IMPRIMIR",
  "REPORTE_DESCARGAR",
  "EXPEDIENTE_REVISAR_COORDINACION",
  "EXPEDIENTE_DEVOLVER_INSPECTOR",
  "EXPEDIENTE_VISTO_BUENO",
  "EXPEDIENTE_REVISAR_GERENCIA",
  "EXPEDIENTE_DEVOLVER_COORDINACION",
  "EXPEDIENTE_AUTORIZAR",
  "EXPEDIENTE_REABRIR_AUTORIZADO",
  "EXPEDIENTE_DECLINAR_AUTORIZADO",
  "CERTIFICADO_VER",
  "CERTIFICADO_IMPRIMIR",
  "CERTIFICADO_EMITIR",
  "CERTIFICADO_REVOCAR",
  "CERTIFICADO_REACTIVAR",
  "OBSERVACION_CLIENTE_CREAR",
  "OBSERVACION_CLIENTE_REVISAR",
  "USUARIO_CREAR_BASICO",
  "USUARIO_CREAR_ADMINISTRADOR",
  "USUARIO_CREAR_DIRECTOR",
  "USUARIO_ACTIVAR_DESACTIVAR_BASICO",
  "USUARIO_RESTABLECER_PASSWORD_BASICO",
  "USUARIO_GESTIONAR_ADMINISTRADOR",
  "USUARIO_GESTIONAR_DIRECTOR",
  "REGISTRO_ELIMINAR_FISICO",
  "AUDITORIA_VER_OPERATIVA",
  "AUDITORIA_VER_TOTAL",
  "EXCEPCION_AUTORIZAR",
  "CONFIGURACION_TOTAL",
  "ESTRUCTURA_ORGANIZACIONAL_MODIFICAR",
  "NOTIFICACIONES_VER",
];

export const MATRIZ_PERMISOS: MatrizPermisos = {
  [RolUsuario.CLIENTE]: new Set<AccionSistema>([
    "PORTAL_ACCEDER",
    "COTIZACION_SOLICITAR",
    "COTIZACION_VER",
    "COTIZACION_ACEPTAR_RECHAZAR",
    "COTIZACION_IMPRIMIR",
    "COTIZACION_DESCARGAR",
    "REPORTE_VER",
    "REPORTE_IMPRIMIR",
    "REPORTE_DESCARGAR",
    "CERTIFICADO_VER",
    "CERTIFICADO_IMPRIMIR",
    "OBSERVACION_CLIENTE_CREAR",
    "NOTIFICACIONES_VER",
  ]),

  [RolUsuario.INSPECTOR]: new Set<AccionSistema>([
    "PANEL_ACCEDER",
    "AGENDA_VER_PROPIA",
    "INSPECCION_INICIAR",
    "HALLAZGO_CAPTURAR",
    "HALLAZGO_EDITAR",
    "EVIDENCIA_CAPTURAR",
    "EVIDENCIA_EDITAR",
    "SEGUIMIENTO_REGISTRAR",
    "CAPTURA_FINALIZAR",
    "EXPEDIENTE_VER_TECNICO",
    "REPORTE_VER",
    "CERTIFICADO_VER",
    "NOTIFICACIONES_VER",
  ]),

  [RolUsuario.COORDINADOR]: new Set<AccionSistema>([
    "PANEL_ACCEDER",
    "EXPEDIENTE_VER_TECNICO",
    "REPORTE_VER",
    "CERTIFICADO_VER",
    "EXPEDIENTE_REVISAR_COORDINACION",
    "EXPEDIENTE_DEVOLVER_INSPECTOR",
    "EXPEDIENTE_VISTO_BUENO",
    "NOTIFICACIONES_VER",
  ]),

  [RolUsuario.GERENTE]: new Set<AccionSistema>([
    "PANEL_ACCEDER",
    "AGENDA_VER_GENERAL",
    "AGENDA_VER_PROPIA",
    "COTIZACION_VER",
    "INSPECCION_PROGRAMAR",
    "INSPECCION_REPROGRAMAR",
    "INSPECCION_ASIGNAR_INSPECTOR",
    "INSPECCION_REASIGNAR_PROPONER",
    "INSPECCION_REASIGNAR_RESOLVER",
    "INSPECCION_CREAR_SEGUIMIENTO",
    "EXPEDIENTE_VER_TECNICO",
    "REPORTE_VER",
    "CERTIFICADO_VER",
    "CERTIFICADO_IMPRIMIR",
    "CERTIFICADO_EMITIR",
    "EXPEDIENTE_REVISAR_GERENCIA",
    "EXPEDIENTE_DEVOLVER_COORDINACION",
    "EXPEDIENTE_AUTORIZAR",

    "OBSERVACION_CLIENTE_REVISAR",
    "NOTIFICACIONES_VER",
  ]),

  [RolUsuario.ADMINISTRADOR]: new Set<AccionSistema>([
    "PANEL_ACCEDER",
    "AGENDA_VER_GENERAL",
    "COTIZACION_VER",
    "COTIZACION_CREAR",
    "COTIZACION_EDITAR",
    "COTIZACION_AUTORIZAR",
    "COTIZACION_IMPRIMIR",
    "COTIZACION_DESCARGAR",
    "COTIZACION_ENVIAR",
    "PAQUETE_GESTIONAR",
    "CLIENTE_CREAR",
    "CLIENTE_EDITAR_ADMIN",
    "INMUEBLE_CREAR",
    "INMUEBLE_EDITAR_ADMIN",
    "DATOS_ADMIN_VER",
    "PAGO_VER",
    "PAGO_CAPTURAR",
    "LIBERACION_ADMINISTRATIVA",
    "INSPECCION_REASIGNAR_RESOLVER",
    "OBSERVACION_CLIENTE_REVISAR",
    "USUARIO_CREAR_BASICO",
    "USUARIO_ACTIVAR_DESACTIVAR_BASICO",
    "USUARIO_RESTABLECER_PASSWORD_BASICO",
    "NOTIFICACIONES_VER",
  ]),

  [RolUsuario.DIRECTOR]: new Set<AccionSistema>(accionesDirector),
};

export function puede(
  rol: RolUsuario,
  accion: AccionSistema,
): boolean {
  if (accion === "PASSWORD_EXISTENTE_VER") {
    return false;
  }

  return MATRIZ_PERMISOS[rol]?.has(accion) ?? false;
}

export function exigirPermiso(
  rol: RolUsuario,
  accion: AccionSistema,
): void {
  if (!puede(rol, accion)) {
    throw new Error(
      `El rol ${rol} no tiene facultad para ejecutar ${accion}.`,
    );
  }
}

export function esRolAdministrativo(
  rol: RolUsuario,
): boolean {
  return (
    rol === RolUsuario.ADMINISTRADOR ||
    rol === RolUsuario.DIRECTOR
  );
}

export function esRolTecnico(
  rol: RolUsuario,
): boolean {
  return (
    rol === RolUsuario.INSPECTOR ||
    rol === RolUsuario.COORDINADOR ||
    rol === RolUsuario.GERENTE ||
    rol === RolUsuario.DIRECTOR
  );
}

export function puedeVerDatosAdministrativos(
  rol: RolUsuario,
): boolean {
  return puede(rol, "DATOS_ADMIN_VER");
}

export function puedeVerCotizaciones(
  rol: RolUsuario,
): boolean {
  return puede(rol, "COTIZACION_VER");
}

export function cotizacionEsSoloLectura(
  rol: RolUsuario,
): boolean {
  return rol === RolUsuario.GERENTE;
}

export function puedeVerExpedienteTecnico(
  rol: RolUsuario,
): boolean {
  return puede(rol, "EXPEDIENTE_VER_TECNICO");
}

export function puedeManipularExpedienteAutorizado(
  rol: RolUsuario,
): boolean {
  return rol === RolUsuario.DIRECTOR;
}

export function puedeAutorizarExcepcion(
  rol: RolUsuario,
): boolean {
  return rol === RolUsuario.DIRECTOR;
}

export function puedeVerPasswordExistente(): boolean {
  return false;
}

/**
 * Administración de usuarios.
 *
 * ADMINISTRADOR:
 * - CLIENTE
 * - INSPECTOR
 * - COORDINADOR
 * - GERENTE
 *
 * DIRECTOR:
 * - todos los roles
 *
 * Ningún rol puede visualizar una contraseña existente.
 */
export function puedeAdministrarUsuario(
  actor: RolUsuario,
  objetivo: RolUsuario,
): boolean {
  if (actor === RolUsuario.DIRECTOR) {
    return true;
  }

  if (actor !== RolUsuario.ADMINISTRADOR) {
    return false;
  }

  return (
    objetivo === RolUsuario.CLIENTE ||
    objetivo === RolUsuario.INSPECTOR ||
    objetivo === RolUsuario.COORDINADOR ||
    objetivo === RolUsuario.GERENTE
  );
}

export function puedeCrearUsuario(
  actor: RolUsuario,
  objetivo: RolUsuario,
): boolean {
  return puedeAdministrarUsuario(actor, objetivo);
}

export function puedeCambiarPasswordDeUsuario(
  actor: RolUsuario,
  objetivo: RolUsuario,
): boolean {
  return puedeAdministrarUsuario(actor, objetivo);
}

export function puedeActivarDesactivarUsuario(
  actor: RolUsuario,
  objetivo: RolUsuario,
): boolean {
  return puedeAdministrarUsuario(actor, objetivo);
}

/**
 * La eliminación física está prohibida como regla general.
 * Solo DIRECTOR puede autorizarla y únicamente para registros vacíos,
 * errores de captura o elementos de prueba sin historial.
 *
 * Esta función solo valida el rol. La Server Action deberá validar
 * además que el registro no tenga historial ni relaciones relevantes.
 */
export function puedeEliminarFisicamente(
  rol: RolUsuario,
): boolean {
  return rol === RolUsuario.DIRECTOR;
}

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
};

/**
 * Alcance organizacional de una inspección.
 *
 * DIRECTOR:
 * - acceso global.
 *
 * ADMINISTRADOR:
 * - NO obtiene acceso técnico por esta función.
 *
 * GERENTE:
 * - inspecciones de Inspectores adscritos directamente a su Gerencia.
 *
 * COORDINADOR:
 * - inspecciones de Inspectores adscritos directamente a su Coordinación.
 *
 * INSPECTOR:
 * - únicamente inspecciones asignadas a él.
 *
 * CLIENTE:
 * - únicamente sus propias inspecciones/reportes.
 */
export function estaDentroDelAlcanceDeInspeccion(
  usuario: ContextoUsuario,
  inspeccion: ContextoInspeccion,
): boolean {
  switch (usuario.rol) {
    case RolUsuario.DIRECTOR:
      return true;

    case RolUsuario.ADMINISTRADOR:
      return false;

    case RolUsuario.GERENTE:
      return Boolean(
        inspeccion.gerenteUsuarioId &&
          inspeccion.gerenteUsuarioId === usuario.id,
      );

    case RolUsuario.COORDINADOR:
      return Boolean(
        inspeccion.coordinadorUsuarioId &&
          inspeccion.coordinadorUsuarioId === usuario.id,
      );

    case RolUsuario.INSPECTOR:
      if (usuario.inspectorId && inspeccion.inspectorId) {
        return usuario.inspectorId === inspeccion.inspectorId;
      }

      if (inspeccion.inspectorUsuarioId) {
        return inspeccion.inspectorUsuarioId === usuario.id;
      }

      return false;

    case RolUsuario.CLIENTE:
      return Boolean(
        usuario.clienteId &&
          inspeccion.clienteId &&
          usuario.clienteId === inspeccion.clienteId,
      );

    default:
      return false;
  }
}

/**
 * Acceso técnico al expediente.
 * ADMINISTRADOR queda expresamente excluido.
 */
export function puedeAbrirExpedienteTecnico(
  usuario: ContextoUsuario,
  inspeccion: ContextoInspeccion,
): boolean {
  if (!puedeVerExpedienteTecnico(usuario.rol)) {
    return false;
  }

  return estaDentroDelAlcanceDeInspeccion(
    usuario,
    inspeccion,
  );
}

/**
 * El Inspector solo puede editar la inspección que tiene asignada.
 * El estado del expediente debe validarse aparte en la Server Action.
 */
export function puedeEditarComoInspector(
  usuario: ContextoUsuario,
  inspeccion: ContextoInspeccion,
): boolean {
  if (usuario.rol === RolUsuario.DIRECTOR) {
    return true;
  }

  if (usuario.rol !== RolUsuario.INSPECTOR) {
    return false;
  }

  return estaDentroDelAlcanceDeInspeccion(
    usuario,
    inspeccion,
  );
}

/**
 * Coordinador:
 * - revisa dentro de su coordinación;
 * - no asigna ni programa.
 */
export function puedeRevisarComoCoordinador(
  usuario: ContextoUsuario,
  inspeccion: ContextoInspeccion,
): boolean {
  if (usuario.rol === RolUsuario.DIRECTOR) {
    return true;
  }

  if (usuario.rol !== RolUsuario.COORDINADOR) {
    return false;
  }

  return estaDentroDelAlcanceDeInspeccion(
    usuario,
    inspeccion,
  );
}

/**
 * Gerente:
 * - revisa y autoriza únicamente dentro de su Gerencia.
 */
export function puedeRevisarComoGerente(
  usuario: ContextoUsuario,
  inspeccion: ContextoInspeccion,
): boolean {
  if (usuario.rol === RolUsuario.DIRECTOR) {
    return true;
  }

  if (usuario.rol !== RolUsuario.GERENTE) {
    return false;
  }

  return estaDentroDelAlcanceDeInspeccion(
    usuario,
    inspeccion,
  );
}

/**
 * Compatibilidad heredada.
 *
 * La zona ya no debe utilizarse como autorización jerárquica para Gerencia.
 * La asignación/reasignación ordinaria debe validarse mediante gerenteId
 * contra el Inspector objetivo en la Server Action correspondiente.
 *
 * Se conserva esta función para no romper importaciones antiguas, pero solo
 * Dirección obtiene autorización por este helper.
 */
export function puedeAsignarInspectorEnZona(
  usuario: ContextoUsuario,
  _zonaId: string | null | undefined,
): boolean {
  return usuario.rol === RolUsuario.DIRECTOR;
}

/**
 * Auditoría formal:
 * DIRECTOR = acceso total.
 * Otros roles = sin acceso al módulo formal de auditoría.
 */
export function puedeAuditarUsuario(
  actor: ContextoUsuario,
  _objetivo: {
    rol: RolUsuario;
    zonaId?: string | null;
  },
): boolean {
  return actor.rol === RolUsuario.DIRECTOR;
}

/**
 * Regla absoluta:
 * nunca se debe permitir suplantar identidad.
 *
 * Esta función existe para dejar la intención explícita.
 */
export function puedeSuplantarUsuario(): boolean {
  return false;
}
