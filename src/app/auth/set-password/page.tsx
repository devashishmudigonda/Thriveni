import type { Metadata } from "next";
import SetPasswordPortal from "@/components/SetPasswordPortal";

export const metadata: Metadata = {
  title: "Set password · Lloyds/Thriveni Survey Portal",
  description: "Set your password for the survey administrator account.",
};

export default function SetPasswordPage() {
  return <SetPasswordPortal />;
}
