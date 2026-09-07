import Image from "next/image";
import Link from "next/link";
import styles from "./PublicHeader.module.css";

type ActivePage =
  | "home"
  | "servicios"
  | "metodo"
  | "tecnologia"
  | "inspecciones"
  | "nosotros"
  | "acceso"
  | "cotizar";

const items = [
  { key: "servicios", label: "SERVICIOS", href: "/servicios" },
  { key: "metodo", label: "MÉTODO CERTEZA", href: "/metodo" },
  { key: "tecnologia", label: "TECNOLOGÍA", href: "/tecnologia" },
  { key: "inspecciones", label: "INSPECCIONES", href: "/inspecciones" },
  { key: "nosotros", label: "NOSOTROS", href: "/nosotros" },
] as const;

export default function PublicHeader({ active }: { active: ActivePage }) {
  const internal = active !== "home";

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link
          href="/"
          aria-label="Inicio Certeza Habitacional"
          className={styles.brand}
        >
          <Image
            src="/branding/logo-autorizado.png"
            alt="Certeza Habitacional"
            width={260}
            height={210}
            priority
            className={styles.logo}
          />
        </Link>

        <nav className={styles.nav} aria-label="Navegación principal">
          {internal && (
            <Link href="/" className={styles.navLink}>
              INICIO
            </Link>
          )}

          {items
            .filter((item) => item.key !== active)
            .map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={styles.navLink}
              >
                {item.label}
              </Link>
            ))}
        </nav>

        <div className={styles.actions}>
          {active !== "acceso" && (
            <Link href="/login" className={`${styles.button} ${styles.outline}`}>
              <UserIcon />
              <span>ACCESO CLIENTES</span>
            </Link>
          )}

          {active !== "cotizar" && (
            <Link href="/cotizar" className={`${styles.button} ${styles.gold}`}>
              <ClipboardIcon />
              <span>COTIZA TU INSPECCIÓN →</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function UserIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
      <path
        d="M4 20c.8-4.2 3.5-6.5 8-6.5s7.2 2.3 8 6.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
    >
      <rect
        x="5"
        y="4"
        width="14"
        height="17"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M9 4.5V3h6v1.5M8.5 13l2.2 2.2 4.8-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
