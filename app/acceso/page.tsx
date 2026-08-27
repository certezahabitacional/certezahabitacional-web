import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function AccesoPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  switch (session.user.role) {
    case "CLIENTE":
      redirect("/portal");

    case "INSPECTOR":
      redirect("/inspector");

    case "DIRECTOR":
    case "ADMINISTRADOR":
    case "GERENTE":
    case "COORDINADOR":
      redirect("/panel");

    default:
      redirect("/login");
  }
}
