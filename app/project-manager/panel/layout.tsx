import { requireProjectManagerAccess } from "@/lib/project-manager/access";

export default async function ProjectManagerPanelLayout({ children }: { children: React.ReactNode }) {
  await requireProjectManagerAccess();
  return children;
}
