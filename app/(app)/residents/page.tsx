import { Suspense } from "react";
import ClientPage from "./__ClientPage";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zinc-500">Kraunama...</div>}>
      <ClientPage />
    </Suspense>
  );
}
