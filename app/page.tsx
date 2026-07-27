const services = [
  ["Compra de vivienda", "Revisión independiente antes de firmar o entregar recursos."],
  ["Entrega de vivienda nueva", "Detección documentada de detalles, faltantes y condiciones críticas."],
  ["Garantía y postventa", "Seguimiento técnico para sustentar solicitudes de corrección."],
  ["Inversionistas", "Evaluación objetiva del estado físico para decidir con mejores datos."],
  ["Supervisión de calidad", "Control preventivo durante procesos constructivos y de cierre."],
  ["Dictamen técnico", "Informe estructurado con evidencia, prioridades y recomendaciones."],
];

const method = [
  ["01", "Inspeccionamos", "Recorremos sistemas, espacios y componentes con una guía técnica estandarizada."],
  ["02", "Clasificamos", "Cada hallazgo se registra como Conforme, Observación, No Conforme o Condición Crítica."],
  ["03", "Priorizamos", "Asignamos prioridad P1–P5 para que sepas qué atender primero."],
  ["04", "Entregamos certeza", "Recibes evidencia, conclusiones y un Índice de Salud Habitacional fácil de interpretar."],
];

function Logo() {
  return (
    <a href="#inicio" className="flex items-center gap-3" aria-label="Certeza Habitacional, inicio">
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#0b2f4f] text-white shadow-lg">
        <svg viewBox="0 0 40 40" className="h-7 w-7" aria-hidden="true"><path fill="currentColor" d="M5 20 20 7l15 13v14a2 2 0 0 1-2 2h-8V24H15v12H7a2 2 0 0 1-2-2V20Z"/><path fill="#58c3c7" d="m15 20 5-4 5 4v4H15z"/></svg>
      </span>
      <span><b className="block text-[15px] leading-tight tracking-tight text-[#0b2f4f]">CERTEZA</b><span className="block text-xs font-semibold tracking-[.13em] text-[#176b9b]">HABITACIONAL</span></span>
    </a>
  );
}

