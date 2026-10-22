type LogoCertezaTecnicaProps = {
  height?: number;
  href?: string;
  className?: string;
};

export default function LogoCertezaTecnica({
  height = 62,
  href,
  className = "",
}: LogoCertezaTecnicaProps) {
  const logo = (
    <img
      src="/branding/logo-certeza-tecnica.png"
      alt="Certeza Técnica"
      className={className}
      style={{ height, width: "auto", maxWidth: "100%", objectFit: "contain", display: "block" }}
    />
  );

  return href ? (
    <a href={href} aria-label="Certeza Técnica" style={{ display: "inline-flex", alignItems: "center" }}>
      {logo}
    </a>
  ) : logo;
}
