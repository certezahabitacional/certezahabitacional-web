import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/project-manager/access";
import { PmHeader, card } from "@/app/project-manager/panel/_components";
import { asignarParticipantePM, retirarParticipantePM } from "./actions";

const roleNames: Record<string,string> = {
  DIRECTOR:"Director",
  ADMINISTRADOR:"Administrador",
  GERENTE:"Gerente",
  COORDINADOR:"Coordinador",
  SUPERVISOR:"Supervisor",
  RESIDENTE:"Residente",
  CLIENTE:"Cliente",
};

const assignableRoles=["GERENTE","COORDINADOR","SUPERVISOR","RESIDENTE","CLIENTE"] as const;

export default async function EquipoProyectoPage({searchParams}:{searchParams:Promise<{codigo?:string}>}) {
  const q=await searchParams;
  const codigo=String(q.codigo ?? "").trim().toUpperCase();
  if(!codigo) {
    return <main style={{minHeight:"100vh",background:"#eef6fb",color:"#082f64"}}>
      <PmHeader title="Equipo del proyecto" subtitle="Selecciona un proyecto para administrar sus participantes."/>
      <section style={{maxWidth:900,margin:"0 auto",padding:"24px 22px 60px"}}>
        <div style={{...card,padding:26}}>
          <p style={{marginTop:0}}>No se indicó un proyecto.</p>
          <Link href="/project-manager/panel/proyectos" style={{fontWeight:900,color:"#0a6fdc",textDecoration:"none"}}>← Ir a Proyectos</Link>
        </div>
      </section>
    </main>;
  }

  const { role, proyecto } = await requireProjectAccess(codigo);
  const esDirector=role==="DIRECTOR";

  const participantes=await prisma.proyectoPMUsuario.findMany({
    where:{proyectoId:proyecto.id},
    include:{usuario:{select:{id:true,nombre:true,email:true,rol:true,activo:true,projectManagerAutorizado:true}}},
    orderBy:{asignadoEn:"asc"},
  });

  const asignados=new Set(participantes.map(p=>p.usuarioId));
  const candidatos=esDirector ? await prisma.usuario.findMany({
    where:{
      activo:true,
      projectManagerAutorizado:true,
      rol:{in:[...assignableRoles]},
      id:{notIn:[...asignados]},
    },
    select:{id:true,nombre:true,email:true,rol:true},
    orderBy:[{rol:"asc"},{nombre:"asc"}],
  }) : [];

  const input={border:"1px solid #b7cadb",borderRadius:10,padding:"11px 12px",fontSize:14,color:"#082f64",background:"#fff",width:"100%",boxSizing:"border-box" as const};

  return <main style={{minHeight:"100vh",background:"#eef6fb",color:"#082f64"}}>
    <PmHeader title={`Participantes / Equipo · ${proyecto.codigo}`} subtitle={proyecto.nombre}/>
    <section style={{maxWidth:1200,margin:"0 auto",padding:"24px 22px 60px"}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap",marginBottom:16}}>
        <Link href={`/project-manager/panel/proyectos/${proyecto.codigo.toLowerCase()}`} style={{fontWeight:900,color:"#0a6fdc",textDecoration:"none"}}>← Volver al proyecto</Link>
        <div style={{fontWeight:850,color:"#294f73"}}>{participantes.length} participante(s)</div>
      </div>

      {esDirector && <div style={{...card,padding:22,marginBottom:16}}>
        <h2 style={{marginTop:0}}>Asignar participante</h2>
        <p style={{color:"#294f73",lineHeight:1.55}}>
          Sólo aparecen usuarios activos y autorizados para Certeza Project Manager. El rol dentro del proyecto se toma del rol autorizado del usuario.
        </p>
        {candidatos.length>0 ? <form action={asignarParticipantePM} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,alignItems:"end"}}>
          <input type="hidden" name="codigo" value={proyecto.codigo}/>
          <label style={{display:"grid",gap:6,fontWeight:850}}>Usuario
            <select name="usuarioId" required style={input}>
              <option value="">Seleccionar usuario...</option>
              {candidatos.map(u=><option key={u.id} value={u.id}>{u.nombre} · {roleNames[u.rol] ?? u.rol} · {u.email}</option>)}
            </select>
          </label>
          <button type="submit" style={{border:0,borderRadius:10,padding:"12px 18px",background:"#ff8500",color:"#fff",fontWeight:950,cursor:"pointer"}}>Asignar</button>
        </form> : <div style={{background:"#f5faff",border:"1px solid #d8e6f2",borderRadius:10,padding:13,color:"#294f73",fontWeight:700}}>
          No hay usuarios autorizados pendientes de asignar. Puedes crear o autorizar usuarios desde “Usuarios”.
        </div>}
      </div>}

      <div style={{...card,padding:0,overflow:"hidden"}}>
        <div style={{padding:"15px 18px",background:"linear-gradient(90deg,#053f79,#0874c9)",color:"#fff"}}>
          <h2 style={{margin:0}}>Equipo actual</h2>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:800}}>
            <thead><tr>{["Participante","Rol","Acceso PM","Modo","Asignado","Acción"].map(h=><th key={h} style={{textAlign:"left",padding:12,background:"#e6f1f8",borderBottom:"1px solid #c8dbe9",fontSize:13}}>{h}</th>)}</tr></thead>
            <tbody>
              {participantes.map(p=><tr key={p.id}>
                <td style={{padding:12,borderBottom:"1px solid #d8e6f2"}}><strong>{p.usuario.nombre}</strong><div style={{fontSize:12,color:"#365b7d",marginTop:3}}>{p.usuario.email}</div></td>
                <td style={{padding:12,borderBottom:"1px solid #d8e6f2",fontWeight:850}}>{roleNames[p.rolEnProyecto ?? p.usuario.rol] ?? (p.rolEnProyecto ?? p.usuario.rol)}</td>
                <td style={{padding:12,borderBottom:"1px solid #d8e6f2"}}><span style={{fontWeight:900,color:p.usuario.projectManagerAutorizado?"#137a42":"#b42318"}}>{p.usuario.projectManagerAutorizado?"AUTORIZADO":"NO AUTORIZADO"}</span></td>
                <td style={{padding:12,borderBottom:"1px solid #d8e6f2",fontWeight:850}}>{p.soloLectura?"SÓLO LECTURA":"OPERACIÓN"}</td>
                <td style={{padding:12,borderBottom:"1px solid #d8e6f2",fontSize:12}}>{p.asignadoEn.toLocaleString("es-MX")}</td>
                <td style={{padding:12,borderBottom:"1px solid #d8e6f2"}}>
                  {esDirector && p.usuario.rol!=="DIRECTOR" ? <form action={retirarParticipantePM}>
                    <input type="hidden" name="codigo" value={proyecto.codigo}/>
                    <input type="hidden" name="participanteId" value={p.id}/>
                    <button type="submit" style={{border:0,borderRadius:9,padding:"8px 11px",background:"#fee4e2",color:"#b42318",fontWeight:900,cursor:"pointer"}}>Retirar</button>
                  </form> : <span style={{color:"#667f99",fontSize:12}}>Sin acción</span>}
                </td>
              </tr>)}
              {participantes.length===0 && <tr><td colSpan={6} style={{padding:24,textAlign:"center",color:"#294f73"}}>Aún no hay participantes asignados.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {!esDirector && <div style={{...card,marginTop:16,background:"#f5faff"}}>
        <strong>Consulta de equipo</strong>
        <p style={{marginBottom:0,color:"#294f73"}}>Sólo el Director puede asignar o retirar participantes del proyecto.</p>
      </div>}
    </section>
  </main>;
}
