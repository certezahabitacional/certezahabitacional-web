import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";

export const metadata: Metadata = {
  title: "Certeza Project Manager | Certeza Técnica",
  description:
    "Conoce Certeza Project Manager mediante sus 20 láminas de presentación y accede a la plataforma.",
};

const laminas = [
  ["01", "Certeza Project Manager", "/project-manager/laminas/01.webp"],
  ["02", "Estructura general de Certeza Project Manager", "/project-manager/laminas/02.webp"],
  ["03", "Línea base del proyecto", "/project-manager/laminas/03.webp"],
  ["04", "Planeación integrada", "/project-manager/laminas/04.webp"],
  ["05", "Ejecución y captura de campo", "/project-manager/laminas/05.webp"],
  ["06", "Control integrado de proyectos", "/project-manager/laminas/06.webp"],
  ["07", "Forecast del proyecto", "/project-manager/laminas/07.webp"],
  ["08", "Gestión de riesgos", "/project-manager/laminas/08.webp"],
  ["09", "Gestión de restricciones", "/project-manager/laminas/09.webp"],
  ["10", "Control de cambios", "/project-manager/laminas/10.webp"],
  ["11", "Tableros multiproyecto", "/project-manager/laminas/11.webp"],
  ["12", "Reporte ejecutivo", "/project-manager/laminas/12.webp"],
  ["13", "Gestión del alcance", "/project-manager/laminas/13.webp"],
  ["14", "Gestión del valor ganado (EVM)", "/project-manager/laminas/14.webp"],
  ["15", "Salud del proyecto", "/project-manager/laminas/15.webp"],
  ["16", "Control por excepción", "/project-manager/laminas/16.webp"],
  ["17", "Productividad y Lean", "/project-manager/laminas/17.webp"],
  ["18", "Gestión híbrida", "/project-manager/laminas/18.webp"],
  ["19", "Certeza IA para Project Managers", "/project-manager/laminas/19.webp"],
  ["20", "Hoja de ruta de implementación", "/project-manager/laminas/20.webp"],
] as const;

const botonAcceso = {
  minHeight: 48,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 22px",
  borderRadius: 12,
  background: "#edcb71",
  color: "#071d38",
  textDecoration: "none",
  fontWeight: 900,
} as const;

export default async function ProjectManagerPage() {
  const session = await auth();
  const accesoHref = session?.user
    ? "/project-manager/panel"
    : "/project-manager/login";
  const accesoTexto = session?.user
    ? "Entrar al sistema →"
    : "Acceder a Certeza Project Manager →";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#06172c",
        color: "#fff",
      }}
    >
      <header
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          padding: "18px 22px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/certeza-tecnica"
          style={{ color: "#fff", textDecoration: "none", fontWeight: 700 }}
        >
          ← Certeza Técnica
        </Link>
        <span style={{ color: "#edcb71", fontWeight: 900 }}>
          CERTEZA PROJECT MANAGER
        </span>
      </header>

      <section
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          padding: "34px 22px 18px",
        }}
      >
        <div
          style={{
            border: "1px solid rgba(237,203,113,.35)",
            borderRadius: 22,
            padding: "clamp(24px, 5vw, 54px)",
            background:
              "linear-gradient(135deg, #0d315a 0%, #071d38 58%, #10263e 100%)",
          }}
        >
          <p
            style={{
              margin: 0,
              color: "#edcb71",
              fontWeight: 900,
              letterSpacing: ".09em",
              fontSize: 13,
            }}
          >
            CERTEZA TÉCNICA
          </p>
          <h1
            style={{
              margin: "10px 0 10px",
              fontSize: "clamp(38px, 7vw, 72px)",
              lineHeight: 0.98,
            }}
          >
            Certeza Project Manager
          </h1>
          <p
            style={{
              maxWidth: 960,
              color: "#d4dfeb",
              fontSize: 19,
              lineHeight: 1.6,
              marginBottom: 0,
            }}
          >
            Recorre las 20 láminas de presentación en su orden oficial y,
            desde esta misma página, accede a la plataforma de administración
            y control de proyectos.
          </p>

          <div
            style={{
              marginTop: 24,
              display: "flex",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <Link href={accesoHref} style={botonAcceso}>
              {accesoTexto}
            </Link>
            <a
              href="#lamina-01"
              style={{
                minHeight: 48,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 20px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,.18)",
                color: "#fff",
                textDecoration: "none",
                fontWeight: 800,
              }}
            >
              Ver las 20 imágenes ↓
            </a>
          </div>
        </div>
      </section>

      <nav
        aria-label="Navegación de las 20 láminas"
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          padding: "8px 22px 24px",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {laminas.map(([numero]) => (
            <a
              key={numero}
              href={`#lamina-${numero}`}
              aria-label={`Ir a la lámina ${numero}`}
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid rgba(237,203,113,.26)",
                color: "#edcb71",
                textDecoration: "none",
                fontWeight: 900,
                background: "#0a223d",
              }}
            >
              {numero}
            </a>
          ))}
        </div>
      </nav>

      <section
        aria-label="Presentación visual de Certeza Project Manager"
        style={{
          maxWidth: 1220,
          margin: "0 auto",
          padding: "0 22px 44px",
          display: "grid",
          gap: 30,
        }}
      >
        {laminas.map(([numero, titulo, src]) => (
          <article
            key={numero}
            id={`lamina-${numero}`}
            style={{
              scrollMarginTop: 24,
              border: "1px solid rgba(255,255,255,.10)",
              borderRadius: 20,
              background: "#0a223d",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 18px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    color: "#edcb71",
                    fontSize: 12,
                    fontWeight: 900,
                    letterSpacing: ".08em",
                  }}
                >
                  LÁMINA {numero} DE 20
                </div>
                <h2 style={{ margin: "4px 0 0", fontSize: 22 }}>{titulo}</h2>
              </div>
              <a
                href="#top"
                style={{
                  color: "#aabaca",
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                Volver arriba ↑
              </a>
            </div>

            <div
              style={{
                background: "#fff",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <Image
                src={src}
                alt={`Lámina ${numero}: ${titulo}`}
                width={1000}
                height={750}
                unoptimized
                sizes="(max-width: 900px) 100vw, 1000px"
                style={{
                  width: "100%",
                  height: "auto",
                  maxWidth: 1000,
                  display: "block",
                }}
              />
            </div>
          </article>
        ))}
      </section>

      <section
        style={{
          maxWidth: 1220,
          margin: "0 auto",
          padding: "0 22px 60px",
        }}
      >
        <div
          style={{
            border: "1px solid rgba(237,203,113,.35)",
            borderRadius: 20,
            padding: "28px",
            background: "#0a223d",
            textAlign: "center",
          }}
        >
          <p
            style={{
              margin: 0,
              color: "#edcb71",
              fontWeight: 900,
              letterSpacing: ".08em",
              fontSize: 12,
            }}
          >
            ACCESO A LA PLATAFORMA
          </p>
          <h2 style={{ margin: "8px 0 8px", fontSize: 30 }}>
            Certeza Project Manager
          </h2>
          <p
            style={{
              margin: "0 auto 20px",
              maxWidth: 700,
              color: "#aabaca",
              lineHeight: 1.55,
            }}
          >
            Después de conocer la metodología y capacidades del sistema,
            ingresa con tu cuenta autorizada.
          </p>
          <Link href={accesoHref} style={botonAcceso}>
            {accesoTexto}
          </Link>
        </div>
      </section>
    </main>
  );
}
