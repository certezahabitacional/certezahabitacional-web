"use client";

import Image from "next/image";
import Link from "next/link";
import PublicHeader from "@/components/public/PublicHeader";
import { FormEvent, useEffect, useMemo, useState } from "react";
import "./cotizar.css";

type TipoCliente =
  | "PARTICULAR"
  | "INMOBILIARIA"
  | "CONSTRUCTORA"
  | "INVERSIONISTA";

type DatosFormulario = {
  nombre: string;
  telefono: string;
  correo: string;
  tipoCliente: TipoCliente | "";
  empresa: string;
  ciudadCliente: string;

  direccionInmueble: string;
  ciudadInmueble: string;
  m2Terreno: string;
  m2Construccion: string;
  niveles: string;
  recamaras: string;
  banos: string;

  cocina: boolean;
  sala: boolean;
  comedor: boolean;
  estancia: boolean;
  areaLavado: boolean;
  lavadero: boolean;
  cochera: boolean;
  patio: boolean;
  jardin: boolean;
  terraza: boolean;
  balcon: boolean;
  sotano: boolean;
  cuartoServicio: boolean;
  bodega: boolean;

  otrosEspacios: string;
  comentarios: string;
  avisoPrivacidad: boolean;

  sitioWeb: string;
};

const estadoInicial: DatosFormulario = {
  nombre: "",
  telefono: "",
  correo: "",
  tipoCliente: "",
  empresa: "",
  ciudadCliente: "",

  direccionInmueble: "",
  ciudadInmueble: "",
  m2Terreno: "",
  m2Construccion: "",
  niveles: "",
  recamaras: "",
  banos: "",

  cocina: false,
  sala: false,
  comedor: false,
  estancia: false,
  areaLavado: false,
  lavadero: false,
  cochera: false,
  patio: false,
  jardin: false,
  terraza: false,
  balcon: false,
  sotano: false,
  cuartoServicio: false,
  bodega: false,

  otrosEspacios: "",
  comentarios: "",
  avisoPrivacidad: false,

  sitioWeb: "",
};

const espacios = [
  ["cocina", "Cocina"],
  ["sala", "Sala"],
  ["comedor", "Comedor"],
  ["estancia", "Estancia"],
  ["areaLavado", "Área de lavado"],
  ["lavadero", "Lavadero"],
  ["cochera", "Cochera"],
  ["patio", "Patio"],
  ["jardin", "Jardín"],
  ["terraza", "Terraza"],
  ["balcon", "Balcón"],
  ["sotano", "Sótano"],
  ["cuartoServicio", "Cuarto de servicio"],
  ["bodega", "Bodega"],
] as const;

