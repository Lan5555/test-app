import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { blueprintName } from "@/features/blueprint/config";
import Studio from "@/features/blueprint/ui/studio";
import "@/features/blueprint/ui/studio.css";

export const metadata: Metadata = { title: `${blueprintName} | Lan’s Hub` };

const sections = new Set([
  "",
  "projects",
  "learn",
  "assignments",
  "templates",
  "docs",
  "automation",
]);
const projectIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export default async function Page({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section: parts = [] } = await params;
  const [section = "", projectId] = parts;
  if (
    section === "editor" &&
    parts.length === 2 &&
    projectIdPattern.test(projectId)
  )
    return <Studio key={projectId} section={section} projectId={projectId} />;
  if (parts.length <= 1 && sections.has(section))
    return <Studio section={section} />;
  notFound();
}
