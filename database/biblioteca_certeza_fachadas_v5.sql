-- Biblioteca Certeza V5: fachadas por cara y plantillas interiores sin conceptos genéricos redundantes.
-- Aplicar en DEV y, tras validar el Preview, en producción.

begin;

insert into "BibliotecaPuntoCerteza"
("codigo","grupo","nombre","descripcion","modulo","obligatorioDefault","permiteNoAplica","requiereMedicion","requiereComparacionProyecto","herramientaSugerida","textoSinHallazgo","orden","activa")
values
('FACHADA_MOLDURAS','FACHADA','Fachada: molduras, cornisas y remates','Revisar alineación, fijación, continuidad, uniones, fisuras, desprendimientos, golpes y uniformidad de acabado en molduras, cornisas y remates visibles.','FACHADA',true,true,false,false,'Inspección visual / nivel','Molduras, cornisas y remates visibles en condición aceptable.',95,true),
('FACHADA_RODAPIE','FACHADA','Fachada: rodapié / zoclo exterior','Revisar continuidad, nivel, adherencia, juntas, remates, manchas, desprendimientos y encuentro con piso, banqueta o terreno.','FACHADA',true,true,false,false,'Inspección visual / nivel','Rodapié o zoclo exterior continuo, nivelado y sin daños visibles relevantes.',97,true),
('FACHADA_JUNTAS','FACHADA','Fachada: juntas y encuentros','Revisar juntas constructivas, encuentros entre materiales, esquinas, cambios de plano, sellos y remates para detectar aperturas, discontinuidades o desprendimientos.','FACHADA',true,true,false,false,'Inspección visual','Juntas y encuentros de fachada sin discontinuidades visibles relevantes.',99,true),
('FACHADA_RECUBRIMIENTO','FACHADA','Fachada: recubrimientos y aplanados','Revisar planeidad aparente, adherencia, fisuras, oquedades, desprendimientos, textura, uniformidad y remates de aplanados o recubrimientos exteriores.','FACHADA',true,true,false,false,'Luz rasante / inspección visual','Recubrimientos y aplanados exteriores visualmente uniformes y firmes.',82,true)
on conflict ("codigo") do update set
  "grupo"=excluded."grupo",
  "nombre"=excluded."nombre",
  "descripcion"=excluded."descripcion",
  "modulo"=excluded."modulo",
  "obligatorioDefault"=excluded."obligatorioDefault",
  "permiteNoAplica"=excluded."permiteNoAplica",
  "requiereMedicion"=excluded."requiereMedicion",
  "requiereComparacionProyecto"=excluded."requiereComparacionProyecto",
  "herramientaSugerida"=excluded."herramientaSugerida",
  "textoSinHallazgo"=excluded."textoSinHallazgo",
  "orden"=excluded."orden",
  "activa"=true,
  "actualizadoEn"=now();

delete from "BibliotecaAreaPuntoCerteza" ap
using "BibliotecaAreaCerteza" a, "BibliotecaPuntoCerteza" p
where ap."areaBibliotecaId"=a.id
  and ap."puntoBibliotecaId"=p.id
  and a."codigo" in ('FACHADA_PRINCIPAL','FACHADA_LATERAL')
  and p."codigo" in ('PENDIENTES_EXTERIOR','IMPERMEABILIZACION_VISIBLE','PORTON','BARDAS');

with areas as (
  select id from "BibliotecaAreaCerteza"
  where "codigo" in ('FACHADA_PRINCIPAL','FACHADA_LATERAL')
),
puntos as (
  select id,"orden" from "BibliotecaPuntoCerteza"
  where "codigo" in (
    'DESPLOMES','ESCUADRAS','MUROS_ESTADO','MUROS_ACABADO',
    'FACHADA_RECUBRIMIENTO','ACABADO_UNIFORMIDAD','PINTURA',
    'FACHADA_MOLDURAS','FACHADA_RODAPIE','FACHADA_JUNTAS',
    'VANO_PUERTA','VANO_VENTANA',
    'PUERTA_INSTALACION','PUERTA_FUNCION',
    'VENTANA_INSTALACION','VENTANA_FUNCION',
    'SELLADO_PUERTA','SELLADO_VENTANA',
    'INST_UBICACION','INST_ALTURA','INST_ALINEACION',
    'HUMEDAD_VISIBLE'
  )
)
insert into "BibliotecaAreaPuntoCerteza"
("areaBibliotecaId","puntoBibliotecaId","obligatorio","orden","configuracion")
select a.id,p.id,true,p."orden",jsonb_build_object('permiteNoAplica',true,'versionPlantilla','V5')
from areas a cross join puntos p
on conflict do nothing;

delete from "BibliotecaAreaPuntoCerteza" ap
using "BibliotecaAreaCerteza" a, "BibliotecaPuntoCerteza" p
where ap."areaBibliotecaId"=a.id
  and ap."puntoBibliotecaId"=p.id
  and a."codigo" in (
    'SALA','COMEDOR','ESTANCIA','RECIBIDOR','PASILLO',
    'RECAMARA','RECAMARA_PRINCIPAL','ALCOBA','ESTUDIO',
    'VESTIDOR','COCINA','DESAYUNADOR','BANO_COMPLETO',
    'MEDIO_BANO','LAVANDERIA','CUARTO_SERVICIO','BODEGA',
    'SOTANO','OTRA_AREA'
  )
  and p."codigo" in ('VANOS','SELLADOS');

-- El funcionamiento eléctrico no se repite por área: se resuelve en el Punto 7 · Instalación Eléctrica.
delete from "BibliotecaAreaPuntoCerteza" ap
using "BibliotecaPuntoCerteza" p
where ap."puntoBibliotecaId"=p.id
  and p."codigo"='INST_FUNCIONAMIENTO';

commit;
