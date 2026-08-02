import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const credencialesSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
});

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
          credencialesSchema.safeParse(credentials);

        if (!resultado.success) {
          return null;
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
            },
          });

        if (!usuario?.activo) {
          return null;
        }

        const passwordValido =
          await bcrypt.compare(
            resultado.data.password,
            usuario.passwordHash,
          );

        if (!passwordValido) {
          return null;
        }

        await prisma.usuario.update({
          where: {
            id: usuario.id,
          },

          data: {
            ultimoAcceso: new Date(),
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