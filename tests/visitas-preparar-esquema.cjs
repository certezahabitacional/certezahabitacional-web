const fs = require('node:fs');
const path = require('node:path');
const target = path.resolve(process.argv[2] || '');
const base = process.env.RUNNER_TEMP && path.resolve(process.env.RUNNER_TEMP, 'visitas-ci');
if (!base || target !== path.join(base, 'prisma', 'schema.prisma')) {
  throw new Error('Solo se permite preparar la copia efimera en RUNNER_TEMP/visitas-ci.');
}
const original = fs.readFileSync(target, 'utf8');
const marker = `dbgenerated("('CH-CLI-'`;
const fixed = `dbgenerated("(('CH-CLI-'`;
if (original.split(marker).length !== 2) {
  throw new Error('El DEFAULT del folio cambio. Revisar el bootstrap antes de continuar.');
}
// Falta un parentesis exterior en el DEFAULT exportado de Cliente.folio.
// No modifica el schema del repositorio ni bases remotas: solo esta copia de CI.
fs.writeFileSync(target, original.replace(marker, fixed));
console.log('Normalizado un parentesis de Cliente.folio en la copia efimera de CI.');
