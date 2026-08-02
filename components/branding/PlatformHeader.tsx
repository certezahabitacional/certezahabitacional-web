import type { ReactNode } from "react";
import LogoCerteza from "./LogoCerteza";

type PlatformHeaderProps = {
  area: string;
  subtitle?: string;
  homeHref?: string;
  actions?: ReactNode;
};

export default function PlatformHeader({
  area,
  subtitle,
  homeHref = "/panel",
  actions,
}: PlatformHeaderProps) {
  return (
    <header className="border-b border-white/10 bg-slate-950/95 shadow-[0_12px_35px_rgba(0,0,0,0.22)] backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-[1500px] flex-col justify-between gap-5 px-6 py-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-5">
          <LogoCerteza
            href={homeHref}
            variant="gold"
            width={190}
            priority
            className="max-h-20"
          />

          <div className="hidden border-l border-white/10 pl-5 md:block">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-amber-300">
              Plataforma operativa
            </p>
            <p className="mt-1 text-xl font-black text-white">{area}</p>
            {subtitle && (
              <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
            )}
          </div>
        </div>

        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </header>
  );
}
