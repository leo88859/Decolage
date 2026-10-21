"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Builder, isStep } from "@/components/builder/Builder";
import { ProjectMissing } from "@/components/project/ProjectMissing";
import { useData, useHydrated } from "@/lib/store";

export default function ConstructeurPage() {
  return (
    <Suspense fallback={<div className="skeleton" style={{ height: "100vh", borderRadius: 0 }} />}>
      <Constructeur />
    </Suspense>
  );
}

function Constructeur() {
  const { id } = useParams<{ id: string }>();
  // ?etape=type|design|perso|fonctions|verif : ouvre le constructeur directement à une étape.
  const etape = useSearchParams().get("etape");
  const project = useData().projects.find((p) => p.id === id);
  const hydrated = useHydrated();
  if (!hydrated) return <div className="skeleton" style={{ height: "100vh", borderRadius: 0 }} />;
  if (!project) return <ProjectMissing />;
  return <Builder key={project.id} project={project} initialStep={isStep(etape) ? etape : "perso"} />;
}
