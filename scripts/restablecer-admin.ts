import bcrypt from "bcryptjs";
import { PrismaClient, RolUsuario } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email) {
    throw new Error("Falta ADMIN_EMAIL en .env.local");
  }

  if (!password || password.length < 8) {
    throw new Error(
      "ADMIN_PASSWORD debe tener al menos 8 caracteres.",
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const usuario = await prisma.usuario.update({
    where: {
      email,
    },
    data: {
      passwordHash,
      activo: true,
      rol: RolUsuario.ADMINISTRADOR,
    },
    select: {
      id: true,
      nombre: true,
      email: true,
      rol: true,
      activo: true,
    },
  });

  console.log("Administrador restablecido correctamente:");
  console.table([usuario]);
}

main()
  .catch((error) => {
    console.error("No se pudo restablecer el administrador:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });