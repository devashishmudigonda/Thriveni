import type { Metadata } from "next";
import AdminPortal from "@/components/AdminPortal";

export const metadata: Metadata = {
  title: "Admin dashboard · Lloyds/Thriveni Survey Portal",
  description: "Securely review survey responses.",
};

export default function AdminPage() {
  return <AdminPortal />;
}
