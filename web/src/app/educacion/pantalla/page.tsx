import type { Metadata } from "next";
import KioskView from "@/components/site/KioskView";

export const metadata: Metadata = {
  title: "¿Qué Luna tienes bajo los pies? — Parallax",
  description: "Screen mode for museums and planetariums.",
};

export default function Kiosk() {
  return <KioskView />;
}
