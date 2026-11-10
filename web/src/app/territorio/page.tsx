import type { Metadata } from "next";
import TerritoryView from "@/components/site/TerritoryView";

export const metadata: Metadata = {
  title: "Regiones — Parallax",
  description: "An area's lunar and Martian analog profile, ranked against all of Earth's measured terrain, with a printable sheet.",
};

export default function Territory() {
  return <TerritoryView />;
}
