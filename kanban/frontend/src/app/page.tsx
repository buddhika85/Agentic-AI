"use client";

import dynamic from "next/dynamic";

const KanbanBoard = dynamic(() => import("@/components/KanbanBoard").then((mod) => mod.KanbanBoard), {
  ssr: false,
  loading: () => null,
});

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1700px] flex-col p-6 md:p-10">
      <KanbanBoard />
    </main>
  );
}
