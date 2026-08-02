import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL
    ?.trim()
    .toLowerCase();

  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Faltan ADMIN_EMAIL o ADMIN_PASSWORD en .env.local",
    );
  }

  const usuario = await prisma.usuario.findUnique({
    where: {
      email,
    },
    select: {
      email: true,
      passwordHash: true,
      activo: true,
      rol: true,
    },
  });

  if (!usuario) {
    throw new Error("Usuario no encontrado");
  }

  const coincide = await bcrypt.compare(
    password,
    usuario.passwordHash,
  );

  console.log({
    email: usuario.email,
    activo: usuario.activo,
    rol: usuario.rol,
    passwordLength: password.length,
    coincide,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });