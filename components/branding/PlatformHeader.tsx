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
      <div className="mx-auto flex max-w-[1500px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:px-6 sm:py-4">
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <LogoCerteza
            href={homeHref}
            variant="gold"
            width={190}
            priority
            className="max-h-14 w-[138px] shrink-0 object-contain sm:max-h-20 sm:w-[190px]"
          />

          <div className="min-w-0 border-l border-white/10 pl-3 sm:pl-5">
            <p className="hidden text-xs font-black uppercase tracking-[0.28em] text-amber-300 md:block">
              Plataforma operativa
            </p>
            <p className="truncate text-base font-black text-white sm:mt-1 sm:text-xl">{area}</p>
            {subtitle && (
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-slate-400 sm:mt-1 sm:text-sm">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {actions && (
          <div className="mobile-actions flex w-full items-center gap-2 overflow-x-auto pb-1 sm:w-auto sm:flex-wrap sm:gap-3 sm:overflow-visible sm:pb-0">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