export default function CotizarPage() {
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [datos, setDatos] = useState<DatosFormulario>(estadoInicial);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") {
      return;
    }

    async function limpiarServiceWorkerDeDesarrollo() {
      try {
        if ("serviceWorker" in navigator) {
          const registros = await navigator.serviceWorker.getRegistrations();

          await Promise.all(
            registros
              .filter((registro) => registro.scope.startsWith(window.location.origin))
              .map((registro) => registro.unregister()),
          );
        }

        if ("caches" in window) {
          const claves = await caches.keys();
          await Promise.all(claves.map((clave) => caches.delete(clave)));
        }
      } catch (errorLimpieza) {
        console.warn(
          "No fue posible limpiar el Service Worker de desarrollo:",
          errorLimpieza,
        );
      }
    }

    void limpiarServiceWorkerDeDesarrollo();
  }, []);

  const espaciosSeleccionados = useMemo(
    () =>
      espacios
        .filter(([campo]) => datos[campo])
        .map(([, etiqueta]) => etiqueta),
    [datos],
  );

  function actualizar<K extends keyof DatosFormulario>(
    campo: K,
    valor: DatosFormulario[K],
  ) {
    setDatos((actual) => ({ ...actual, [campo]: valor }));
  }

  function validarPaso1() {
    return Boolean(
      datos.nombre.trim() &&
        datos.telefono.trim() &&
        datos.correo.trim() &&
        datos.tipoCliente &&
        datos.ciudadCliente.trim(),
    );
  }

  function validarPaso2() {
    return Boolean(
      datos.direccionInmueble.trim() &&
        datos.ciudadInmueble.trim() &&
        datos.m2Terreno.trim() &&
        datos.m2Construccion.trim() &&
        datos.recamaras.trim() &&
        datos.banos.trim(),
    );
  }

  function siguiente() {
    setError("");

    if (paso === 1 && !validarPaso1()) {
      setError("Completa los campos obligatorios de tus datos.");
      return;
    }

    if (paso === 2 && !validarPaso2()) {
      setError("Completa los datos obligatorios del inmueble.");
      return;
    }

    setPaso((actual) => (actual === 1 ? 2 : 3));
    window.scrollTo({ top: 390, behavior: "smooth" });
  }

  function anterior() {
    setError("");
    setPaso((actual) => (actual === 3 ? 2 : 1));
    window.scrollTo({ top: 390, behavior: "smooth" });
  }

  async function enviarSolicitud(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!datos.avisoPrivacidad) {
      setError("Debes aceptar el Aviso de Privacidad para enviar la solicitud.");
      return;
    }

    setError("");
    setEnviando(true);

    try {
      const respuesta = await fetch("/api/solicitudes-cotizacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      });

      if (!respuesta.ok) {
        throw new Error("No fue posible enviar la solicitud.");
      }

      setEnviado(true);
      window.scrollTo({ top: 360, behavior: "smooth" });
    } catch {
      setError(
        "No fue posible enviar tu solicitud en este momento. Intenta nuevamente o contáctanos por WhatsApp.",
      );
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <main className="min-h-screen bg-[#020B14] text-white">
        <PublicHeader active="cotizar" />

        <section className="mx-auto flex min-h-[70vh] max-w-[1100px] items-center justify-center px-6 py-16">
          <div className="w-full rounded-3xl border border-[#D79A21]/50 bg-[#061422] p-8 text-center shadow-2xl md:p-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#D79A21] text-3xl text-[#D79A21]">
              ✓
            </div>

            <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-[#D79A21]">
              Solicitud recibida
            </p>

            <h1 className="mt-3 text-3xl font-black md:text-4xl">
              Gracias por confiar en Certeza Habitacional.
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-300">
              Revisaremos la información de tu vivienda para preparar tu
              cotización. Nuestro equipo se pondrá en contacto contigo a través
              de los datos proporcionados.
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/"
                className="rounded-md border border-[#D79A21] px-7 py-3 text-sm font-black"
              >
                VOLVER AL INICIO
              </Link>

              <button
                type="button"
                onClick={() => {
                  setDatos(estadoInicial);
                  setPaso(1);
                  setEnviado(false);
                }}
                className="rounded-md bg-[#D79A21] px-7 py-3 text-sm font-black text-[#020B14]"
              >
                NUEVA SOLICITUD
              </button>
            </div>
          </div>
        </section>

        <Footer />
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#020B14] text-white">
      <PublicHeader active="cotizar" />

      {/* =========================================================
          HERO CON CSS EXPLÍCITO
      ========================================================== */}
      <section className="cotizar-hero-section cotizar-gold-banner">
        <div className="cotizar-hero-grid">
          <div className="cotizar-hero-copy">
            <h1 className="cotizar-hero-title">
              Cotiza tu inspección
            </h1>

            <p className="cotizar-hero-subtitle">
              Rápido, sencillo y sin compromiso.
            </p>

            <p className="cotizar-hero-text">
              Cuéntanos los datos de tu vivienda y te enviaremos una propuesta
              de acuerdo con sus características.
            </p>

            <div className="cotizar-hero-pillars">
              <Pilar simbolo="◇" texto="Inspectores certificados" descripcion="Profesionales capacitados para revisar cada detalle de tu vivienda." />
              <Pilar simbolo="◎" texto="Tecnología especializada" descripcion="Utilizamos herramientas avanzadas para detectar lo que no se ve." />
              <Pilar simbolo="▤" texto="Reporte profesional" descripcion="Recibe un informe claro, fotográfico y fácil de entender." />
              <Pilar simbolo="✓" texto="Confianza y respaldo" descripcion="Te acompañamos en una de las decisiones más importantes." />
            </div>
          </div>

          <div className="cotizar-hero-image-wrap">
            <Image
              src="/branding/nosotros-hero-aprobado.png"
              alt="Inspector de Certeza Habitacional frente a una vivienda"
              width={1400}
              height={900}
              priority
              sizes="(max-width: 1024px) 100vw, 62vw"
              className="cotizar-hero-image"
            />
            <div className="cotizar-hero-overlay" />
          </div>
        </div>
      </section>

      {/* =========================================================
          CONTENIDO
      ========================================================== */}
      <section className="mx-auto max-w-[1500px] px-6 py-7 lg:px-8">
        <Progress paso={paso} />

        <div className="cotizar-main-stack">
          <form
            onSubmit={enviarSolicitud}
            className="cotizar-form-card"
          >
            {paso === 1 && (
              <PasoCliente datos={datos} actualizar={actualizar} />
            )}

            {paso === 2 && (
              <PasoInmueble datos={datos} actualizar={actualizar} />
            )}

            {paso === 3 && (
              <PasoRevision
                datos={datos}
                espaciosSeleccionados={espaciosSeleccionados}
                actualizar={actualizar}
              />
            )}

            {error && (
              <div className="mt-6 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            )}

            <div className="cotizar-form-actions">
              {paso > 1 ? (
                <button
                  type="button"
                  onClick={anterior}
                  className="cotizar-btn-secondary"
                >
                  ← ANTERIOR
                </button>
              ) : (
                <span />
              )}

              {paso < 3 ? (
                <button
                  type="button"
                  onClick={siguiente}
                  className="cotizar-btn-primary"
                >
                  SIGUIENTE →
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={enviando}
                  className="cotizar-btn-primary disabled:opacity-60"
                >
                  {enviando ? "ENVIANDO..." : "ENVIAR SOLICITUD →"}
                </button>
              )}
            </div>
          </form>

          <Aside />
        </div>

        <Beneficios />

        <section className="cotizar-help-card">
          <div>
            <h2 className="text-2xl font-black">&iquest;Tienes dudas?</h2>
            <p className="mt-1 text-sm text-slate-400">
              Estamos listos para ayudarte a tomar la mejor decisión.
            </p>
          </div>

          <a
            href="https://wa.me/526562871218"
            target="_blank"
            rel="noreferrer"
            className="cotizar-whatsapp-btn"
          >
            Contáctanos por WhatsApp
          </a>
        </section>
      </section>

      <Footer />
    </main>
  );
}

function Progress({ paso }: { paso: 1 | 2 | 3 }) {
  const items = [
    ["01", "TUS DATOS", "Información de contacto"],
    ["02", "DATOS DEL INMUEBLE", "Características de la vivienda"],
    ["03", "REVISA Y ENVÍA", "Confirma tu solicitud"],
  ];

  return (
    <div className="cotizar-progress">
      <div className="cotizar-progress-track" aria-hidden="true" />

      {items.map(([numero, titulo, subtitulo], index) => {
        const activo = paso === index + 1;
        const completado = paso > index + 1;

        return (
          <div
            key={numero}
            className={`cotizar-progress-step ${
              activo ? "is-active" : ""
            } ${completado ? "is-complete" : ""}`}
          >
            <div className="cotizar-progress-badge">
              {completado ? "✓" : numero}
            </div>

            <p className="cotizar-progress-title">{titulo}</p>
            <p className="cotizar-progress-subtitle">{subtitulo}</p>
          </div>
        );
      })}
    </div>
  );
}

function PasoCliente({
  datos,
  actualizar,
}: {
  datos: DatosFormulario;
  actualizar: <K extends keyof DatosFormulario>(
    campo: K,
    valor: DatosFormulario[K],
  ) => void;
}) {
  return (
    <>
      <TituloPaso titulo="Tus datos">
        Completa tu información para poder contactarte.
      </TituloPaso>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <Campo label="Nombre completo *">
          <input
            value={datos.nombre}
            onChange={(e) => actualizar("nombre", e.target.value)}
            placeholder="Ej. Juan Pérez García"
            className={inputClass}
          />
        </Campo>

        <Campo label="Teléfono / WhatsApp *">
          <input
            value={datos.telefono}
            onChange={(e) => actualizar("telefono", e.target.value)}
            placeholder="656 287 12 18"
            inputMode="tel"
            className={inputClass}
          />
        </Campo>

        <Campo label="Correo electrónico *">
          <input
            value={datos.correo}
            onChange={(e) => actualizar("correo", e.target.value)}
            placeholder="Ej. correo@ejemplo.com"
            type="email"
            className={inputClass}
          />
        </Campo>

        <Campo label="Tipo de cliente *">
          <select
            value={datos.tipoCliente}
            onChange={(e) =>
              actualizar("tipoCliente", e.target.value as TipoCliente)
            }
            className={inputClass}
          >
            <option value="">Selecciona una opción</option>
            <option value="PARTICULAR">Particular</option>
            <option value="INMOBILIARIA">Inmobiliaria</option>
            <option value="CONSTRUCTORA">Constructora</option>
            <option value="INVERSIONISTA">Inversionista</option>
          </select>
        </Campo>

        <Campo label="Empresa (opcional)">
          <input
            value={datos.empresa}
            onChange={(e) => actualizar("empresa", e.target.value)}
            placeholder="Ej. Inmobiliaria del Norte"
            className={inputClass}
          />
        </Campo>

        <Campo label="Ciudad *">
          <input
            value={datos.ciudadCliente}
            onChange={(e) => actualizar("ciudadCliente", e.target.value)}
            placeholder="Ej. Ciudad Juárez"
            className={inputClass}
          />
        </Campo>
      </div>
    </>
  );
}

function PasoInmueble({
  datos,
  actualizar,
}: {
  datos: DatosFormulario;
  actualizar: <K extends keyof DatosFormulario>(
    campo: K,
    valor: DatosFormulario[K],
  ) => void;
}) {
  return (
    <>
      <TituloPaso titulo="Datos del inmueble">
        Cuéntanos las características principales de la vivienda.
      </TituloPaso>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <Campo label="Dirección completa del inmueble *" ancho>
          <input
            value={datos.direccionInmueble}
            onChange={(e) => actualizar("direccionInmueble", e.target.value)}
            placeholder="Calle, número, colonia o fraccionamiento"
            className={inputClass}
          />
        </Campo>

        <Campo label="Ciudad *">
          <input
            value={datos.ciudadInmueble}
            onChange={(e) => actualizar("ciudadInmueble", e.target.value)}
            placeholder="Ej. Ciudad Juárez"
            className={inputClass}
          />
        </Campo>

        <Campo label="m² de terreno *">
          <input
            value={datos.m2Terreno}
            onChange={(e) => actualizar("m2Terreno", e.target.value)}
            inputMode="decimal"
            placeholder="Ej. 180"
            className={inputClass}
          />
        </Campo>

        <Campo label="m² de construcción *">
          <input
            value={datos.m2Construccion}
            onChange={(e) => actualizar("m2Construccion", e.target.value)}
            inputMode="decimal"
            placeholder="Ej. 145"
            className={inputClass}
          />
        </Campo>

        <Campo label="Número de niveles">
          <input
            value={datos.niveles}
            onChange={(e) => actualizar("niveles", e.target.value)}
            inputMode="numeric"
            placeholder="Ej. 2"
            className={inputClass}
          />
        </Campo>

        <Campo label="Número de recámaras *">
          <input
            value={datos.recamaras}
            onChange={(e) => actualizar("recamaras", e.target.value)}
            inputMode="numeric"
            placeholder="Ej. 3"
            className={inputClass}
          />
        </Campo>

        <Campo label="Número de baños *">
          <input
            value={datos.banos}
            onChange={(e) => actualizar("banos", e.target.value)}
            inputMode="decimal"
            placeholder="Ej. 2.5"
            className={inputClass}
          />
        </Campo>
      </div>

      <div className="mt-7 border-t border-white/10 pt-6">
        <p className="font-black">Espacios de la vivienda</p>

        <p className="mt-1 text-sm text-slate-400">
          Marca los espacios con los que cuenta el inmueble.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {espacios.map(([campo, etiqueta]) => (
            <label
              key={campo}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                datos[campo]
                  ? "border-[#D79A21] bg-[#D79A21]/10"
                  : "border-white/10 bg-[#030B16]"
              }`}
            >
              <input
                type="checkbox"
                checked={Boolean(datos[campo])}
                onChange={(e) => actualizar(campo, e.target.checked)}
                className="accent-[#D79A21]"
              />

              <span>{etiqueta}</span>
            </label>
          ))}
        </div>

        <div className="mt-5 grid gap-5">
          <Campo label="Otros espacios o características">
            <input
              value={datos.otrosEspacios}
              onChange={(e) => actualizar("otrosEspacios", e.target.value)}
              placeholder="Describe cualquier espacio adicional"
              className={inputClass}
            />
          </Campo>

          <Campo label="Comentarios adicionales">
            <textarea
              value={datos.comentarios}
              onChange={(e) => actualizar("comentarios", e.target.value)}
              placeholder="Información adicional que consideres importante para preparar la cotización"
              rows={4}
              className={inputClass}
            />
          </Campo>
        </div>
      </div>
    </>
  );
}

function PasoRevision({
  datos,
  espaciosSeleccionados,
  actualizar,
}: {
  datos: DatosFormulario;
  espaciosSeleccionados: string[];
  actualizar: <K extends keyof DatosFormulario>(
    campo: K,
    valor: DatosFormulario[K],
  ) => void;
}) {
  return (
    <>
      <TituloPaso titulo="Revisa y envía">
        Confirma que la información sea correcta antes de enviarla.
      </TituloPaso>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Resumen titulo="Tus datos">
          <Linea etiqueta="Nombre" valor={datos.nombre} />
          <Linea etiqueta="Teléfono" valor={datos.telefono} />
          <Linea etiqueta="Correo" valor={datos.correo} />
          <Linea etiqueta="Tipo" valor={datos.tipoCliente} />

          {datos.empresa && (
            <Linea etiqueta="Empresa" valor={datos.empresa} />
          )}

          <Linea etiqueta="Ciudad" valor={datos.ciudadCliente} />
        </Resumen>

        <Resumen titulo="Inmueble">
          <Linea etiqueta="Dirección" valor={datos.direccionInmueble} />
          <Linea etiqueta="Ciudad" valor={datos.ciudadInmueble} />
          <Linea etiqueta="Terreno" valor={`${datos.m2Terreno} m²`} />
          <Linea
            etiqueta="Construcción"
            valor={`${datos.m2Construccion} m²`}
          />

          {datos.niveles && (
            <Linea etiqueta="Niveles" valor={datos.niveles} />
          )}

          <Linea etiqueta="Recámaras" valor={datos.recamaras} />
          <Linea etiqueta="Baños" valor={datos.banos} />
        </Resumen>
      </div>

      <Resumen titulo="Espacios de la vivienda" className="mt-5">
        <p className="text-sm leading-7 text-slate-300">
          {espaciosSeleccionados.length
            ? espaciosSeleccionados.join(" · ")
            : "No se seleccionaron espacios adicionales."}
        </p>

        {datos.otrosEspacios && (
          <p className="mt-3 text-sm text-slate-400">
            <strong>Otros:</strong> {datos.otrosEspacios}
          </p>
        )}

        {datos.comentarios && (
          <p className="mt-3 text-sm text-slate-400">
            <strong>Comentarios:</strong> {datos.comentarios}
          </p>
        )}
      </Resumen>

      <label className="mt-6 flex items-start gap-3 rounded-xl border border-white/10 bg-[#030B16] p-4 text-sm">
        <input
          type="checkbox"
          checked={datos.avisoPrivacidad}
          onChange={(e) => actualizar("avisoPrivacidad", e.target.checked)}
          className="mt-1 accent-[#D79A21]"
        />

        <span className="text-slate-300">
          He leído y acepto el{" "}
          <Link
            href="/aviso-privacidad"
            target="_blank"
            className="font-bold text-[#D79A21] underline"
          >
            Aviso de Privacidad
          </Link>
          .
        </span>
      </label>

      <input
        type="text"
        value={datos.sitioWeb}
        onChange={(e) => actualizar("sitioWeb", e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />
    </>
  );
}

function Aside() {
  return (
    <section className="cotizar-trust-section">
      <AsideItem simbolo="◇" titulo="Tu información está segura">
        La información que proporciones será utilizada únicamente para elaborar
        tu cotización y contactarte.
      </AsideItem>

      <AsideItem simbolo="◷" titulo="Respuesta rápida">
        Nuestro equipo revisará la información y te enviaremos tu cotización a
        la brevedad.
      </AsideItem>

      <AsideItem simbolo="✉" titulo="Sin compromiso" ultimo>
        La solicitud de cotización no tiene ningún costo ni compromiso de tu
        parte.
      </AsideItem>
    </section>
  );
}

function Beneficios() {
  const items = [
    [
      "⌂",
      "Inspectores certificados",
      "Profesionales capacitados para revisar cada detalle de tu vivienda.",
    ],
    [
      "◎",
      "Tecnología especializada",
      "Utilizamos herramientas avanzadas para detectar lo que no se ve.",
    ],
    [
      "▤",
      "Reporte profesional",
      "Recibe un informe claro, fotográfico y fácil de entender.",
    ],
    [
      "◇",
      "Confianza y respaldo",
      "Te acompañamos en una de las decisiones más importantes.",
    ],
  ];

  return (
    <section className="cotizar-benefits-grid">
      {items.map(([icono, titulo, texto], index) => (
        <div
          key={titulo}
          className="cotizar-benefit-card"
        >
          <div className="cotizar-benefit-icon">{icono}</div>

          <h3 className="cotizar-benefit-title">{titulo}</h3>

          <p className="cotizar-benefit-text">
            {texto}
          </p>
        </div>
      ))}
    </section>
  );
}

function Footer() {
  return (
    <footer className="cotizar-site-footer">
      <div className="cotizar-footer-main">
        <div className="cotizar-footer-brand">
          <Image
            src="/branding/logo-autorizado.png"
            alt="Certeza Habitacional"
            width={280}
            height={250}
            className="cotizar-footer-logo"
          />
          <p>Revisamos cada rincón antes de que des el sí</p>
        </div>

        <div>
          <p className="cotizar-footer-title">EXPLORA</p>
          <div className="cotizar-footer-links">
            <Link href="/nosotros">Nosotros</Link>
            <Link href="/inspecciones">Inspecciones</Link>
            <Link href="/tecnologia">Tecnología</Link>
            <Link href="/metodo">Método Certeza</Link>
            <Link href="/servicios">Servicios</Link>
          </div>
        </div>

        <div>
          <p className="cotizar-footer-title">PARTICIPA</p>
          <div className="cotizar-footer-links">
            <span>Únete a Certeza Habitacional</span>
            <span>Quiero ser inspector</span>
            <span>Quiero vender inspecciones</span>
            <span>Alianzas</span>
          </div>
        </div>

        <div>
          <p className="cotizar-footer-title">AYUDA</p>
          <div className="cotizar-footer-links">
            <a href="https://wa.me/526562871218" target="_blank" rel="noreferrer">
              WhatsApp 656 287 12 18
            </a>
            <Link href="/login">Acceso clientes</Link>
            <Link href="/cotizar">Cotizar inspección</Link>
            <a href="mailto:contacto@certezahabitacional.com">
              contacto@certezahabitacional.com
            </a>
          </div>
        </div>

        <div className="cotizar-footer-social">
          <div className="cotizar-social-row" aria-label="Redes sociales">
            <span>in</span>
            <span>◎</span>
            <span>f</span>
            <span>▶</span>
          </div>

          <div className="cotizar-construction">
            <div className="cotizar-construction-icon">🚧</div>
            <div>
              <strong>Página en construcción</strong>
              <p>Seguimos trabajando para servirte mejor.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="cotizar-footer-bottom">
        <p>
          © {new Date().getFullYear()} Certeza Habitacional. Todos los derechos reservados.
        </p>

        <div>
          <Link href="/aviso-privacidad">Aviso de privacidad</Link>
          <Link href="/terminos">Términos y condiciones</Link>
        </div>
      </div>
    </footer>
  );
}

function TituloPaso({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-2xl font-black">{titulo}</h2>
      <p className="mt-1 text-sm text-slate-400">{children}</p>
    </div>
  );
}

function Campo({
  label,
  children,
  ancho = false,
}: {
  label: string;
  children: React.ReactNode;
  ancho?: boolean;
}) {
  return (
    <label className={ancho ? "block md:col-span-2" : "block"}>
      <span className="mb-2 block text-sm font-bold text-slate-200">
        {label}
      </span>
      {children}
    </label>
  );
}

function Pilar({
  simbolo,
  texto,
  descripcion,
}: {
  simbolo: string;
  texto: string;
  descripcion: string;
}) {
  return (
    <article className="cotizar-pillar-card">
      <div className="cotizar-pillar-icon">{simbolo}</div>

      <div className="cotizar-pillar-content">
        <h3>{texto}</h3>
        <p>{descripcion}</p>
      </div>
    </article>
  );
}

function AsideItem({
  simbolo,
  titulo,
  children,
  ultimo = false,
}: {
  simbolo: string;
  titulo: string;
  children: React.ReactNode;
  ultimo?: boolean;
}) {
  return (
    <article className="cotizar-trust-card">
      <div className="cotizar-trust-icon">{simbolo}</div>

      <div>
        <h3 className="cotizar-trust-title">{titulo}</h3>
        <p className="cotizar-trust-text">{children}</p>
      </div>
    </article>
  );
}

function Resumen({
  titulo,
  children,
  className = "",
}: {
  titulo: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-white/10 bg-[#030B16] p-5 ${className}`}
    >
      <h3 className="font-black text-[#D79A21]">{titulo}</h3>
      <div className="mt-4 space-y-2">{children}</div>
    </div>
  );
}

function Linea({
  etiqueta,
  valor,
}: {
  etiqueta: string;
  valor: string;
}) {
  return (
    <p className="text-sm text-slate-300">
      <span className="font-bold text-white">{etiqueta}:</span>{" "}
      {valor}
    </p>
  );
}



const inputClass =
  "cotizar-input";