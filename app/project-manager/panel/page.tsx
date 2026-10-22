import Image from "next/image";
import LogoCertezaTecnica from "@/components/branding/LogoCertezaTecnica";
import Link from "next/link";
import { requireProjectManagerAccess } from "@/lib/project-manager/access";
import { cerrarSesionProjectManager } from "./actions";

const navy="#053f79";
const navyDark="#032b58";
const blue="#0a6fdc";
const orange="#ff8500";
const green="#17a858";
const red="#ec3030";
const ink="#082f64";
const muted="#294f73";
const border="#d8e6f2";
const canvas="#eef6fb";

const sidebar=[
  ["⌂","Centro de Control","/project-manager/panel"],
  ["▣","Portafolio","/project-manager/panel/portafolio"],
  ["▤","Proyectos","/project-manager/panel/proyectos"],
  ["▧","Reportes","/project-manager/panel/reportes"],
  ["✦","Inteligencia Certeza","/project-manager/panel/inteligencia"],
  ["👥","Accesos","/project-manager/panel/accesos"],
  ["🔐","Usuarios","/project-manager/panel/usuarios"],
  ["🤝","Portal del Cliente","/project-manager/portal/pr-0002"],
] as const;

const modules=[
  ["📋","Línea Base","/project-manager/panel/proyectos/pr-0002/linea-base"],
  ["🧩","EDT","/project-manager/panel/proyectos/pr-0002/edt"],
  ["📅","Programa","/project-manager/panel/proyectos/pr-0002/programa"],
  ["🟠","Presupuesto","/project-manager/panel/proyectos/pr-0002/presupuesto"],
  ["⚠","Riesgos","/project-manager/panel/proyectos/pr-0002/riesgos"],
  ["🚧","Restricciones","/project-manager/panel/proyectos/pr-0002/restricciones"],
  ["↻","Cambios","/project-manager/panel/proyectos/pr-0002/cambios"],
  ["👥","Decisiones","/project-manager/panel/proyectos/pr-0002/decisiones"],
  ["▥","Avance","/project-manager/panel/proyectos/pr-0002/avance"],
  ["👷","Productividad","/project-manager/panel/proyectos/pr-0002/productividad"],
  ["📊","Valor Ganado (EVM)","/project-manager/panel/proyectos/pr-0002/evm"],
  ["📈","Forecast","/project-manager/panel/proyectos/pr-0002/forecast"],
  ["💚","Salud del Proyecto","/project-manager/panel/proyectos/pr-0002/salud"],
  ["🚨","Alertas Tempranas","/project-manager/panel/proyectos/pr-0002/alertas"],
  ["▤","Resumen Ejecutivo","/project-manager/panel/proyectos/pr-0002/resumen"],
  ["📑","Reportes","/project-manager/panel/reportes"],
  ["IA","Inteligencia Certeza","/project-manager/panel/inteligencia"],
  ["📁","Portafolio","/project-manager/panel/portafolio"],
  ["👤","Accesos","/project-manager/panel/accesos"],
  ["🔐","Usuarios","/project-manager/panel/usuarios"],
  ["🤝","Portal del Cliente","/project-manager/portal/pr-0002"],
] as const;

function KpiCard({icon,title,value,detail,accent}:{icon:string;title:string;value:string;detail:string;accent:string}) {
  return <article style={{background:"#fff",border:`1px solid ${border}`,borderRadius:14,padding:"16px 18px",boxShadow:"0 4px 14px rgba(2,55,108,.08)",minHeight:126}}>
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <div style={{width:42,height:42,borderRadius:12,display:"grid",placeItems:"center",background:`${accent}16`,color:accent,fontSize:24,fontWeight:900}}>{icon}</div>
      <div style={{color:ink,fontWeight:900,fontSize:13,lineHeight:1.15,textTransform:"uppercase"}}>{title}</div>
    </div>
    <div style={{fontSize:31,fontWeight:950,color:ink,marginTop:10,lineHeight:1}}>{value}</div>
    <div style={{fontSize:13,color:muted,marginTop:8}}>{detail}</div>
  </article>
}

