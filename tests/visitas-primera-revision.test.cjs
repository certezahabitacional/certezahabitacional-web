const test = require("node:test");
const assert = require("node:assert/strict");

function elegible({ estadoV3, motivoNoAplica, yaRegistrado }) {
  return estadoV3 === "NO_APLICA" &&
    typeof motivoNoAplica === "string" &&
    motivoNoAplica.startsWith("[PARTIDA_COMPLETA:") &&
    !yaRegistrado;
}

test("solo conceptos no inspeccionados por partida completa quedan disponibles", () => {
  assert.equal(elegible({estadoV3:"NO_APLICA", motivoNoAplica:"[PARTIDA_COMPLETA:SIN_ACCESO] sin acceso", yaRegistrado:false}), true);
  assert.equal(elegible({estadoV3:"NO_APLICA", motivoNoAplica:"No aplica por diseño", yaRegistrado:false}), false);
  assert.equal(elegible({estadoV3:"REVISADO", motivoNoAplica:"[PARTIDA_COMPLETA:SIN_ACCESO] sin acceso", yaRegistrado:false}), false);
  assert.equal(elegible({estadoV3:"NO_APLICA", motivoNoAplica:"[PARTIDA_COMPLETA:SIN_ACCESO] sin acceso", yaRegistrado:true}), false);
});

test("primera revision sin hallazgo no inventa hallazgo", () => {
  const resultado = "SIN_HALLAZGO";
  const item = {
    estadoV3: resultado === "SIN_HALLAZGO" ? "REVISADO" : "PENDIENTE",
    completado: resultado === "SIN_HALLAZGO",
    creaHallazgo: false,
  };
  assert.deepEqual(item, { estadoV3: "REVISADO", completado: true, creaHallazgo: false });
});

test("primera revision con hallazgo queda pendiente hasta enlazar el hallazgo", () => {
  const resultado = "CON_HALLAZGO";
  const item = {
    estadoV3: resultado === "SIN_HALLAZGO" ? "REVISADO" : "PENDIENTE",
    completado: resultado === "SIN_HALLAZGO",
  };
  assert.deepEqual(item, { estadoV3: "PENDIENTE", completado: false });
});
