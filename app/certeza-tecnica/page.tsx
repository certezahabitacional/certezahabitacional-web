import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Certeza Técnica",
  description:
    "Servicios técnicos, análisis especializados, evaluación profesional y soluciones con enfoque técnico.",
};

export default function CertezaTecnicaPage() {
  return (
    <main className="tecnica-placeholder">
      <section className="tecnica-placeholder-card">
        <Image
          src="/branding/logo-certeza-tecnica.webp"
          alt="Certeza Técnica"
          width={170}
          height={170}
          priority
        />
        <h1>Certeza Técnica</h1>
        <p>
          Esta división ya quedó conectada a la nueva portada corporativa.
          En la siguiente etapa desarrollaremos aquí su contenido comercial y técnico
          sin afectar la operación actual de Certeza Habitacional.
        </p>
        <div className="tecnica-placeholder-actions">
          <Link href="/">Volver a Grupo Certeza</Link>
          <Link href="/certeza-habitacional">Ir a Certeza Habitacional</Link>
        </div>
      </section>
    </main>
  );
}