function SectionHeader({title,icon}:{title:string;icon?:string}) {
  return <div style={{height:44,borderRadius:"12px 12px 0 0",background:`linear-gradient(90deg,${navy},#0874c9)`,color:"#fff",display:"flex",alignItems:"center",gap:10,padding:"0 16px",fontWeight:900,fontSize:18}}>
    {icon&&<span>{icon}</span>}{title}
  </div>
}

export default async function ProjectManagerPanelPage() {
  const { session, role, readOnly } = await requireProjectManagerAccess();
  const user=session.user.name ?? session.user.email ?? "Usuario autorizado";
  const sidebarVisible = readOnly
    ? sidebar.filter(([,label]) => !["Accesos","Usuarios","Portal del Cliente"].includes(label))
    : sidebar;
  const modulesVisible = readOnly
    ? modules.filter(([,label]) => !["Accesos","Usuarios","Portal del Cliente"].includes(label))
    : modules;

  return <main style={{minHeight:"100vh",background:canvas,color:ink}}>
    <div style={{display:"grid",gridTemplateColumns:"220px minmax(0,1fr)",minHeight:"100vh"}}>
      <aside style={{background:`linear-gradient(180deg,${navyDark} 0%,${navy} 55%,#074b86 100%)`,color:"#fff",display:"flex",flexDirection:"column",minHeight:"100vh",position:"sticky",top:0,alignSelf:"start"}}>
        <div style={{padding:"18px 14px 16px",borderBottom:"1px solid rgba(255,255,255,.14)",display:"grid",gap:10}}>
          <LogoCertezaTecnica href="/certeza-tecnica" height={58}/>
          <div style={{fontSize:11,color:"#ffb357",fontWeight:950,letterSpacing:".08em"}}>PROJECT MANAGER</div>
        </div>

        <nav style={{padding:"14px 0"}}>
          {sidebarVisible.map(([icon,label,href],i)=><Link key={label} href={href} style={{
            display:"flex",alignItems:"center",gap:12,padding:"14px 18px",textDecoration:"none",
            color:"#fff",fontWeight:i===0?900:700,fontSize:14,
            background:i===0?orange:"transparent",borderLeft:i===0?"4px solid #ffd29a":"4px solid transparent"
          }}>
            <span style={{fontSize:19,width:24,textAlign:"center"}}>{icon}</span><span>{label}</span>
          </Link>)}
        </nav>

        <div style={{marginTop:"auto",padding:"24px 18px 28px",borderTop:"1px solid rgba(255,255,255,.1)",background:"rgba(0,0,0,.08)"}}>
          <div style={{fontSize:12,fontWeight:900,lineHeight:1.45}}>PROYECTOS<br/>MÁS PREDECIBLES<br/>DECISIONES<br/>MÁS SEGURAS</div>
          <div style={{width:76,height:4,background:orange,borderRadius:99,marginTop:14}}/>
        </div>
      </aside>

      <div style={{minWidth:0}}>
        <header style={{background:`linear-gradient(100deg,${navyDark},${navy} 46%,#0d75bd)`,color:"#fff",minHeight:104,display:"flex",alignItems:"center",justifyContent:"space-between",gap:20,padding:"14px 24px",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",inset:0,opacity:.12,background:"linear-gradient(120deg,transparent 45%,#fff 46%,transparent 47%)"}}/>
          <div style={{position:"relative",display:"flex",alignItems:"center",gap:18,flexWrap:"wrap"}}>
            <LogoCertezaTecnica href="/certeza-tecnica" height={70}/>
            <div style={{borderLeft:"1px solid rgba(255,255,255,.28)",paddingLeft:18}}>
              <div style={{fontSize:"clamp(24px,3vw,42px)",fontWeight:950,letterSpacing:"-.02em",lineHeight:1}}>
                CERTEZA <span style={{color:orange}}>PROJECT MANAGER</span>
              </div>
              <div style={{fontSize:18,color:"#f0f8ff",marginTop:6}}>Centro de Control de Proyectos</div>
            </div>
          </div>
          <div style={{position:"relative",display:"flex",alignItems:"center",gap:14,textAlign:"right"}}>
            <div style={{width:42,height:42,borderRadius:"50%",background:"#fff",display:"grid",placeItems:"center",color:navy,fontWeight:950}}>CG</div>
            <div>
              <div style={{fontWeight:900}}>{user}</div>
              <div style={{fontSize:12,color:"#f0f8ff"}}>{readOnly ? "CLIENTE · SÓLO LECTURA" : role}</div>
              <form action={cerrarSesionProjectManager} style={{marginTop:5}}>
                <button type="submit" style={{border:0,background:"transparent",color:"#ffd9b0",fontWeight:800,padding:0,cursor:"pointer",fontSize:12}}>Cerrar sesión</button>
              </form>
            </div>
          </div>
        </header>

        <div style={{padding:16,maxWidth:1600,margin:"0 auto"}}>
          <section style={{display:"grid",gridTemplateColumns:"repeat(6,minmax(140px,1fr))",gap:10}}>
            <KpiCard icon="▥" title="Avance Físico" value="0%" detail="Plan: 0% · Proyecto preoperativo" accent={blue}/>
            <KpiCard icon="◉" title="Avance Financiero" value="0%" detail="Costo real acumulado: $0" accent={orange}/>
            <KpiCard icon="👷" title="Productividad" value="Sin datos" detail="Se activa con el primer corte" accent={green}/>
            <KpiCard icon="♥" title="Salud del Proyecto" value="82/100" detail="Aceptable con observaciones" accent={green}/>
            <KpiCard icon="↗" title="Forecast Fin" value="30 Jun 2027" detail="Sin desviación proyectada" accent={orange}/>
            <KpiCard icon="!" title="Alertas Tempranas" value="5" detail="Asuntos de atención prioritaria" accent={red}/>
          </section>

          <div style={{display:"grid",gridTemplateColumns:"minmax(0,1.45fr) minmax(340px,.95fr)",gap:12,marginTop:12}}>
            <section style={{background:"#fff",border:`1px solid ${border}`,borderRadius:14,overflow:"hidden",boxShadow:"0 4px 14px rgba(2,55,108,.08)"}}>
              <SectionHeader title="MÓDULOS PRINCIPALES" icon="▦"/>
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))"}}>
                {modulesVisible.map(([icon,label,href])=><Link key={label} href={href} style={{minHeight:86,borderRight:`1px solid ${border}`,borderBottom:`1px solid ${border}`,textDecoration:"none",color:ink,padding:"12px 9px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",gap:6}}>
                  <span style={{fontSize:27,lineHeight:1}}>{icon}</span>
                  <strong style={{fontSize:12.5,lineHeight:1.15}}>{label}</strong>
                  <span style={{color:blue,fontSize:18,lineHeight:.8}}>›</span>
                </Link>)}
              </div>
            </section>

            <section style={{background:"#fff",border:`1px solid ${border}`,borderRadius:14,overflow:"hidden",boxShadow:"0 4px 14px rgba(2,55,108,.08)"}}>
              <SectionHeader title="PROYECTO DESTACADO: PR-0002" icon="🏢"/>
              <div style={{padding:14}}>
                <div style={{display:"grid",gridTemplateColumns:"160px 1fr",gap:14}}>
                  <div style={{borderRadius:10,overflow:"hidden",border:`1px solid ${border}`,background:"#eef5fb"}}>
                    <Image src="/project-manager/laminas/02.webp" alt="Certeza Project Manager - estructura general" width={320} height={240} unoptimized style={{width:"100%",height:126,objectFit:"cover",display:"block"}}/>
                  </div>
                  <div>
                    <strong style={{fontSize:16}}>PR-0002 · Centro Logístico Certeza</strong>
                    <div style={{fontSize:12.5,color:muted,lineHeight:1.65,marginTop:6}}>
                      Ciudad Juárez, Chihuahua<br/>
                      Cliente: Logística Frontera del Norte<br/>
                      Inicio: 02 Nov 2026<br/>
                      Fin planificado: 30 Jun 2027
                    </div>
                  </div>
                </div>

                <div style={{marginTop:14}}>
                  <div style={{fontWeight:900,fontSize:13}}>AVANCE DEL PROYECTO</div>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginTop:8}}>
                    <div style={{height:16,background:"#d7e7f4",borderRadius:99,flex:1,overflow:"hidden"}}><div style={{width:"0%",height:"100%",background:blue}}/></div>
                    <strong style={{fontSize:24}}>0%</strong>
                  </div>
                  <div style={{fontSize:12,color:muted,marginTop:5}}>Plan 0% · Variación 0%</div>
                </div>

                <div style={{marginTop:14,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <div style={{border:`1px solid ${border}`,borderRadius:10,padding:10}}>
                    <div style={{fontWeight:900,fontSize:12}}>SEMÁFORO GENERAL</div>
                    {[["Alcance",green],["Tiempo",green],["Costo",green],["Riesgos","#f2b329"],["Calidad",green]].map(([x,c])=><div key={x} style={{display:"flex",alignItems:"center",gap:8,fontSize:12.5,marginTop:7}}><span style={{width:11,height:11,borderRadius:"50%",background:c}}/>{x}</div>)}
                  </div>
                  <Link href="/project-manager/panel/proyectos/pr-0002" style={{borderRadius:10,background:`linear-gradient(135deg,${navy},#0a74c9)`,color:"#fff",textDecoration:"none",padding:12,display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center",fontWeight:900}}>Ver proyecto →</Link>
                </div>
              </div>
            </section>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1.2fr 1fr 1fr",gap:12,marginTop:12}}>
            <section style={{background:"#fff",border:`1px solid ${border}`,borderRadius:14,overflow:"hidden",boxShadow:"0 4px 14px rgba(2,55,108,.08)"}}>
              <SectionHeader title="CURVA DE AVANCE (FÍSICO)" icon="◴"/>
              <div style={{padding:"18px 18px 14px"}}>
                <div style={{height:182,position:"relative",borderLeft:`1px solid ${border}`,borderBottom:`1px solid ${border}`,background:"repeating-linear-gradient(to top,transparent 0,transparent 35px,#edf3f8 36px)"}}>
                  <svg viewBox="0 0 600 180" preserveAspectRatio="none" style={{position:"absolute",inset:0,width:"100%",height:"100%"}}>
                    <polyline points="0,170 50,165 100,158 150,150 200,140 250,128 300,114 350,98 400,78 450,58 500,38 550,18 600,6" fill="none" stroke={orange} strokeWidth="5"/>
                    <polyline points="0,174 50,170 100,165 150,160 200,153 250,145 300,136 350,126 400,116" fill="none" stroke={blue} strokeWidth="5"/>
                  </svg>
                </div>
                <div style={{display:"flex",justifyContent:"center",gap:18,fontSize:12,color:muted,marginTop:9}}>
                  <span><b style={{color:blue}}>●</b> Avance real</span><span><b style={{color:orange}}>●</b> Avance planificado</span>
                </div>
              </div>
            </section>

            <section style={{background:"#fff",border:`1px solid ${border}`,borderRadius:14,overflow:"hidden",boxShadow:"0 4px 14px rgba(2,55,108,.08)"}}>
              <SectionHeader title="PRÓXIMOS HITOS" icon="▣"/>
              <div style={{padding:12}}>
                {[
                  ["02 Nov 2026","Inicio contractual","Programado"],
                  ["13 Nov 2026","Preliminares","Programado"],
                  ["18 Dic 2026","Liberación cimentación","Programado"],
                  ["12 Feb 2027","Montaje estructura","Programado"],
                  ["30 Jun 2027","Entrega contractual","Programado"],
                ].map(([date,title,status])=><div key={title} style={{display:"grid",gridTemplateColumns:"84px 1fr 82px",gap:7,padding:"8px 2px",borderBottom:`1px solid ${border}`,fontSize:11.5}}>
                  <span>{date}</span><strong>{title}</strong><span style={{color:blue}}>○ {status}</span>
                </div>)}
              </div>
            </section>

            <section style={{background:"#fff",border:`1px solid ${border}`,borderRadius:14,overflow:"hidden",boxShadow:"0 4px 14px rgba(2,55,108,.08)"}}>
              <SectionHeader title="INDICADORES CLAVE (EVM)" icon="📈"/>
              <div style={{padding:12}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                  {[["SPI","Sin corte",green],["CPI","Sin corte",orange],["EAC","$24.6 M",blue]].map(([k,v,c])=><div key={k} style={{borderRadius:10,background:`${c}12`,padding:10,textAlign:"center",border:`1px solid ${c}30`}}>
                    <div style={{fontSize:12,fontWeight:900}}>{k}</div><div style={{fontSize:17,fontWeight:950,color:c,marginTop:4}}>{v}</div>
                  </div>)}
                </div>
                <div style={{marginTop:14}}>
                  <div style={{fontWeight:900,fontSize:12}}>TENDENCIA DEL DESEMPEÑO</div>
                  <div style={{height:96,position:"relative",marginTop:8,borderLeft:`1px solid ${border}`,borderBottom:`1px solid ${border}`}}>
                    <svg viewBox="0 0 300 90" preserveAspectRatio="none" style={{position:"absolute",inset:0,width:"100%",height:"100%"}}>
                      <polyline points="0,65 50,60 100,58 150,56 200,55 250,54 300,53" fill="none" stroke={blue} strokeWidth="3"/>
                      <polyline points="0,70 50,68 100,68 150,67 200,66 250,65 300,65" fill="none" stroke={orange} strokeWidth="3"/>
                    </svg>
                  </div>
                  <div style={{fontSize:11,color:muted,marginTop:6}}>Se activa con el primer corte real.</div>
                </div>
              </div>
            </section>
          </div>
        </div>

        <style>{`
          @media (max-width: 1180px) {
            main > div { grid-template-columns: 84px minmax(0,1fr) !important; }
            aside nav a span:last-child, aside > div:first-child div:last-child, aside > div:last-child { display:none !important; }
            aside nav a { justify-content:center !important; padding-left:10px !important; padding-right:10px !important; }
            aside > div:first-child { padding-left:12px !important; padding-right:12px !important; }
            section[style*="repeat(6"] { grid-template-columns: repeat(3,minmax(0,1fr)) !important; }
          }
          @media (max-width: 900px) {
            main > div { display:block !important; }
            aside { position:static !important; min-height:auto !important; display:block !important; }
            aside nav { display:flex !important; overflow-x:auto !important; padding:8px !important; }
            aside nav a { min-width:54px !important; border-left:0 !important; border-radius:10px !important; }
            aside > div:first-child, aside > div:last-child { display:none !important; }
            header { min-height:88px !important; }
            section[style*="repeat(6"] { grid-template-columns: repeat(2,minmax(0,1fr)) !important; }
            div[style*="1.45fr"] { grid-template-columns:1fr !important; }
            div[style*="1.2fr"] { grid-template-columns:1fr !important; }
          }
          @media (max-width: 600px) {
            section[style*="repeat(6"] { grid-template-columns:1fr !important; }
          }
        `}</style>
      </div>
    </div>
  </main>
}
