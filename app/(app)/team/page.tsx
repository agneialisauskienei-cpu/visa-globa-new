import { Suspense } from "react";
import TeamClient from "./TeamClient";

export default function TeamPage() {
  return (
    <Suspense fallback={<div aria-busy="true" className="p-6" />}>
      <TeamClient />
    </Suspense>
  );
}
