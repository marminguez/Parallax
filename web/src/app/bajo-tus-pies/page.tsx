import type { Metadata } from "next";
import Underfoot from "@/components/parallax/Underfoot";

export const metadata: Metadata = {
  title: "¿Qué Luna tienes bajo los pies? — PARALLAX",
  description: "Your terrain's twin on the Moon and on Mars, from NASA data. The reverse map (VAL-004).",
};

export default function UnderfootPage() {
  return <Underfoot />;
}
