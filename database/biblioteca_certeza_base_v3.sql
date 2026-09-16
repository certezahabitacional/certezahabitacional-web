-- Biblioteca Maestra Certeza Habitacional V3
-- Catálogo reusable: la cotización decide qué áreas se instancian en cada inspección.

insert into public."BibliotecaAreaCerteza" ("codigo","nombre","categoria","orden") values
('FACHADA_PRINCIPAL','Fachada principal','EXTERIOR',10),
('SALA','Sala','INTERIOR',20),('COMEDOR','Comedor','INTERIOR',30),('ESTANCIA','Estancia / Family room','INTERIOR',40),
('RECIBIDOR','Vestíbulo / Recibidor','INTERIOR',50),('PASILLO','Pasillo / Circulación','INTERIOR',60),
('RECAMARA','Recámara','INTERIOR',70),('RECAMARA_PRINCIPAL','Recámara principal','INTERIOR',80),('ALCOBA','Alcoba','INTERIOR',90),
('ESTUDIO','Estudio / Oficina','INTERIOR',100),('VESTIDOR','Vestidor','INTERIOR',110),('CLOSET','Clóset','INTERIOR',120),
('COCINA','Cocina','INTERIOR',130),('DESAYUNADOR','Desayunador','INTERIOR',140),
('BANO_COMPLETO','Baño completo','INTERIOR',150),('MEDIO_BANO','Medio baño','INTERIOR',160),
('LAVANDERIA','Cuarto de lavado','INTERIOR',170),('CUARTO_SERVICIO','Cuarto de servicio','INTERIOR',180),('BODEGA','Bodega','INTERIOR',190),
('ESCALERA','Escalera','CIRCULACION',200),('COCHERA','Cochera','EXTERIOR',210),('TERRAZA','Terraza','EXTERIOR',220),
('BALCON','Balcón','EXTERIOR',230),('PATIO','Patio','EXTERIOR',240),('JARDIN','Jardín / Área exterior','EXTERIOR',250),
('AZOTEA','Azotea','EXTERIOR',260),('ROOF_GARDEN','Roof garden','EXTERIOR',270),('SOTANO','Sótano','INTERIOR',280),
('CUARTO_MAQUINAS','Cuarto de máquinas / equipos','TECNICA',290),('CUARTO_INSTALACIONES','Cuarto de instalaciones','TECNICA',300),
('FACHADA_LATERAL','Fachada lateral / posterior','EXTERIOR',310),('ACCESO_PEATONAL','Acceso peatonal','EXTERIOR',320),
('ACCESO_VEHICULAR','Acceso vehicular','EXTERIOR',330),('BARDA','Bardas','EXTERIOR',340),('OTRA_AREA','Otra área','OTRA',999)
on conflict ("codigo") do update set "nombre"=excluded."nombre","categoria"=excluded."categoria","orden"=excluded."orden","activa"=true;

