"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export async function iniciarSesion(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "/panel");
  const destinoSeguro = callbackUrl.startsWith("/") ? callbackUrl : "/panel";

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: destinoSeguro,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const codigo = error.type === "CredentialsSignin" ? "credenciales" : "auth";
      return { error: codigo };
    }
    throw error;
  }

  return { error: "auth" };
}
