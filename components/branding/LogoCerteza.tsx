import Image from "next/image";
import Link from "next/link";

type LogoCertezaProps = {
  variant?: "gold" | "white" | "badge";
  width?: number;
  href?: string;
  className?: string;
  priority?: boolean;
};

const sources = {
  gold: "/branding/logo-gold.png",
  white: "/branding/logo-white.png",
  badge: "/branding/logo-badge.png",
} as const;

export default function LogoCerteza({
  variant = "gold",
  width = 200,
  href,
  className = "",
  priority = false,
}: LogoCertezaProps) {
  const image = (
    <Image
      src={sources[variant]}
      alt="Certeza Habitacional"
      width={width}
      height={width}
      priority={priority}
      className={`h-auto w-auto object-contain ${className}`}
      style={{ maxWidth: width }}
    />
  );

  return href ? (
    <Link href={href} aria-label="Certeza Habitacional">
      {image}
    </Link>
  ) : (
    image
  );
}
