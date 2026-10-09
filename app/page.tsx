import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Grupo Certeza | Certeza Técnica y Certeza Habitacional",
  description:
    "Dos soluciones, una misma filosofía de confianza. Accede a Certeza Técnica o Certeza Habitacional.",
};

export default function GrupoCertezaHome() {
  return (
    <main className="grupo-approved-root">
      <section className="grupo-approved-stage" aria-label="Grupo Certeza">
        <Image
          src="/branding/grupo-certeza-portada-autorizada.webp"
          alt="Grupo Certeza: Certeza Técnica y Certeza Habitacional"
          width={1280}
          height={720}
          priority
          className="grupo-approved-image"
          sizes="100vw"
        />

        <nav className="grupo-approved-hotspots" aria-label="Navegación de Grupo Certeza">
          <Link href="/" aria-label="Inicio" className="gc-hotspot gc-home" />
          <Link href="/certeza-tecnica" aria-label="Certeza Técnica" className="gc-hotspot gc-tech-nav" />
          <Link href="/certeza-habitacional" aria-label="Certeza Habitacional" className="gc-hotspot gc-home-nav" />
          <Link href="/nosotros" aria-label="Nosotros" className="gc-hotspot gc-about" />
          <a href="mailto:contacto@certezahabitacional.com" aria-label="Contacto" className="gc-hotspot gc-contact" />
          <Link href="/login" aria-label="Acceso clientes" className="gc-hotspot gc-login" />
          <Link href="/certeza-tecnica" aria-label="Entrar a Certeza Técnica" className="gc-hotspot gc-tech-card" />
          <Link href="/certeza-habitacional" aria-label="Entrar a Certeza Habitacional" className="gc-hotspot gc-home-card" />
        </nav>
      </section>
    </main>
  );
}
