import Link from "next/link";

export function PmHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <>
      <header style={{ maxWidth: 1440, margin: "0 auto", padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <Link href="/project-manager/panel" style={{ color: "#fff", textDecoration: "none", fontWeight: 700 }}>← Centro de Control</Link>
        <span style={{ color: "#edcb71", fontWeight: 900 }}>CERTEZA PROJECT MANAGER</span>
      </header>
      <section style={{ maxWidth: 1440, margin: "0 auto", padding: "24px 22px 18px" }}>
        <p style={{ margin: 0, color: "#edcb71", fontSize: 12, fontWeight: 900, letterSpacing: ".08em" }}>NÚCLEO OPERATIVO WEB</p>
        <h1 style={{ margin: "6px 0 4px", fontSize: "clamp(32px,5vw,48px)" }}>{title}</h1>
        {subtitle && <p style={{ margin: 0, color: "#9fb2c6", lineHeight: 1.5 }}>{subtitle}</p>}
      </section>
    </>
  );
}

export const card = { background:"#0a223d", border:"1px solid rgba(255,255,255,.10)", borderRadius:16, padding:18 } as const;
export const tableWrap = { overflowX:"auto", border:"1px solid rgba(255,255,255,.10)", borderRadius:16, background:"#0a223d" } as const;