insert into public."BibliotecaPuntoCerteza"
("codigo","grupo","nombre","descripcion","modulo","requiereMedicion","requiereComparacionProyecto","herramientaSugerida","textoSinHallazgo","orden") values
('DIM_LARGO','GEOMETRIA','Largo','Medición del largo del área.','BASE',true,true,'Medidor láser','Dimensión revisada sin diferencias relevantes respecto del alcance disponible.',10),
('DIM_ANCHO','GEOMETRIA','Ancho','Medición del ancho del área.','BASE',true,true,'Medidor láser','Dimensión revisada sin diferencias relevantes respecto del alcance disponible.',20),
('DIM_ALTURA','GEOMETRIA','Altura libre','Medición de altura libre.','BASE',true,true,'Medidor láser','Altura revisada sin diferencias relevantes respecto del alcance disponible.',30),
('NIVELES','GEOMETRIA','Niveles','Revisión de nivel en elementos aplicables.','BASE',true,false,'Nivel láser / nivel digital','Niveles revisados sin anomalías relevantes.',40),
('DESPLOMES','GEOMETRIA','Desplomes y plomos','Revisión de verticalidad de muros, jambas y elementos aplicables.','BASE',false,false,'Nivel láser / nivel digital','No se identificaron desplomes relevantes en los elementos revisados.',50),
('ESCUADRAS','GEOMETRIA','Escuadras y alineamientos','Revisión de geometría y alineamientos apreciables.','BASE',false,false,'Escuadra / láser','Geometría revisada sin anomalías relevantes.',60),
('MUROS_ESTADO','ACABADOS','Muros: condición general','Fisuras, golpes, desprendimientos, manchas o deformaciones visibles.','BASE',false,false,'Inspección visual','Muros revisados sin anomalías relevantes.',70),
('MUROS_ACABADO','ACABADOS','Muros: acabado','Yeso, textura, aparente, recubrimiento y remates.','BASE',false,false,'Luz rasante / inspección visual','Acabados de muros revisados sin anomalías relevantes.',80),
('PINTURA','ACABADOS','Pintura','Uniformidad, cubrimiento, tono, manchas, retoques y escurrimientos.','BASE',false,false,'Luz rasante / inspección visual','Pintura revisada sin anomalías relevantes.',90),
('PLAFON_LOSA','ACABADOS','Plafón / losa interior','Fisuras, desniveles, deformaciones, humedad visible y acabado.','BASE',false,false,'Inspección visual / nivel','Plafón o losa revisado sin anomalías relevantes.',100),
('PISO_ESTADO','PISOS','Piso: condición y nivel','Estado general, nivel, daños, manchas y transiciones.','BASE',true,false,'Nivel láser / regla','Piso revisado sin anomalías relevantes.',110),
('PISO_CERAMICO','PISOS','Piso cerámico: auscultación','Piezas huecas, juntas, boquilla, cortes y piezas dañadas.','CERAMICO',false,false,'Martillo de auscultación','Recubrimiento cerámico revisado sin anomalías relevantes.',120),
('VANOS','VANOS','Vanos','Dimensiones, geometría, nivel, plomo y terminaciones.','BASE',true,true,'Medidor láser / nivel','Vanos revisados sin anomalías relevantes.',130),
('PUERTA_INSTALACION','CARPINTERIA','Puertas: instalación','Plomo, nivel, fijación, holguras y remates.','BASE',false,true,'Nivel / inspección visual','Puertas revisadas sin anomalías relevantes de instalación.',140),
('PUERTA_FUNCION','CARPINTERIA','Puertas: funcionamiento','Apertura, cierre, roce, cerraduras y herrajes.','BASE',false,false,'Prueba funcional','Puertas operadas sin anomalías relevantes.',150),
('VENTANA_INSTALACION','CANCELERIA','Ventanas: instalación','Nivel, plomo, fijación, alineación, vidrio y remates.','BASE',false,true,'Nivel / inspección visual','Ventanas revisadas sin anomalías relevantes de instalación.',160),
('VENTANA_FUNCION','CANCELERIA','Ventanas: funcionamiento','Apertura, cierre, seguros y herrajes.','BASE',false,false,'Prueba funcional','Ventanas operadas sin anomalías relevantes.',170),
('SELLADOS','SELLADOS','Sellados y encuentros','Puertas, ventanas, juntas y encuentros visibles.','BASE',false,false,'Inspección visual','Sellados y encuentros revisados sin anomalías relevantes.',180),
('INST_UBICACION','INSTALACIONES_VISIBLES','Instalaciones visibles: ubicación','Ubicación de contactos, apagadores, salidas hidráulicas, sanitarias, gas, datos u otras.','INSTALACIONES_VISIBLES',true,true,'Medidor láser','Ubicación de salidas y accesorios revisada sin anomalías relevantes.',190),
('INST_ALTURA','INSTALACIONES_VISIBLES','Instalaciones visibles: altura','Altura respecto a piso terminado cuando aplique.','INSTALACIONES_VISIBLES',true,true,'Medidor láser','Alturas de salidas y accesorios revisadas sin anomalías relevantes.',200),
('INST_ALINEACION','INSTALACIONES_VISIBLES','Instalaciones visibles: alineación y nivel','Nivelación, alineación, fijación, placas, tapas y remates.','INSTALACIONES_VISIBLES',false,false,'Nivel / inspección visual','Elementos visibles de instalaciones revisados sin anomalías relevantes.',210),
('INST_INTERFERENCIAS','INSTALACIONES_VISIBLES','Instalaciones visibles: interferencias','Interferencia con muebles, puertas, cubiertas y acabados.','INSTALACIONES_VISIBLES',false,true,'Inspección visual','No se identificaron interferencias relevantes en los elementos revisados.',220),
('HUMEDAD_VISIBLE','CONDICION','Humedad y manchas visibles','Indicios visibles y medición complementaria cuando proceda.','BASE',false,false,'Detector de humedad / cámara térmica','No se identificaron indicios relevantes de humedad en la revisión realizada.',230),
('MUEBLES_COCINA','COCINA','Muebles de cocina','Nivelación, alineación, fijación, puertas, cajones y herrajes.','COCINA',false,true,'Nivel / inspección visual','Mobiliario de cocina revisado sin anomalías relevantes.',300),
('CUBIERTA_COCINA','COCINA','Cubierta de cocina','Nivel, fijación, encuentros, sellados y condición superficial.','COCINA',false,true,'Nivel / inspección visual','Cubierta revisada sin anomalías relevantes.',310),
('TARJA','COCINA','Tarja y sellados','Fijación, sellado, ubicación y terminaciones visibles.','COCINA',false,true,'Inspección visual','Tarja y sellados revisados sin anomalías relevantes.',320),
('LAMBRIN','ZONA_HUMEDA','Lambrines y recubrimientos','Alineación, juntas, piezas, remates y adherencia aparente.','ZONA_HUMEDA',false,false,'Martillo de auscultación / inspección visual','Lambrines revisados sin anomalías relevantes.',330),
('MUEBLES_SANITARIOS','BANO','Muebles sanitarios','Instalación, fijación, nivelación, sellado y terminaciones.','BANO',false,true,'Nivel / inspección visual','Muebles sanitarios revisados sin anomalías relevantes.',340),
('PENDIENTES_HUMEDAS','ZONA_HUMEDA','Pendientes en zonas húmedas','Dirección y comportamiento hacia coladeras.','ZONA_HUMEDA',true,false,'Nivel digital / prueba con agua','Pendientes revisadas sin anomalías relevantes.',350),
('COLADERAS','ZONA_HUMEDA','Coladeras','Ubicación, nivel, remate, fijación y relación con pendientes.','ZONA_HUMEDA',false,true,'Nivel / inspección visual','Coladeras revisadas sin anomalías relevantes.',360),
('ANTIDERRAPANTE','ZONA_HUMEDA','Acabado antiderrapante','Condición y presencia cuando esté especificado.','ZONA_HUMEDA',false,true,'Inspección visual','Acabado revisado sin anomalías relevantes.',370),
('CANCEL_BANO','BANO','Cancelería de baño','Fijación, plomo, funcionamiento, sellados, vidrios y herrajes.','BANO',false,true,'Nivel / inspección visual','Cancelería revisada sin anomalías relevantes.',380),
('CLOSET_CARPINTERIA','CARPINTERIA','Clóset / carpintería fija','Fijación, alineación, puertas, cajones, entrepaños y acabados.','CARPINTERIA',false,true,'Nivel / inspección visual','Carpintería fija revisada sin anomalías relevantes.',390),
('ESC_HUELLA_PERALTE','ESCALERA','Huellas y peraltes','Dimensiones, uniformidad y terminaciones.','ESCALERA',true,true,'Medidor láser / cinta','Escalera revisada sin anomalías relevantes en huellas y peraltes.',400),
('BARANDAL','SEGURIDAD_FISICA','Barandales y pasamanos','Fijación, continuidad, altura, plomo y acabado.','BARANDAL',true,true,'Medidor láser / nivel','Barandal/pasamanos revisado sin anomalías relevantes.',410),
('PENDIENTES_EXTERIOR','EXTERIOR','Pendientes y escurrimientos','Pendientes, desalojo de agua, encuentros y puntos bajos.','EXTERIOR',true,false,'Nivel digital / prueba con agua','Pendientes y escurrimientos revisados sin anomalías relevantes.',420),
('IMPERMEABILIZACION_VISIBLE','EXTERIOR','Impermeabilización visible','Continuidad, traslapes, remates y condición aparente.','EXTERIOR',false,false,'Inspección visual','Impermeabilización visible revisada sin anomalías relevantes.',430),
('PORTON','EXTERIOR','Portón / acceso vehicular','Fijación, guías, funcionamiento, alineación y terminaciones.','EXTERIOR',false,true,'Prueba funcional / nivel','Portón revisado sin anomalías relevantes.',440),
('BARDAS','EXTERIOR','Bardas y pretiles','Plomo, fisuras, acabados, coronamientos, juntas y encuentros.','EXTERIOR',false,false,'Nivel / inspección visual','Bardas o pretiles revisados sin anomalías relevantes.',450)
on conflict ("codigo") do update set "grupo"=excluded."grupo","nombre"=excluded."nombre","descripcion"=excluded."descripcion","modulo"=excluded."modulo","requiereMedicion"=excluded."requiereMedicion","requiereComparacionProyecto"=excluded."requiereComparacionProyecto","herramientaSugerida"=excluded."herramientaSugerida","textoSinHallazgo"=excluded."textoSinHallazgo","orden"=excluded."orden","activa"=true;

