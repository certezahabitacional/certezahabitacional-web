import bcrypt from "bcryptjs";
import { PrismaClient, RolUsuario } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.CLIENTE_EMAIL?.trim().toLowerCase();
  const password = process.env.CLIENTE_PASSWORD;
  const nombre = process.env.CLIENTE_NOMBRE?.trim();

  if (!email || !password || !nombre) {
    throw new Error(
      "Faltan CLIENTE_EMAIL, CLIENTE_PASSWORD o CLIENTE_NOMBRE en .env.local",
    );
  }

  if (password.length < 8) {
    throw new Error(
      "CLIENTE_PASSWORD debe tener al menos 8 caracteres.",
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const usuario = await prisma.usuario.upsert({
    where: {
      email,
    },
    update: {
      nombre,
      passwordHash,
      rol: RolUsuario.CLIENTE,
      activo: true,
    },
    create: {
      nombre,
      email,
      passwordHash,
      rol: RolUsuario.CLIENTE,
      activo: true,
    },
  });

  const clienteExistente = await prisma.cliente.findUnique({
    where: {
      usuarioId: usuario.id,
    },
  });

  const cliente =
    clienteExistente ??
    (await prisma.cliente.create({
      data: {
        usuarioId: usuario.id,
        nombre,
        correo: email,
      },
    }));

  console.log("Cliente del portal configurado:", {
    usuarioId: usuario.id,
    clienteId: cliente.id,
    email: usuario.email,
    rol: usuario.rol,
    activo: usuario.activo,
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