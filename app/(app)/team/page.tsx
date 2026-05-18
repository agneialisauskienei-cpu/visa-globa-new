import { Suspense } from "react";
import TeamClient from "./TeamClient";

export default function TeamPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zinc-500">Kraunama...</div>}>
      <TeamClient />
    </Suspense>
  );
}