-- Plantilla BASE para todas las áreas habitables/interiores y exteriores donde aplique.
insert into public."BibliotecaAreaPuntoCerteza" ("areaBibliotecaId","puntoBibliotecaId","obligatorio","orden")
select a.id,p.id,true,p."orden"
from public."BibliotecaAreaCerteza" a
join public."BibliotecaPuntoCerteza" p on p."modulo" in ('BASE','INSTALACIONES_VISIBLES')
where a."codigo" in ('SALA','COMEDOR','ESTANCIA','RECIBIDOR','PASILLO','RECAMARA','RECAMARA_PRINCIPAL','ALCOBA','ESTUDIO','VESTIDOR','COCINA','DESAYUNADOR','BANO_COMPLETO','MEDIO_BANO','LAVANDERIA','CUARTO_SERVICIO','BODEGA','SOTANO','OTRA_AREA')
on conflict ("areaBibliotecaId","puntoBibliotecaId") do nothing;

-- Módulos especializados.
insert into public."BibliotecaAreaPuntoCerteza" ("areaBibliotecaId","puntoBibliotecaId","obligatorio","orden")
select a.id,p.id,true,p."orden" from public."BibliotecaAreaCerteza" a join public."BibliotecaPuntoCerteza" p on p."modulo"='COCINA'
where a."codigo" in ('COCINA','DESAYUNADOR') on conflict do nothing;
insert into public."BibliotecaAreaPuntoCerteza" ("areaBibliotecaId","puntoBibliotecaId","obligatorio","orden")
select a.id,p.id,true,p."orden" from public."BibliotecaAreaCerteza" a join public."BibliotecaPuntoCerteza" p on p."modulo" in ('BANO','ZONA_HUMEDA')
where a."codigo" in ('BANO_COMPLETO','MEDIO_BANO') on conflict do nothing;
insert into public."BibliotecaAreaPuntoCerteza" ("areaBibliotecaId","puntoBibliotecaId","obligatorio","orden")
select a.id,p.id,true,p."orden" from public."BibliotecaAreaCerteza" a join public."BibliotecaPuntoCerteza" p on p."modulo"='CARPINTERIA'
where a."codigo" in ('RECAMARA','RECAMARA_PRINCIPAL','ALCOBA','VESTIDOR','CLOSET','COCINA') on conflict do nothing;
insert into public."BibliotecaAreaPuntoCerteza" ("areaBibliotecaId","puntoBibliotecaId","obligatorio","orden")
select a.id,p.id,true,p."orden" from public."BibliotecaAreaCerteza" a join public."BibliotecaPuntoCerteza" p on p."modulo"='ESCALERA'
where a."codigo"='ESCALERA' on conflict do nothing;
insert into public."BibliotecaAreaPuntoCerteza" ("areaBibliotecaId","puntoBibliotecaId","obligatorio","orden")
select a.id,p.id,true,p."orden" from public."BibliotecaAreaCerteza" a join public."BibliotecaPuntoCerteza" p on p."modulo"='BARANDAL'
where a."codigo" in ('ESCALERA','BALCON','TERRAZA','ROOF_GARDEN') on conflict do nothing;
insert into public."BibliotecaAreaPuntoCerteza" ("areaBibliotecaId","puntoBibliotecaId","obligatorio","orden")
select a.id,p.id,true,p."orden" from public."BibliotecaAreaCerteza" a join public."BibliotecaPuntoCerteza" p on p."modulo"='EXTERIOR'
where a."codigo" in ('FACHADA_PRINCIPAL','FACHADA_LATERAL','COCHERA','TERRAZA','BALCON','PATIO','JARDIN','AZOTEA','ROOF_GARDEN','ACCESO_PEATONAL','ACCESO_VEHICULAR','BARDA') on conflict do nothing;
