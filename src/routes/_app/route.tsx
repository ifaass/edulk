import { createFileRoute } from "@tanstack/react-router";
import { PublicShell } from "@/components/shell";

export const Route = createFileRoute("/_app")({
  component: PublicShell,
});
