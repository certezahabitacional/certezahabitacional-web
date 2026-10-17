// Catálogo base de Dirección, actualizado en octubre de 2026. Se utiliza para próximas inspecciones;
// no migrar ni sobrescribir evidencias y conceptos de inspecciones existentes.
export type SubpartidaCatalogo = { nombre: string; conceptos: readonly string[] };
export type PartidaCatalogo = { orden: number; nombre: string; subpartidas: readonly SubpartidaCatalogo[] };

export const CATALOGO_16_PARTIDAS: readonly PartidaCatalogo[] = [
  {
    "orden": 1,
    "nombre": "Pruebas de hermeticidad",
    "subpartidas": [
      {
        "nombre": "Instalación hidráulica",
        "conceptos": [
          "Lectura inicial y foto",
          "Lectura final y foto",
          "Interpretación"
        ]
      },
      {
        "nombre": "Instalación de gas",
        "conceptos": [
          "Lectura inicial y foto",
          "Lectura final y foto",
          "Interpretación"
        ]
      },
      {
        "nombre": "Murete eléctrico",
        "conceptos": [
          "Cableado",
          "Térmicos",
          "Tierra física"
        ]
      },
      {
        "nombre": "Centro de carga",
        "conceptos": [
          "Cableado",
          "Térmicos"
        ]
      },
      {
        "nombre": "Registro de voz y datos",
        "conceptos": [
          "Guiado"
        ]
      },
      {
        "nombre": "Registro de llave de control general hidráulico",
        "conceptos": [
          "Control general",
          "Medidor"
        ]
      },
      {
        "nombre": "Registro o tapón sanitario",
        "conceptos": [
          "Limpieza",
          "Tapón"
        ]
      }
    ]
  },
  {
    "orden": 2,
    "nombre": "Fachadas",
    "subpartidas": [
      {
        "nombre": "Fachada frontal",
        "conceptos": [
          "Desplomes y plomos",
          "Escuadras y alineamientos",
          "Muros: condición general",
          "Acabados: uniformidad y homogeneidad",
          "Pintura: homogeneidad, tono y cobertura",
          "Molduras, cornisas y remates",
          "Rodapié",
          "Instalaciones visibles"
        ]
      },
      {
        "nombre": "Fachada lateral izquierda",
        "conceptos": [
          "Desplomes y plomos",
          "Escuadras y alineamientos",
          "Muros: condición general",
          "Acabados: uniformidad y homogeneidad",
          "Pintura: homogeneidad, tono y cobertura",
          "Molduras, cornisas y remates",
          "Rodapié",
          "Instalaciones visibles"
        ]
      },
      {
        "nombre": "Fachada lateral derecha",
        "conceptos": [
          "Desplomes y plomos",
          "Escuadras y alineamientos",
          "Muros: condición general",
          "Acabados: uniformidad y homogeneidad",
          "Pintura: homogeneidad, tono y cobertura",
          "Molduras, cornisas y remates",
          "Rodapié",
          "Instalaciones visibles"
        ]
      },
      {
        "nombre": "Fachada posterior",
        "conceptos": [
          "Desplomes y plomos",
          "Escuadras y alineamientos",
          "Muros: condición general",
          "Acabados: uniformidad y homogeneidad",
          "Pintura: homogeneidad, tono y cobertura",
          "Molduras, cornisas y remates",
          "Rodapié",
          "Instalaciones visibles"
        ]
      }
    ]
  },
  {
    "orden": 3,
    "nombre": "Sala",
    "subpartidas": [
      {
        "nombre": "Sala",
        "conceptos": [
          "Desplomes",
          "Escuadras y alineamientos",
          "Muros: condición general",
          "Acabados: uniformidad y homogeneidad",
          "Pintura: homogeneidad, tono y cobertura",
          "Plafón / losa interior: condición y acabado",
          "Pisos y zoclos: condición general",
          "Vano de puerta",
          "Vano de ventana",
          "Puertas: instalación, funcionamiento y sellados",
          "Ventanas: instalación, funcionamiento y sellados",
          "Instalaciones eléctricas",
          "Ductos y rejillas",
          "Humedad y manchas visibles"
        ]
      }
    ]
  },
  {
    "orden": 4,
    "nombre": "Comedor",
    "subpartidas": [
      {
        "nombre": "Comedor",
        "conceptos": [
          "Desplomes",
          "Escuadras y alineamientos",
          "Muros: condición general",
          "Acabados: uniformidad y homogeneidad",
          "Pintura: homogeneidad, tono y cobertura",
          "Plafón / losa interior: condición y acabado",
          "Pisos y zoclos: condición general",
          "Vano de puerta",
          "Vano de ventana",
          "Puertas: instalación, funcionamiento y sellados",
          "Ventanas: instalación, funcionamiento y sellados",
          "Instalaciones eléctricas",
          "Ductos y rejillas",
          "Humedad y manchas visibles"
        ]
      }
    ]
  },
  {
    "orden": 5,
    "nombre": "Cocina",
    "subpartidas": [
      {
        "nombre": "Cocina",
        "conceptos": [
          "Desplomes",
          "Escuadras y alineamientos",
          "Muros: condición general",
          "Acabados: uniformidad y homogeneidad",
          "Pintura: homogeneidad, tono y cobertura",
          "Plafón / losa interior: condición y acabado",
          "Pisos y zoclos: condición general",
          "Vano de puerta",
          "Vano de ventana",
          "Puertas: instalación, funcionamiento y sellados",
          "Ventanas: instalación, funcionamiento y sellados",
          "Muebles de cocina",
          "Instalación hidráulica",
          "Instalación de gas",
          "Instalaciones eléctricas",
          "Ductos y rejillas",
          "Humedad y manchas visibles"
        ]
      }
    ]
  },
  {
    "orden": 6,
    "nombre": "Recámara 1",
    "subpartidas": [
      {
        "nombre": "Recámara 1",
        "conceptos": [
          "Desplomes",
          "Escuadras y alineamientos",
          "Muros: condición general",
          "Acabados: uniformidad y homogeneidad",
          "Pintura: homogeneidad, tono y cobertura",
          "Plafón / losa interior: condición y acabado",
          "Pisos y zoclos: condición general",
          "Vano de puerta",
          "Vano de ventana",
          "Puertas: instalación, funcionamiento y sellados",
          "Ventanas: instalación, funcionamiento y sellados",
          "Instalaciones eléctricas",
          "Ductos y rejillas",
          "Humedad y manchas visibles"
        ]
      }
    ]
  },
  {
    "orden": 7,
    "nombre": "Recámara 2",
    "subpartidas": [
      {
        "nombre": "Recámara 2",
        "conceptos": [
          "Desplomes",
          "Escuadras y alineamientos",
          "Muros: condición general",
          "Acabados: uniformidad y homogeneidad",
          "Pintura: homogeneidad, tono y cobertura",
          "Plafón / losa interior: condición y acabado",
          "Pisos y zoclos: condición general",
          "Vano de puerta",
          "Vano de ventana",
          "Puertas: instalación, funcionamiento y sellados",
          "Ventanas: instalación, funcionamiento y sellados",
          "Instalaciones eléctricas",
          "Ductos y rejillas",
          "Humedad y manchas visibles"
        ]
      }
    ]
  },
  {
    "orden": 8,
    "nombre": "Recámara 3",
    "subpartidas": [
      {
        "nombre": "Recámara 3",
        "conceptos": [
          "Desplomes",
          "Escuadras y alineamientos",
          "Muros: condición general",
          "Acabados: uniformidad y homogeneidad",
          "Pintura: homogeneidad, tono y cobertura",
          "Plafón / losa interior: condición y acabado",
          "Pisos y zoclos: condición general",
          "Vano de puerta",
          "Vano de ventana",
          "Puertas: instalación, funcionamiento y sellados",
          "Ventanas: instalación, funcionamiento y sellados",
          "Instalaciones eléctricas",
          "Ductos y rejillas",
          "Humedad y manchas visibles"
        ]
      }
    ]
  },
  {
    "orden": 9,
    "nombre": "Baño completo 1",
    "subpartidas": [
      {
        "nombre": "Baño completo 1",
        "conceptos": [
          "Desplomes",
          "Escuadras y alineamientos",
          "Muros: condición general",
          "Acabados: uniformidad y homogeneidad",
          "Pintura: homogeneidad, tono y cobertura",
          "Plafón / losa interior: condición y acabado",
          "Pisos y zoclos: condición general",
          "Lambrín: condición general",
          "Antiderrapante: condición general",
          "Vano de puerta",
          "Vano de ventana",
          "Puertas: instalación, funcionamiento y sellados",
          "Ventanas: instalación, funcionamiento y sellados",
          "Instalación hidráulica",
          "Ventila",
          "Muebles sanitarios",
          "Accesorios de baño y regadera",
          "Instalaciones eléctricas",
          "Ductos y rejillas",
          "Humedad y manchas visibles"
        ]
      }
    ]
  },
  {
    "orden": 10,
    "nombre": "Baño completo 2",
    "subpartidas": [
      {
        "nombre": "Baño completo 2",
        "conceptos": [
          "Desplomes",
          "Escuadras y alineamientos",
          "Muros: condición general",
          "Acabados: uniformidad y homogeneidad",
          "Pintura: homogeneidad, tono y cobertura",
          "Plafón / losa interior: condición y acabado",
          "Pisos y zoclos: condición general",
          "Lambrín: condición general",
          "Antiderrapante: condición general",
          "Vano de puerta",
          "Vano de ventana",
          "Puertas: instalación, funcionamiento y sellados",
          "Ventanas: instalación, funcionamiento y sellados",
          "Instalación hidráulica",
          "Ventila",
          "Muebles sanitarios",
          "Accesorios de baño y regadera",
          "Instalaciones eléctricas",
          "Ductos y rejillas",
          "Humedad y manchas visibles"
        ]
      }
    ]
  },
  {
    "orden": 11,
    "nombre": "Medio baño",
    "subpartidas": [
      {
        "nombre": "Medio baño",
        "conceptos": [
          "Desplomes",
          "Escuadras y alineamientos",
          "Muros: condición general",
          "Acabados: uniformidad y homogeneidad",
          "Pintura: homogeneidad, tono y cobertura",
          "Plafón / losa interior: condición y acabado",
          "Pisos y zoclos: condición general",
          "Vano de puerta",
          "Vano de ventana",
          "Puertas: instalación, funcionamiento y sellados",
          "Ventanas: instalación, funcionamiento y sellados",
          "Instalación hidráulica",
          "Ventila",
          "Muebles sanitarios",
          "Accesorios de baño",
          "Instalaciones eléctricas",
          "Ductos y rejillas",
          "Humedad y manchas visibles"
        ]
      }
    ]
  },
  {
    "orden": 12,
    "nombre": "Escalera a planta alta",
    "subpartidas": [
      {
        "nombre": "Escalera a planta alta",
        "conceptos": [
          "Desplomes",
          "Escuadras y alineamientos",
          "Muros: condición general",
          "Acabados: uniformidad y homogeneidad",
          "Pintura: homogeneidad, tono y cobertura",
          "Plafón / losa interior: condición y acabado",
          "Pisos y zoclos: condición general",
          "Huellas y peraltes",
          "Vano de ventana",
          "Ventanas: instalación, funcionamiento y sellados",
          "Instalaciones eléctricas",
          "Ductos y rejillas",
          "Humedad y manchas visibles"
        ]
      }
    ]
  },
  {
    "orden": 13,
    "nombre": "Distribuidor de planta alta",
    "subpartidas": [
      {
        "nombre": "Distribuidor de planta alta",
        "conceptos": [
          "Desplomes",
          "Escuadras y alineamientos",
          "Muros: condición general",
          "Acabados: uniformidad y homogeneidad",
          "Pintura: homogeneidad, tono y cobertura",
          "Plafón / losa interior: condición y acabado",
          "Pisos y zoclos: condición general",
          "Instalaciones eléctricas",
          "Ductos y rejillas",
          "Humedad y manchas visibles"
        ]
      }
    ]
  },
  {
    "orden": 14,
    "nombre": "Área de lavado",
    "subpartidas": [
      {
        "nombre": "Área de lavado",
        "conceptos": [
          "Desplomes",
          "Escuadras y alineamientos",
          "Muros: condición general",
          "Acabados: uniformidad y homogeneidad",
          "Pintura: homogeneidad, tono y cobertura",
          "Plafón / losa interior: condición y acabado",
          "Pisos y zoclos: condición general",
          "Vano de puerta",
          "Vano de ventana",
          "Puertas: instalación, funcionamiento y sellados",
          "Ventanas: instalación, funcionamiento y sellados",
          "Instalaciones eléctricas",
          "Instalación hidráulica",
          "Instalación de gas",
          "Salida de monóxido",
          "Ductos y rejillas",
          "Humedad y manchas visibles"
        ]
      }
    ]
  },
  {
    "orden": 15,
    "nombre": "Patio trasero",
    "subpartidas": [
      {
        "nombre": "Patio trasero",
        "conceptos": [
          "Pendientes y escurrimientos",
          "Registros o tapones registro",
          "Banquetas",
          "Drenaje pluvial",
          "Bardas"
        ]
      }
    ]
  },
  {
    "orden": 16,
    "nombre": "Patio frontal",
    "subpartidas": [
      {
        "nombre": "Patio frontal",
        "conceptos": [
          "Pendientes y escurrimientos",
          "Huellas de cochera y banquetas",
          "Registros o tapones registro",
          "Drenaje pluvial",
          "Bardas"
        ]
      }
    ]
  },
  {
    "orden": 17,
    "nombre": "Losa de Azotea",
    "subpartidas": [
      {
        "nombre": "Losa de Azotea",
        "conceptos": [
          "Impermeabilización",
          "Escurrimiento",
          "Chaflanes",
          "Diamantes",
          "Pretiles",
          "Remates",
          "Goterones",
          "Limpieza"
        ]
      }
    ]
  }

] as const;
