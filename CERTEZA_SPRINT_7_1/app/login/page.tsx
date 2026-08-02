import { auth } from "@/auth";
import { redirect } from "next/navigation";
import LoginForm from "./login-form";

type LoginPageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  if (session?.user) redirect("/panel");

  const parametros = await searchParams;
  const callbackUrl =
    parametros.callbackUrl?.startsWith("/") ? parametros.callbackUrl : "/panel";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
          Certeza Habitacional
        </p>
        <h1 className="mt-3 text-3xl font-black">Acceso al sistema</h1>
        <p className="mt-2 text-sm text-slate-400">
          Ingresa con tu cuenta autorizada.
        </p>

        <LoginForm callbackUrl={callbackUrl} />
      </section>
    </main>
  );
}
