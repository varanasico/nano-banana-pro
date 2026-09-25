import { Suspense } from "react";
import { Workspace } from "@/components/Workspace";

export default function WorkspacePage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">Načítám…</p>}>
      <Workspace />
    </Suspense>
  );
}
