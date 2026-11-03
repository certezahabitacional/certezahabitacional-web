import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { requireProjectManagerAccess } from "@/lib/project-manager/access";
import AbacoClient from "@/app/panel/certeza-tecnica/abaco/AbacoClient";

export const metadata: Metadata = {
  title: "ÁBACO | Certeza Técnica 360",
  description: "Secuencial, equivalencias, programación, seguimiento y recuperación de obra.",
};

export default async function CertezaTecnicaAbacoPage() {
  const session=await auth();
  if(!session?.user) {
    redirect("/certeza-tecnica/login?callbackUrl=%2Fcerteza-tecnica%2Fapp%2Fabaco");
  }

  await requireProjectManagerAccess();

  return (
    <main className="min-h-screen bg-[#071d38] text-white">
      <header className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-5 py-5">
        <div>
          <Link href="/certeza-tecnica/app" className="font-semibold text-white no-underline">
            ← Volver a Certeza Técnica 360
          </Link>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#edcb71]">
            CERTEZA ÁBACO
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-200">
            Presupuesto → Secuencial y equivalencias → Ábaco de programación → Programa vs. Real
          </p>
        </div>
      </header>
      <section className="mx-auto max-w-[1500px] px-5 pb-12">
        <AbacoClient />
      </section>
    </main>
  );
}
