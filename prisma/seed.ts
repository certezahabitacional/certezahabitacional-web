import { PrismaClient, RolUsuario } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function obtenerVariableObligatoria(nombre: string): string {
  const valor = process.env[nombre]?.trim();

  if (!valor) {
    throw new Error(
      `Falta la variable de entorno ${nombre}. Agrégala al archivo .env antes de ejecutar el seed.`
    );
  }

  return valor;
}

async function prepararUsuario({
  nombre,
  email,
  password,
  rol,
}: {
  nombre: string;
  email: string;
  password: string;
  rol: RolUsuario;
}) {
  const emailNormalizado = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.usuario.upsert({
    where: {
      email: emailNormalizado,
    },
    update: {
      nombre,
      passwordHash,
      rol,
      activo: true,
    },
    create: {
      nombre,
      email: emailNormalizado,
      passwordHash,
      rol,
      activo: true,
    },
  });

  console.log(`✓ ${rol} preparado: ${emailNormalizado}`);
}

async function main() {
  console.log("Preparando usuarios iniciales...");
  console.log("");

  const adminEmail = obtenerVariableObligatoria("ADMIN_EMAIL");
  const adminPassword = obtenerVariableObligatoria("ADMIN_PASSWORD");

  const coordinadorEmail = obtenerVariableObligatoria("COORDINADOR_EMAIL");
  const coordinadorPassword = obtenerVariableObligatoria(
    "COORDINADOR_PASSWORD"
  );

  await prepararUsuario({
    nombre: "Administrador Certeza",
    email: adminEmail,
    password: adminPassword,
    rol: RolUsuario.ADMINISTRADOR,
  });

  await prepararUsuario({
    nombre: "Coordinador Certeza",
    email: coordinadorEmail,
    password: coordinadorPassword,
    rol: RolUsuario.COORDINADOR,
  });

  console.log("");
  console.log("✓ Seed completado correctamente.");
}

main()
  .catch((error) => {
    console.error("");
    console.error("Error ejecutando el seed:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });