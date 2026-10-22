import Link from "next/link";
import LogoCertezaTecnica from "@/components/branding/LogoCertezaTecnica";
import { prisma } from "@/lib/prisma";
import { requireProjectManagerAccess } from "@/lib/project-manager/access";
import { cerrarSesionProjectManager } from "./actions";

const navy="#053f79";
const navyDark="#032b58";
const orange="#ff8500";
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
] as const;

function Kpi({title,value,detail,icon}:{title:string;value:string;detail:string;icon:string}) {
  return <article style={{background:"#fff",border:`1px solid ${border}`,borderRadius:14,padding:"17px 18px",boxShadow:"0 4px 14px rgba(2,55,108,.08)"}}>
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <span style={{fontSize:25}}>{icon}</span>
      <strong style={{fontSize:12,color:ink,textTransform:"uppercase"}}>{title}</strong>
    </div>
    <div style={{fontSize:30,fontWeight:950,color:ink,marginTop:11}}>{value}</div>
    <div style={{fontSize:13,color:muted,marginTop:6}}>{detail}</div>
  </article>
}

export default async function ProjectManagerPanelPage() {
  const {session,role,readOnly}=await requireProjectManagerAccess();
  const user=session.user.name ?? session.user.email ?? "Usuario autorizado";
  const userId=String((session.user as {id?:string}).id ?? "");

  const where=role==="DIRECTOR" || role==="ADMINISTRADOR"
    ? {activo:true}
    : {activo:true,participantes:{some:{usuarioId:userId}}};

  const [totalDb,planeacionDb]=await Promise.all([
    prisma.proyectoPM.count({where}),
    prisma.proyectoPM.count({where:{...where,estado:"PLANEACION"}}),
  ]);

  const legacyVisible=role==="DIRECTOR" || role==="ADMINISTRADOR";
  const total=totalDb+(legacyVisible?1:0);
  const planeacion=planeacionDb+(legacyVisible?1:0);

  const sidebarVisible=readOnly
    ? sidebar.filter(([,label])=>!["Accesos","Usuarios"].includes(label))
    : sidebar;

  return <main style={{minHeight:"100vh",background:canvas,color:ink}}>
    <div style={{display:"grid",gridTemplateColumns:"220px minmax(0,1fr)",minHeight:"100vh"}}>
      <aside style={{background:`linear-gradient(180deg,${navyDark} 0%,${navy} 55%,#074b86 100%)`,color:"#fff",display:"flex",flexDirection:"column",minHeight:"100vh",position:"sticky",top:0,alignSelf:"start"}}>
        <div style={{padding:"18px 14px 16px",borderBottom:"1px solid rgba(255,255,255,.14)",display:"grid",gap:10}}>
          <LogoCertezaTecnica href="/certeza-tecnica" height={58}/>
          <div style={{fontSize:11,color:"#ffb357",fontWeight:950,letterSpacing:".08em"}}>PROJECT MANAGER</div>
        </div>
        <nav style={{padding:"14px 0"}}>
          {sidebarVisible.map(([icon,label,href],i)=><Link key={label} href={href} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 18px",textDecoration:"none",color:"#fff",fontWeight:i===0?900:700,fontSize:14,background:i===0?orange:"transparent",borderLeft:i===0?"4px solid #ffd29a":"4px solid transparent"}}>
            <span style={{fontSize:19,width:24,textAlign:"center"}}>{icon}</span><span>{label}</span>
          </Link>)}
        </nav>
        <div style={{marginTop:"auto",padding:"24px 18px 28px",borderTop:"1px solid rgba(255,255,255,.1)",background:"rgba(0,0,0,.08)"}}>
          <div style={{fontSize:12,fontWeight:900,lineHeight:1.45}}>PROYECTOS<br/>MÁS PREDECIBLES<br/>DECISIONES<br/>MÁS SEGURAS</div>
          <div style={{width:76,height:4,background:orange,borderRadius:99,marginTop:14}}/>
        </div>
      </aside>

      <div style={{minWidth:0}}>
        <header style={{background:`linear-gradient(100deg,${navyDark},${navy} 46%,#0d75bd)`,color:"#fff",minHeight:104,display:"flex",alignItems:"center",justifyContent:"space-between",gap:20,padding:"14px 24px"}}>
          <div style={{display:"flex",alignItems:"center",gap:18,flexWrap:"wrap"}}>
            <LogoCertezaTecnica href="/certeza-tecnica" height={70}/>
            <div style={{borderLeft:"1px solid rgba(255,255,255,.28)",paddingLeft:18}}>
              <div style={{fontSize:"clamp(24px,3vw,42px)",fontWeight:950,lineHeight:1}}>CERTEZA <span style={{color:orange}}>PROJECT MANAGER</span></div>
              <div style={{fontSize:18,color:"#f0f8ff",marginTop:6}}>Centro de Control General</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:14,textAlign:"right"}}>
            <div style={{width:42,height:42,borderRadius:"50%",background:"#fff",display:"grid",placeItems:"center",color:navy,fontWeight:950}}>CG</div>
            <div>
              <div style={{fontWeight:900}}>{user}</div>
              <div style={{fontSize:12,color:"#f0f8ff"}}>{readOnly?"CLIENTE · SÓLO LECTURA":role}</div>
              <form action={cerrarSesionProjectManager} style={{marginTop:5}}>
                <button type="submit" style={{border:0,background:"transparent",color:"#ffd9b0",fontWeight:800,padding:0,cursor:"pointer",fontSize:12}}>Cerrar sesión</button>
              </form>
            </div>
          </div>
        </header>

        <div style={{padding:18,maxWidth:1500,margin:"0 auto"}}>
          <section style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(170px,1fr))",gap:12}}>
            <Kpi icon="📁" title="Proyectos disponibles" value={String(total)} detail="Según tus permisos y asignaciones"/>
            <Kpi icon="🟦" title="Proyectos activos" value={String(total)} detail="Disponibles para consulta u operación"/>
            <Kpi icon="📋" title="En planeación" value={String(planeacion)} detail="Pendientes de consolidar su línea base"/>
            <Kpi icon="🎯" title="Proyecto seleccionado" value="Ninguno" detail="Selecciona un proyecto para ver sus indicadores"/>
          </section>

          <section style={{marginTop:16,background:"#fff",border:`1px solid ${border}`,borderRadius:16,boxShadow:"0 4px 14px rgba(2,55,108,.08)",overflow:"hidden"}}>
            <div style={{background:`linear-gradient(90deg,${navy},#0874c9)`,color:"#fff",padding:"13px 18px",fontSize:19,fontWeight:950}}>SELECCIÓN DE PROYECTO</div>
            <div style={{padding:28,display:"grid",gridTemplateColumns:"1.2fr .8fr",gap:24,alignItems:"center"}}>
              <div>
                <div style={{fontSize:46}}>📂</div>
                <h2 style={{fontSize:30,margin:"8px 0 8px"}}>No hay un proyecto abierto</h2>
                <p style={{color:muted,fontSize:16,lineHeight:1.6,maxWidth:720}}>
                  El Centro de Control General no muestra información de un proyecto específico. Selecciona un proyecto para consultar sus módulos, indicadores, reportes y detalle operativo.
                </p>
                <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:18}}>
                  <Link href="/project-manager/panel/proyectos" style={{background:navy,color:"#fff",textDecoration:"none",fontWeight:950,padding:"13px 18px",borderRadius:10}}>Seleccionar proyecto →</Link>
                  {role==="DIRECTOR" && <Link href="/project-manager/panel/proyectos/nuevo" style={{background:orange,color:"#fff",textDecoration:"none",fontWeight:950,padding:"13px 18px",borderRadius:10}}>+ Nuevo proyecto</Link>}
                </div>
              </div>
              <div style={{background:"#f4f9fc",border:`1px solid ${border}`,borderRadius:14,padding:20}}>
                <h3 style={{marginTop:0}}>Flujo correcto</h3>
                <ol style={{paddingLeft:20,lineHeight:2,color:muted,fontWeight:700}}>
                  <li>Entrar a Project Manager</li>
                  <li>Seleccionar o crear proyecto</li>
                  <li>Abrir el proyecto</li>
                  <li>Consultar o alimentar sus módulos</li>
                  <li>Regresar al portafolio cuando sea necesario</li>
                </ol>
              </div>
            </div>
          </section>

          <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12,marginTop:16}}>
            {[
              ["📁","Proyectos","Seleccionar un proyecto del portafolio.","/project-manager/panel/proyectos"],
              ["▣","Portafolio","Vista general de proyectos.","/project-manager/panel/portafolio"],
              ["▧","Reportes","Reportes generales disponibles.","/project-manager/panel/reportes"],
              ["✦","Inteligencia Certeza","Análisis y apoyo a la decisión.","/project-manager/panel/inteligencia"],
            ].map(([icon,title,desc,href])=><Link key={title} href={href} style={{background:"#fff",border:`1px solid ${border}`,borderRadius:14,padding:18,textDecoration:"none",color:ink,boxShadow:"0 4px 14px rgba(2,55,108,.06)"}}>
              <div style={{fontSize:28}}>{icon}</div><h3 style={{margin:"8px 0 5px"}}>{title}</h3><p style={{margin:0,color:muted,lineHeight:1.5}}>{desc}</p>
            </Link>)}
          </section>
        </div>
      </div>
    </div>

    <style>{`
      @media (max-width:900px){
        main > div{display:block !important;}
        aside{position:static !important;min-height:auto !important;}
        aside nav{display:flex !important;overflow-x:auto !important;}
        section[style*="repeat(4"]{grid-template-columns:repeat(2,minmax(0,1fr)) !important;}
        div[style*="1.2fr .8fr"]{grid-template-columns:1fr !important;}
      }
      @media (max-width:600px){
        section[style*="repeat(4"]{grid-template-columns:1fr !important;}
      }
    `}</style>
  </main>
}
