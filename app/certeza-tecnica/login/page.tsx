import { Suspense } from "react";
import LoginCertezaTecnicaForm from "./LoginCertezaTecnicaForm";

function Fallback() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#06172b] text-white">
      <p className="text-sm text-slate-300">Cargando acceso a Certeza Técnica...</p>
    </main>
  );
}

export default function CertezaTecnicaLoginPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <LoginCertezaTecnicaForm />
    </Suspense>
  );
}
