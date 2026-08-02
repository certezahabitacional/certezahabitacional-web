import { PrismaClient, RolUsuario } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = String(process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD ?? "");

  if (!email) throw new Error("Falta ADMIN_EMAIL en .env.local");
  if (password.length < 8) throw new Error("ADMIN_PASSWORD debe tener al menos 8 caracteres");

  const passwordHash = await bcrypt.hash(password, 12);

  const usuario = await prisma.usuario.upsert({
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

  const verificada = await bcrypt.compare(password, usuario.passwordHash);
  if (!verificada) throw new Error("No se pudo verificar la contraseña actualizada");

  console.log("REPARACION_CORRECTA");
  console.log(`Administrador: ${usuario.email}`);
  console.log("Contraseña sincronizada y verificada: SI");
}

main()
  .catch((error) => {
    console.error("REPARACION_FALLIDA");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
