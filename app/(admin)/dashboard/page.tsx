import { redirect } from "next/navigation";

/**
 * The Control Center replaced the old dashboard with /overview on 2026-09-08.
 * This permanent hop keeps old bookmarks and any cached post-login redirect
 * working.
 */
export default function DashboardRedirect() {
  redirect("/overview");
}
