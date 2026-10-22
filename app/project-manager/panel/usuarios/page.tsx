import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireProjectManagerAdmin, PM_INTERNAL_ROLES } from "@/lib/project-manager/access";
import { PmHeader, card } from "@/app/project-manager/panel/_components";
import { crearUsuarioProjectManager, restablecerPasswordProjectManager, alternarEstadoUsuarioProjectManager } from "./actions";

const roleNames: Record<string,string> = {
  DIRECTOR:"Director",
  ADMINISTRADOR:"Administrador",
  GERENTE:"Gerente",
  COORDINADOR:"Coordinador",
  INSPECTOR:"Inspector",
};

export default async function UsuariosProjectManagerPage() {
  const { session } = await requireProjectManagerAdmin();
  const currentId = String((session.user as { id?: string }).id ?? "");
  const usuarios = await prisma.usuario.findMany({
    where: { rol: { in: [...PM_INTERNAL_ROLES] } },
    select: {
      id:true,nombre:true,email:true,rol:true,activo:true,requiereCambioPassword:true,
      ultimoAcceso:true,intentosFallidos:true,bloqueadoHasta:true,
    },
    orderBy:[{activo:"desc"},{nombre:"asc"}],
  });

  const input={border:"1px solid #b7cadb",borderRadius:10,padding:"11px 12px",fontSize:14,color:"#082f64",background:"#fff",width:"100%",boxSizing:"border-box" as const};

  return <main style={{minHeight:"100vh",background:"#eef6fb",color:"#082f64"}}>
    <PmHeader title="Usuarios y Contraseñas" subtitle="Administración de acceso a Certeza Project Manager."/>
    <section style={{maxWidth:1450,margin:"0 auto",padding:"24px 22px 60px"}}>
      <div style={{...card,padding:24}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:18,alignItems:"start",flexWrap:"wrap"}}>
          <div>
            <h2 style={{margin:"0 0 6px"}}>Crear usuario</h2>
            <p style={{margin:0,color:"#365b7d",fontWeight:600,lineHeight:1.55,maxWidth:740}}>
              La contraseña se cifra antes de guardarse. Nunca se muestra una contraseña existente; cuando se olvida, se restablece por una nueva.
            </p>
          </div>
          <Link href="/project-manager/cambiar-password" style={{color:"#0a6fdc",fontWeight:900,textDecoration:"none"}}>Cambiar mi contraseña →</Link>
        </div>

        <form action={crearUsuarioProjectManager} style={{display:"grid",gridTemplateColumns:"1.3fr 1.3fr 1fr 1fr auto",gap:10,marginTop:20,alignItems:"end"}}>
          <label style={{display:"grid",gap:6,fontWeight:800}}>Nombre<input name="nombre" required minLength={3} style={input}/></label>
          <label style={{display:"grid",gap:6,fontWeight:800}}>Correo<input name="email" type="email" required style={input}/></label>
          <label style={{display:"grid",gap:6,fontWeight:800}}>Contraseña temporal<input name="password" type="password" required minLength={8} autoComplete="new-password" style={input}/></label>
          <label style={{display:"grid",gap:6,fontWeight:800}}>Rol<select name="rol" required style={input}>{PM_INTERNAL_ROLES.map(r=><option key={r} value={r}>{roleNames[r]}</option>)}</select></label>
          <button type="submit" style={{border:0,borderRadius:10,padding:"12px 18px",background:"#ff8500",color:"#fff",fontWeight:950,cursor:"pointer"}}>Crear usuario</button>
        </form>
      </div>

      <div style={{...card,marginTop:18,padding:0,overflow:"hidden"}}>
        <div style={{padding:"18px 20px",background:"linear-gradient(90deg,#053f79,#0874c9)",color:"#fff"}}>
          <h2 style={{margin:0}}>Usuarios autorizados · {usuarios.length}</h2>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:1150}}>
            <thead><tr>{["Usuario","Rol","Estado","Seguridad","Último acceso","Restablecer contraseña","Acción"].map(h=><th key={h} style={{textAlign:"left",padding:12,color:"#082f64",background:"#e6f1f8",borderBottom:"1px solid #c8dbe9",fontSize:13}}>{h}</th>)}</tr></thead>
            <tbody>
              {usuarios.map(u=><tr key={u.id}>
                <td style={{padding:12,borderBottom:"1px solid #d8e6f2"}}><strong>{u.nombre}</strong><div style={{color:"#365b7d",fontSize:12,marginTop:3}}>{u.email}</div></td>
                <td style={{padding:12,borderBottom:"1px solid #d8e6f2",fontWeight:800}}>{roleNames[u.rol] ?? u.rol}</td>
                <td style={{padding:12,borderBottom:"1px solid #d8e6f2"}}><span style={{fontWeight:900,color:u.activo?"#137a42":"#b42318"}}>{u.activo?"ACTIVO":"INACTIVO"}</span></td>
                <td style={{padding:12,borderBottom:"1px solid #d8e6f2",fontSize:12,color:"#365b7d"}}>
                  {u.requiereCambioPassword?"Debe cambiar contraseña":"Contraseña vigente"}<br/>
                  Intentos fallidos: {u.intentosFallidos}{u.bloqueadoHasta?<><br/><b style={{color:"#b42318"}}>Bloqueado temporalmente</b></>:null}
                </td>
                <td style={{padding:12,borderBottom:"1px solid #d8e6f2",fontSize:12}}>{u.ultimoAcceso?u.ultimoAcceso.toLocaleString("es-MX"):"Sin acceso registrado"}</td>
                <td style={{padding:12,borderBottom:"1px solid #d8e6f2"}}>
                  <form action={restablecerPasswordProjectManager} style={{display:"flex",gap:8}}>
                    <input type="hidden" name="usuarioId" value={u.id}/>
                    <input name="password" type="password" minLength={8} required placeholder="Nueva temporal" autoComplete="new-password" style={{...input,minWidth:150}}/>
                    <button type="submit" style={{border:"1px solid #0a6fdc",borderRadius:9,background:"#fff",color:"#075fae",fontWeight:900,padding:"8px 10px",cursor:"pointer"}}>Restablecer</button>
                  </form>
                </td>
                <td style={{padding:12,borderBottom:"1px solid #d8e6f2"}}>
                  <form action={alternarEstadoUsuarioProjectManager}>
                    <input type="hidden" name="usuarioId" value={u.id}/>
                    <button type="submit" disabled={u.id===currentId} style={{border:0,borderRadius:9,padding:"9px 12px",fontWeight:900,cursor:u.id===currentId?"not-allowed":"pointer",background:u.activo?"#fee4e2":"#dcfae6",color:u.activo?"#b42318":"#137a42",opacity:u.id===currentId ? .55 : 1}}>
                      {u.id===currentId?"Sesión actual":u.activo?"Desactivar":"Activar"}
                    </button>
                  </form>
                </td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{...card,marginTop:18}}>
        <h3 style={{marginTop:0}}>Reglas de acceso</h3>
        <p style={{margin:0,color:"#365b7d",fontWeight:600,lineHeight:1.65}}>
          DIRECTOR y ADMINISTRADOR administran usuarios y contraseñas. GERENTE, COORDINADOR e INSPECTOR pueden iniciar sesión en el Centro de Control. VENDEDOR y CLIENTE no pueden acceder al panel interno de Project Manager.
        </p>
      </div>
    </section>
  </main>
}
