import type { ReactNode } from "react";
import { requireProjectAccess } from "@/lib/project-manager/access";

export default async function LegacyPr0002Guard({ children }:{ children:ReactNode }) {
  await requireProjectAccess("PR-0002");
  return children;
}
