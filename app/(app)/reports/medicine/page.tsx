import { Suspense } from "react";
import ClientPage from "./__ClientPage";

export default function Page() {
  return (
    <Suspense fallback={<div aria-busy="true" className="p-6" />}>
      <ClientPage />
    </Suspense>
  );
}
