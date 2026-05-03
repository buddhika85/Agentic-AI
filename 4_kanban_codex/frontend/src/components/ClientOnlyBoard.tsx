"use client";

import dynamic from "next/dynamic";

export const ClientOnlyBoard = dynamic(
  () => import("./KanbanBoard").then((module) => module.KanbanBoard),
  {
    ssr: false
  }
);

