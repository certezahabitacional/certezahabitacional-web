export const ZONAS_SERVICIO = {
  CIUDAD_JUAREZ: {
    nombre: "Ciudad Juarez",
    ciudadEstado: "Ciudad Juarez, Chihuahua",
    correoCotizacion: "anabelsapiensa@gmail.com",
    emailContacto: "contacto@certezahabitacional.com",
    telefono: "656 287 12 18",
    whatsapp: "526562871218",
    domicilio: "Monte Apeninos 6436, Col. La Cuesta, Ciudad Juarez, Chihuahua",
  },
  GUADALAJARA: {
    nombre: "Guadalajara",
    ciudadEstado: "Guadalajara, Jalisco",
    correoCotizacion: "anabelsapiensa@gmail.com",
    emailContacto: "contacto@certezahabitacional.com",
    telefono: null,
    whatsapp: null,
    domicilio: null,
  },
  HERMOSILLO: {
    nombre: "Hermosillo",
    ciudadEstado: "Hermosillo, Sonora",
    correoCotizacion: "anabelsapiensa@gmail.com",
    emailContacto: "contacto@certezahabitacional.com",
    telefono: null,
    whatsapp: null,
    domicilio: null,
  },
  TIJUANA: {
    nombre: "Tijuana",
    ciudadEstado: "Tijuana, Baja California",
    correoCotizacion: "luzecycastro017@gmail.com",
    emailContacto: "contacto@certezahabitacional.com",
    telefono: "664 759 9923",
    whatsapp: "526647599923",
    domicilio: null,
  },
} as const;

export type ZonaServicio = keyof typeof ZONAS_SERVICIO;

export function esZonaServicio(valor: string): valor is ZonaServicio {
  return Object.prototype.hasOwnProperty.call(ZONAS_SERVICIO, valor);
}

export function obtenerZonaServicio(zona: ZonaServicio) {
  return ZONAS_SERVICIO[zona];
}
