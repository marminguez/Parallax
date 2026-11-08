import type { Metadata } from "next";
import CampaignSheet from "@/components/site/CampaignSheet";

export const metadata: Metadata = {
  title: "Ficha de campaña — Parallax",
  description: "A printable campaign sheet for one Earth twin: what it can rehearse, how to get there, when to go, where to sleep and what to check in the field.",
};

export default function CampaignSheetPage() {
  return <CampaignSheet />;
}
