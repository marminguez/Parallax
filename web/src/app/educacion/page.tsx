import type { Metadata } from "next";
import EducationView from "@/components/site/EducationView";

export const metadata: Metadata = {
  title: "Educación — Parallax",
  description: "Teach the Moon and Mars locally: your city's twins, the nearest lunar field trip, classroom activities and a screen mode for museums.",
};

export default function Education() {
  return <EducationView />;
}
