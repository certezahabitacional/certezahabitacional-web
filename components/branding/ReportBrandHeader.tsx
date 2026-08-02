import LogoCerteza from "./LogoCerteza";

type ReportBrandHeaderProps = {
  title: string;
  folio?: string;
  eyebrow?: string;
  dark?: boolean;
};

export default function ReportBrandHeader({
  title,
  folio,
  eyebrow = "Inspección técnica de viviendas",
  dark = false,
}: ReportBrandHeaderProps) {
  return (
    <header
      className={
        dark
          ? "relative z-10 flex items-start justify-between gap-6 border-b border-amber-300/30 pb-6"
          : "flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-5"
      }
    >
      <div className="flex items-center gap-5">
        <LogoCerteza variant="gold" width={170} className="max-h-24" />
        <div>
          <p className={dark ? "text-xs font-black uppercase tracking-[0.25em] text-amber-300" : "text-xs font-black uppercase tracking-[0.25em] text-amber-700"}>
            Certeza Habitacional
          </p>
          <p className={dark ? "mt-1 text-sm text-slate-300" : "mt-1 text-sm text-slate-600"}>
            {eyebrow}
          </p>
          <h1 className={dark ? "mt-3 text-3xl font-black text-white" : "mt-3 text-3xl font-black text-slate-950"}>
            {title}
          </h1>
        </div>
      </div>

      {folio && (
        <div className={dark ? "rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-right" : "rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-right"}>
          <p className={dark ? "text-xs uppercase tracking-widest text-slate-400" : "text-xs uppercase tracking-widest text-slate-500"}>
            Folio
          </p>
          <p className={dark ? "mt-1 font-black text-amber-300" : "mt-1 font-black text-slate-950"}>{folio}</p>
        </div>
      )}
    </header>
  );
}