export default function Home() {
  return (
    <main>
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="container flex min-h-20 items-center justify-between gap-6">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm font-bold text-slate-700 md:flex">
            <a href="#servicios">Servicios</a><a href="#metodo">Método Certeza®</a><a href="#nosotros">Nosotros</a><a href="#contacto">Contacto</a>
          </nav>
          <a className="btn btn-primary min-h-11 px-5 text-sm" href="#contacto">Solicitar inspección</a>
        </div>
      </header>

      <section id="inicio" className="hero-grid overflow-hidden border-b border-slate-200 bg-[#f7fafc]">
        <div className="container grid min-h-[720px] items-center gap-12 py-20 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <p className="eyebrow mb-5">Inspección técnica de vivienda</p>
            <h1 className="title max-w-4xl text-[#0b2f4f]">Decide sobre tu vivienda con información, evidencia y certeza.</h1>
            <p className="lead mt-7 max-w-2xl">Evaluamos el estado físico del inmueble y convertimos los hallazgos en un reporte claro, priorizado y respaldado con evidencia fotográfica.</p>
            <div className="mt-9 flex flex-wrap gap-4"><a className="btn btn-primary" href="#contacto">Solicitar inspección</a><a className="btn btn-secondary" href="#metodo">Conocer el método</a></div>
            <div className="mt-10 grid max-w-xl grid-cols-3 gap-4 border-t border-slate-300 pt-7 text-sm"><div><b className="block text-2xl text-[#0b2f4f]">C–CR</b><span className="text-slate-600">Clasificación clara</span></div><div><b className="block text-2xl text-[#0b2f4f]">P1–P5</b><span className="text-slate-600">Prioridad técnica</span></div><div><b className="block text-2xl text-[#0b2f4f]">ISH</b><span className="text-slate-600">Índice de salud</span></div></div>
          </div>
          <div className="relative">
            <div className="card overflow-hidden p-3"><div className="rounded-[18px] bg-[#0b2f4f] p-8 text-white"><div className="flex items-center justify-between"><span className="text-sm font-bold tracking-[.12em]">REPORTE EJECUTIVO</span><span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-bold text-emerald-200">EVALUACIÓN COMPLETA</span></div><div className="mt-16"><p className="text-sm text-slate-300">Índice de Salud Habitacional</p><div className="mt-3 flex items-end gap-4"><strong className="text-7xl tracking-tight">87</strong><span className="pb-2 text-xl text-slate-300">/100</span></div></div><div className="mt-8 h-3 overflow-hidden rounded-full bg-white/15"><div className="h-full w-[87%] rounded-full bg-[#58c3c7]" /></div><div className="mt-10 grid grid-cols-2 gap-3 text-sm"><div className="rounded-2xl bg-white/10 p-4"><b className="block text-2xl">24</b><span className="text-slate-300">Puntos conformes</span></div><div className="rounded-2xl bg-white/10 p-4"><b className="block text-2xl">6</b><span className="text-slate-300">Hallazgos priorizados</span></div></div></div></div>
            <div className="absolute -bottom-6 -left-6 hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:block"><p className="text-xs font-bold uppercase tracking-widest text-[#176b9b]">Semáforo Certeza®</p><div className="mt-3 flex gap-2"><span className="h-4 w-4 rounded-full bg-emerald-500"/><span className="h-4 w-4 rounded-full bg-amber-400"/><span className="h-4 w-4 rounded-full bg-red-500"/></div></div>
          </div>
        </div>
      </section>

      <section id="servicios" className="section"><div className="container"><p className="eyebrow">Servicios</p><div className="mt-4 grid gap-8 lg:grid-cols-2"><h2 className="section-title text-[#0b2f4f]">Inspecciones diseñadas para decisiones importantes.</h2><p className="lead">Acompañamos a compradores, propietarios, desarrolladores e inversionistas con una evaluación independiente y ordenada.</p></div><div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{services.map(([title, text], i)=><article key={title} className="card p-7"><span className="text-sm font-black text-[#58aeb6]">0{i+1}</span><h3 className="mt-5 text-xl font-extrabold text-[#0b2f4f]">{title}</h3><p className="mt-3 leading-7 text-slate-600">{text}</p></article>)}</div></div></section>

      <section id="metodo" className="section bg-[#0b2f4f] text-white"><div className="container"><p className="eyebrow !text-[#7de0df]">Método Certeza®</p><div className="mt-4 grid gap-8 lg:grid-cols-2"><h2 className="section-title">Un proceso técnico que se entiende.</h2><p className="lead !text-slate-300">La inspección no termina al encontrar un defecto. Lo documentamos, lo clasificamos y explicamos su prioridad.</p></div><div className="mt-14 grid gap-5 lg:grid-cols-4">{method.map(([n,t,d])=><article key={n} className="rounded-3xl border border-white/15 bg-white/5 p-6"><span className="text-sm font-black text-[#7de0df]">{n}</span><h3 className="mt-8 text-xl font-extrabold">{t}</h3><p className="mt-3 leading-7 text-slate-300">{d}</p></article>)}</div></div></section>

      <section id="nosotros" className="section"><div className="container grid items-center gap-12 lg:grid-cols-2"><div className="rounded-[32px] bg-[#eaf4f6] p-8 sm:p-12"><div className="grid aspect-square place-items-center rounded-[28px] border border-[#b9dfe2] bg-white"><div className="text-center"><div className="mx-auto grid h-24 w-24 place-items-center rounded-[30px] bg-[#0b2f4f] text-white"><svg viewBox="0 0 40 40" className="h-14 w-14"><path fill="currentColor" d="M5 20 20 7l15 13v14a2 2 0 0 1-2 2h-8V24H15v12H7a2 2 0 0 1-2-2V20Z"/><path fill="#58c3c7" d="m15 20 5-4 5 4v4H15z"/></svg></div><p className="mt-6 text-2xl font-black tracking-tight text-[#0b2f4f]">CERTEZA HABITACIONAL</p><p className="mt-2 text-sm font-bold uppercase tracking-[.18em] text-[#176b9b]">Inspección · Evidencia · Confianza</p></div></div></div><div><p className="eyebrow">Nosotros</p><h2 className="section-title mt-4 text-[#0b2f4f]">Protegemos decisiones que impactan tu patrimonio.</h2><p className="lead mt-6">Certeza Habitacional nace para elevar la calidad de la inspección de vivienda en México mediante criterios técnicos, documentación estandarizada y comunicación clara.</p><div className="mt-8 space-y-4">{["Independencia y objetividad técnica","Evidencia fotográfica organizada","Reportes claros para clientes no especialistas","Seguimiento con trazabilidad documental"].map(x=><div key={x} className="flex items-center gap-3 font-bold text-slate-700"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#d9f1f1] text-[#0b6d75]">✓</span>{x}</div>)}</div></div></div></section>

      <section id="contacto" className="section bg-[#f3f7f9]"><div className="container"><div className="card grid overflow-hidden lg:grid-cols-[.8fr_1.2fr]"><div className="bg-[#176b9b] p-8 text-white sm:p-12"><p className="text-sm font-black uppercase tracking-[.16em] text-[#b7f1ef]">Contacto</p><h2 className="mt-4 text-4xl font-extrabold tracking-tight">Solicita una inspección.</h2><p className="mt-5 leading-8 text-blue-100">Cuéntanos qué tipo de vivienda deseas revisar y te contactaremos para definir alcance, fecha y cotización.</p><div className="mt-10 space-y-5 text-sm"><p><b className="block text-blue-100">Correo</b> contacto@certezahabitacional.com</p><p><b className="block text-blue-100">Cobertura inicial</b> Hermosillo, Sonora y proyectos programados</p><p className="text-xs text-blue-100">Actualiza estos datos antes de publicar si cambian.</p></div></div><form className="grid gap-5 p-8 sm:p-12" action="mailto:contacto@certezahabitacional.com" method="post" encType="text/plain"><label className="grid gap-2 text-sm font-bold">Nombre<input className="rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-[#176b9b]" name="nombre" required /></label><label className="grid gap-2 text-sm font-bold">Teléfono o WhatsApp<input className="rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-[#176b9b]" name="telefono" required /></label><label className="grid gap-2 text-sm font-bold">Correo electrónico<input className="rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-[#176b9b]" type="email" name="correo" required /></label><label className="grid gap-2 text-sm font-bold">¿Qué necesitas inspeccionar?<textarea className="min-h-32 rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-[#176b9b]" name="mensaje" required /></label><button className="btn btn-primary mt-2 border-0" type="submit">Enviar solicitud</button></form></div></div></section>

      <footer className="border-t border-slate-200 bg-white py-10"><div className="container flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center"><Logo/><p className="text-sm text-slate-500">© 2026 Certeza Habitacional. Todos los derechos reservados.</p></div></footer>
    </main>
  );
}
