import { redirect } from "next/navigation";

/** Keep the old URL working for bookmarks while exposing canonical auth routes. */
export default function LegacyAuthRoute() {
  redirect("/login");
}
