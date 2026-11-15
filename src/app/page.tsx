import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { staffHome } from "@/services/auth";
export default async function Home() {
  const user = await readSession();
  redirect(user ? staffHome(user.role) : "/login");
}

