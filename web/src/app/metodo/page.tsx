import type { Metadata } from "next";
import MethodView from "@/components/site/MethodView";

export const metadata: Metadata = {
  title: "Método — Parallax",
  description: "How Parallax picks Earth twins for the Moon and Mars: the measure, blind validations, pre-registered extensions and limits.",
};

export default function Method() {
  return <MethodView />;
}
