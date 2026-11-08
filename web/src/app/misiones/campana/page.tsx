import type { Metadata } from "next";
import CampaignView from "@/components/site/CampaignView";

export const metadata: Metadata = {
  title: "Planificar una campaña — Parallax",
  description: "For each Moon and Mars destination, the closest strong Earth twin within 100 km of an airport with scheduled flights, and ten distinct sites to choose from.",
};

export default function Campaign() {
  return <CampaignView />;
}
