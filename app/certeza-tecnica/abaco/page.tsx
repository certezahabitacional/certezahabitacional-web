import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import AbacoClient from "./AbacoClient";

export const metadata: Metadata = {
  title: "ÁBACO | Certeza Técnica",
  description:
    "Carga un presupuesto y genera automáticamente el Secuencial con equivalencias y el Ábaco de programación del proyecto.",
};

export default async function AbacoPage() {
  const session = await auth();
  const role = String(session?.user?.role ?? "");
  const rolesAutorizados = new Set(["DIRECTOR", "ADMINISTRADOR", "GERENTE", "COORDINADOR"]);

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!rolesAutorizados.has(role)) {
    redirect("/acceso");
  }

  return (
    <main className="min-h-screen bg-[#071d38] text-white">
      <header className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-5 py-5">
        <div>
          <Link href="/panel" className="font-semibold text-white no-underline">
            ← Volver al sistema
          </Link>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#edcb71]">
            CERTEZA TÉCNICA · ÁBACO
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-200">
            Presupuesto → Secuencial y equivalencias → Ábaco de programación
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-5 pb-12">
        <AbacoClient />
      </section>
    </main>
  );
}
