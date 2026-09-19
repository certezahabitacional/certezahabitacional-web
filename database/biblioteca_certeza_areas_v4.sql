-- Biblioteca Certeza V4: refuerzo de plantillas para áreas 9+
-- Objetivo: individualizar piso, vanos, sellados, plafones y acabados. El funcionamiento eléctrico se inspecciona en el punto de Instalación Eléctrica.
-- Aplicar primero en DEV; producción sólo después de validar PR #49.

begin;

insert into "BibliotecaPuntoCerteza"
("codigo","grupo","nombre","descripcion","modulo","obligatorioDefault","permiteNoAplica","requiereMedicion","requiereComparacionProyecto","herramientaSugerida","textoSinHallazgo","orden","activa")
values
('PISO_NIVELACION','PISOS','Piso: nivelación y planeidad','Verificar nivelación, planeidad, cejas, cambios de nivel y transiciones. Registrar medición cuando proceda.','BASE',true,true,true,false,'Nivel láser / regla de 2 m','Piso con nivelación y planeidad aceptables en la revisión visible.',112,true),
('VANO_PUERTA','VANOS','Vano de puerta','Revisar ancho, altura, escuadra, plomo, nivel de dintel y jambas, geometría y terminaciones del vano de puerta.','BASE',true,true,true,true,'Medidor láser / nivel','Vano de puerta con geometría y terminaciones aceptables.',132,true),
('VANO_VENTANA','VANOS','Vano de ventana','Revisar ancho, altura, escuadra, plomo, nivel de dintel y antepecho, geometría y terminaciones del vano de ventana.','BASE',true,true,true,true,'Medidor láser / nivel','Vano de ventana con geometría y terminaciones aceptables.',134,true),
('SELLADO_PUERTA','SELLADOS','Puertas: sellados y encuentros','Revisar continuidad y calidad de sellos, encuentros con marco y muro, remates, juntas y posibles pasos de agua o aire visibles.','BASE',true,true,false,false,'Inspección visual','Sellados y encuentros de puerta sin discontinuidades visibles relevantes.',182,true),
('SELLADO_VENTANA','SELLADOS','Ventanas: sellados y encuentros','Revisar sellado perimetral interior y exterior accesible, continuidad, adherencia, remates, juntas y posibles entradas de agua o aire visibles.','BASE',true,true,false,false,'Inspección visual','Sellados y encuentros de ventana sin discontinuidades visibles relevantes.',184,true),
('PLAFON_NIVELACION','ACABADOS','Plafón: nivelación y uniformidad','Revisar planeidad, nivel, ondulaciones, juntas, remates, cambios de plano y uniformidad del acabado con luz rasante cuando sea posible.','BASE',true,true,true,false,'Nivel láser / luz rasante','Plafón con nivelación, planeidad y acabado visualmente uniformes.',102,true),
('ACABADO_UNIFORMIDAD','ACABADOS','Acabados: uniformidad y homogeneidad','Revisar homogeneidad de textura, recubrimientos, juntas, tono, remates, encuentros y continuidad visual entre paños.','BASE',true,true,false,false,'Luz rasante / inspección visual','Acabados visualmente homogéneos y uniformes.',85,true)
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

update "BibliotecaPuntoCerteza"
set "nombre"='Pintura: homogeneidad, tono y cobertura',
    "descripcion"='Revisar homogeneidad de color y brillo, cubrimiento, tono, empalmes, manchas, retoques, escurrimientos, marcas y diferencias visibles entre paños.',
    "actualizadoEn"=now()
where "codigo"='PINTURA';

update "BibliotecaPuntoCerteza"
set "nombre"='Piso: condición general',
    "descripcion"='Revisar daños, manchas, piezas rotas, juntas, remates, transiciones, cambios de material y condición superficial general.',
    "actualizadoEn"=now()
where "codigo"='PISO_ESTADO';

update "BibliotecaPuntoCerteza"
set "nombre"='Plafón / losa interior: condición y acabado',
    "descripcion"='Revisar fisuras, deformaciones, humedad visible, juntas, remates, textura, pintura y condición general del plafón o losa interior.',
    "actualizadoEn"=now()
where "codigo"='PLAFON_LOSA';

with areas as (
  select id
  from "BibliotecaAreaCerteza"
  where "codigo" in (
    'SALA','COMEDOR','ESTANCIA','RECIBIDOR','PASILLO',
    'RECAMARA','RECAMARA_PRINCIPAL','ALCOBA','ESTUDIO',
    'VESTIDOR','COCINA','DESAYUNADOR','BANO_COMPLETO',
    'MEDIO_BANO','LAVANDERIA','CUARTO_SERVICIO','BODEGA',
    'SOTANO','OTRA_AREA'
  )
),
puntos as (
  select id,"codigo","orden"
  from "BibliotecaPuntoCerteza"
  where "codigo" in (
    'PISO_NIVELACION','PISO_CERAMICO','VANO_PUERTA','VANO_VENTANA',
    'SELLADO_PUERTA','SELLADO_VENTANA','PLAFON_NIVELACION',
    'ACABADO_UNIFORMIDAD'
  )
)
insert into "BibliotecaAreaPuntoCerteza"
("areaBibliotecaId","puntoBibliotecaId","obligatorio","orden","configuracion")
select a.id,p.id,true,p."orden",jsonb_build_object('permiteNoAplica',true,'versionPlantilla','V4')
from areas a cross join puntos p
on conflict do nothing;

with areas as (
  select id from "BibliotecaAreaCerteza" where "codigo"='ESCALERA'
),
puntos as (
  select id,"orden" from "BibliotecaPuntoCerteza"
  where "codigo" in (
    'MUROS_ESTADO','MUROS_ACABADO','ACABADO_UNIFORMIDAD','PINTURA',
    'PLAFON_LOSA','PLAFON_NIVELACION','PISO_ESTADO','PISO_NIVELACION',
    'PISO_CERAMICO','INST_UBICACION','INST_ALTURA','INST_ALINEACION',
    'HUMEDAD_VISIBLE'
  )
)
insert into "BibliotecaAreaPuntoCerteza"
("areaBibliotecaId","puntoBibliotecaId","obligatorio","orden","configuracion")
select a.id,p.id,true,p."orden",jsonb_build_object('permiteNoAplica',true,'versionPlantilla','V4')
from areas a cross join puntos p
on conflict do nothing;

commit;
