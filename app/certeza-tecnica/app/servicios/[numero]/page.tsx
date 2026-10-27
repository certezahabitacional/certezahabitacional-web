import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getServicioCT, RUTA_34_SERVICIOS } from "@/lib/certeza-tecnica/ruta-servicios";

export default async function ServicioCTPage({params}:{params:Promise<{numero:string}>}){
  const session=await auth();
  if(!session?.user) redirect("/certeza-tecnica/login?callbackUrl=%2Fcerteza-tecnica%2Fapp");

  const {numero}=await params;
  const n=Number(numero);
  const s=getServicioCT(n);
  if(!s) notFound();

  const prev=RUTA_34_SERVICIOS.find(x=>x.numero===n-1);
  const next=RUTA_34_SERVICIOS.find(x=>x.numero===n+1);

  return <main style={{minHeight:"100vh",background:"#eef4f8",color:"#0a315a"}}>
    <header style={{background:"linear-gradient(105deg,#061b35,#0c4776)",color:"#fff",borderBottom:`5px solid ${s.color}`}}>
      <div style={{maxWidth:1500,margin:"0 auto",padding:"18px 22px"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:16,flexWrap:"wrap",alignItems:"center"}}>
          <Link href="/certeza-tecnica/app" style={{color:"#fff",textDecoration:"none",fontWeight:900}}>← Certeza Técnica 360</Link>
          <div style={{fontSize:12,fontWeight:900,letterSpacing:".08em",color:"#f7d57b"}}>MANUAL DE PROCEDIMIENTO · SERVICIO {s.numero} DE 34</div>
        </div>
        <div style={{display:"flex",gap:18,alignItems:"center",marginTop:16,flexWrap:"wrap"}}>
          <div style={{minWidth:82,height:82,borderRadius:18,background:s.color,display:"grid",placeItems:"center",fontSize:42,fontWeight:950}}>{s.numero}</div>
          <div style={{flex:"1 1 500px"}}>
            <div style={{fontSize:13,fontWeight:900,opacity:.85}}>{s.fase} · {s.area}</div>
            <h1 style={{fontSize:"clamp(28px,4vw,48px)",lineHeight:1.05,margin:"5px 0 0"}}>{s.nombre}</h1>
          </div>
        </div>
      </div>
    </header>

    <div style={{maxWidth:1500,margin:"0 auto",padding:22}}>
      <section style={{display:"grid",gridTemplateColumns:"1.1fr .9fr",gap:14}}>
        <article style={card}>
          <Title n="1" text="Concepto y objetivo" color={s.color}/>
          <p style={{fontSize:18,lineHeight:1.65,margin:"14px 0 0",color:"#294f6c"}}>{s.objetivo}</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:10,marginTop:18}}>
            <Mini title="Área" text={s.area} />
            <Mini title="Fase" text={s.fase} />
            <Mini title="Núcleo" text="Certeza Project Manager" />
          </div>
        </article>

        <article style={card}>
          <Title n="2" text="Entradas necesarias" color={s.color}/>
          <IconList items={s.entradas} icon="▣"/>
        </article>
      </section>

      <section style={{display:"grid",gridTemplateColumns:"1.2fr .8fr",gap:14,marginTop:14}}>
        <article style={card}>
          <Title n="3" text="Cómo funciona" color={s.color}/>
          <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(s.pasos.length,5)},minmax(0,1fr))`,gap:10,marginTop:14}}>
            {s.pasos.map((x,i)=><div key={x} style={{border:"1px solid #d9e6ef",borderRadius:14,padding:12,background:"#f8fbfd",textAlign:"center"}}>
              <div style={{width:34,height:34,borderRadius:"50%",background:s.color,color:"#fff",display:"grid",placeItems:"center",margin:"0 auto 8px",fontWeight:950}}>{i+1}</div>
              <div style={{fontSize:12,fontWeight:850,lineHeight:1.4}}>{x}</div>
            </div>)}
          </div>
        </article>

        <article style={card}>
          <Title n="4" text="Controles obligatorios" color={s.color}/>
          <IconList items={s.controles} icon="✓"/>
        </article>
      </section>

      <section style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:14,marginTop:14}}>
        <article style={card}>
          <Title n="5" text="Entregables" color={s.color}/>
          <IconList items={s.entregables} icon="▤"/>
        </article>
        <article style={card}>
          <Title n="6" text="Qué alimenta a Project Manager" color={s.color}/>
          <IconList items={s.alimentaPM} icon="◉"/>
        </article>
        <article style={card}>
          <Title n="7" text="Indicadores" color={s.color}/>
          <IconList items={s.indicadores} icon="▥"/>
        </article>
      </section>

      <section style={{...card,marginTop:14,border:"2px solid #0b5a8f",background:"linear-gradient(135deg,#061b35,#0b4e7f)",color:"#fff"}}>
        <div style={{display:"grid",gridTemplateColumns:"auto 1fr auto",gap:16,alignItems:"center"}}>
          <div style={{fontSize:42}}>✦</div>
          <div>
            <div style={{fontSize:12,fontWeight:950,color:"#f7d57b",letterSpacing:".08em"}}>REGLA CERTEZA 360</div>
            <div style={{fontSize:19,fontWeight:900,marginTop:4}}>Este servicio nunca funciona como una isla.</div>
            <div style={{fontSize:13,color:"#d8e7f2",marginTop:4}}>Toda información relevante generada aquí debe quedar vinculada al ProyectoPM correspondiente.</div>
          </div>
          <Link href="/certeza-tecnica/app" style={{background:"#f0ce70",color:"#071d38",textDecoration:"none",padding:"11px 14px",borderRadius:10,fontWeight:950}}>Volver a la ruta</Link>
        </div>
      </section>

      <nav style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:14}}>
        <div>{prev&&<Link href={`/certeza-tecnica/app/servicios/${prev.numero}`} style={navBtn}>← {prev.numero}. {prev.nombre}</Link>}</div>
        <div style={{textAlign:"right"}}>{next&&<Link href={`/certeza-tecnica/app/servicios/${next.numero}`} style={navBtn}>{next.numero}. {next.nombre} →</Link>}</div>
      </nav>
    </div>

    <style>{`
      @media(max-width:900px){
        section[style*="1.1fr .9fr"],section[style*="1.2fr .8fr"],section[style*="repeat(3"]{grid-template-columns:1fr !important}
        div[style*="repeat("]{grid-template-columns:repeat(2,minmax(0,1fr)) !important}
      }
      @media(max-width:560px){
        div[style*="repeat("]{grid-template-columns:1fr !important}
        nav{grid-template-columns:1fr !important}
      }
    `}</style>
  </main>
}

function Title({n,text,color}:{n:string;text:string;color:string}){
  return <div style={{display:"flex",alignItems:"center",gap:10,borderBottom:"1px solid #e1e9ef",paddingBottom:10}}>
    <div style={{width:36,height:36,borderRadius:9,background:color,color:"#fff",display:"grid",placeItems:"center",fontWeight:950,fontSize:20}}>{n}</div>
    <h2 style={{margin:0,fontSize:21}}>{text}</h2>
  </div>
}
function IconList({items,icon}:{items:string[];icon:string}){
  return <div style={{display:"grid",gap:8,marginTop:14}}>{items.map(x=><div key={x} style={{display:"grid",gridTemplateColumns:"26px 1fr",gap:8,alignItems:"start",padding:"8px 0",borderBottom:"1px solid #edf2f5"}}>
    <div style={{fontWeight:950,color:"#0b5a8f"}}>{icon}</div><div style={{fontSize:13,fontWeight:750,lineHeight:1.45}}>{x}</div>
  </div>)}</div>
}
function Mini({title,text}:{title:string;text:string}){return <div style={{background:"#f5f9fc",border:"1px solid #dfe9f0",borderRadius:12,padding:10}}><div style={{fontSize:10,fontWeight:950,color:"#73889a",textTransform:"uppercase"}}>{title}</div><div style={{fontSize:12,fontWeight:900,marginTop:4}}>{text}</div></div>}
const card={background:"#fff",border:"1px solid #d7e3ec",borderRadius:16,padding:18,boxShadow:"0 6px 18px rgba(4,42,76,.05)"} as const;
const navBtn={display:"inline-block",background:"#fff",border:"1px solid #d7e3ec",borderRadius:10,padding:"10px 12px",color:"#0a315a",textDecoration:"none",fontWeight:900} as const;
