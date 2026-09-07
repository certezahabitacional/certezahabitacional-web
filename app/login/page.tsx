import { Suspense } from "react";
import PublicHeader from "@/components/public/PublicHeader";
import LoginForm from "./LoginForm";

function LoginFallback() {
  return (
    <main className="flex min-h-[calc(100vh-136px)] items-center justify-center bg-[#020B14] px-6 text-white">
      <section className="w-full max-w-md rounded-3xl border border-[#D79A21]/25 bg-[#071522] p-8 shadow-2xl">
        <p className="text-sm text-slate-400">Cargando acceso...</p>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <>
      <PublicHeader active="acceso" />
      <Suspense fallback={<LoginFallback />}>
        <LoginForm />
      </Suspense>
    </>
  );
}
