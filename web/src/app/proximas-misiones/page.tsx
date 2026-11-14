import type { Metadata } from "next";
import UpcomingView from "@/components/site/UpcomingView";

export const metadata: Metadata = {
  title: "Upcoming missions — Parallax",
  description: "What NASA's Moon Base programme sends to the lunar south pole next, and where on Earth to rehearse each mission.",
};

export default function Upcoming() {
  return <UpcomingView />;
}
