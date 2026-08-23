import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const MAX_INTENTOS_FALLIDOS = 5;
const MINUTOS_BLOQUEO = 15;

const credencialesSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
});

class CuentaBloqueadaError extends CredentialsSignin {
  code = "cuenta_bloqueada";
}

class CredencialesInvalidasError extends CredentialsSignin {
  code = "credenciales_invalidas";
}

export const {
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,

  session: {
    strategy: "jwt",
  },

  pages: {
    signIn: "/login",
  },

  providers: [
    Credentials({
      name: "Credenciales",

      credentials: {
        email: {
          label: "Correo",
          type: "email",
        },

        password: {
          label: "Contraseña",
          type: "password",
        },
      },

      async authorize(credentials) {
        const resultado =
          credencialesSchema.safeParse(
            credentials,
          );

        if (!resultado.success) {
          throw new CredencialesInvalidasError();
        }

        const email =
          resultado.data.email.toLowerCase();

        const usuario =
          await prisma.usuario.findUnique({
            where: {
              email,
            },

            select: {
              id: true,
              nombre: true,
              email: true,
              passwordHash: true,
              rol: true,
              activo: true,
              ultimoAcceso: true,
              intentosFallidos: true,
              bloqueadoHasta: true,
              ultimoFalloLogin: true,
            },
          });

        /*
         * No revelamos si el correo existe o si la cuenta
         * está desactivada. Para ambos casos se devuelve el
         * mismo tipo de error de credenciales.
         */
        if (!usuario?.activo) {
          throw new CredencialesInvalidasError();
        }

        const ahora = new Date();

        /*
         * Si el bloqueo sigue vigente, ni siquiera se compara
         * la contraseña. El control está en backend y no puede
         * evitarse recargando el navegador o cambiando de equipo.
         */
        if (
          usuario.bloqueadoHasta &&
          usuario.bloqueadoHasta.getTime() >
            ahora.getTime()
        ) {
          throw new CuentaBloqueadaError();
        }

        /*
         * Si el bloqueo ya venció, reiniciamos el ciclo para que
         * el usuario vuelva a disponer de hasta 5 intentos.
         */
        let intentosActuales =
          usuario.intentosFallidos;

        if (
          usuario.bloqueadoHasta &&
          usuario.bloqueadoHasta.getTime() <=
            ahora.getTime()
        ) {
          await prisma.usuario.update({
            where: {
              id: usuario.id,
            },

            data: {
              intentosFallidos: 0,
              bloqueadoHasta: null,
            },
          });

          intentosActuales = 0;
        }

        const passwordValido =
          await bcrypt.compare(
            resultado.data.password,
            usuario.passwordHash,
          );

        if (!passwordValido) {
          const nuevosIntentos =
            intentosActuales + 1;

          const debeBloquear =
            nuevosIntentos >=
            MAX_INTENTOS_FALLIDOS;

          const bloqueadoHasta =
            debeBloquear
              ? new Date(
                  ahora.getTime() +
                    MINUTOS_BLOQUEO *
                      60 *
                      1000,
                )
              : null;

          await prisma.usuario.update({
            where: {
              id: usuario.id,
            },

            data: {
              intentosFallidos:
                debeBloquear
                  ? MAX_INTENTOS_FALLIDOS
                  : nuevosIntentos,
              bloqueadoHasta,
              ultimoFalloLogin: ahora,
            },
          });

          if (debeBloquear) {
            throw new CuentaBloqueadaError();
          }

          throw new CredencialesInvalidasError();
        }

        /*
         * Acceso correcto:
         * - registra último acceso
         * - reinicia intentos
         * - elimina cualquier bloqueo previo
         */
        await prisma.usuario.update({
          where: {
            id: usuario.id,
          },

          data: {
            ultimoAcceso: ahora,
            intentosFallidos: 0,
            bloqueadoHasta: null,
            ultimoFalloLogin: null,
          },
        });

        return {
          id: usuario.id,
          name: usuario.nombre,
          email: usuario.email,
          role: usuario.rol,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(
          token.id ?? token.sub ?? "",
        );

        session.user.role = String(
          token.role ?? "",
        );
      }

      return session;
    },
  },
});