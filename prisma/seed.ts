import { PrismaClient, RolUsuario } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

console.log("ADMIN_EMAIL:", process.env.ADMIN_EMAIL);
console.log("ADMIN_PASSWORD cargada:", Boolean(process.env.ADMIN_PASSWORD));

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@certezahabitacional.mx").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "Cambiar123!";
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.usuario.upsert({
    where: { email },
    update: {
      nombre: "Administrador Certeza",
      passwordHash,
      rol: RolUsuario.ADMINISTRADOR,
      activo: true,
    },
    create: {
      nombre: "Administrador Certeza",
      email,
      passwordHash,
      rol: RolUsuario.ADMINISTRADOR,
      activo: true,
    },
  });

  console.log(`Administrador preparado: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
