import type { Metadata } from "next";
import MissionsView from "@/components/site/MissionsView";

export const metadata: Metadata = {
  title: "Misiones — Parallax",
  description: "Where to rehearse on Earth for the Artemis III regions and Mars landing sites, from NASA terrain data.",
};

export default function Missions() {
  return <MissionsView />;
}
