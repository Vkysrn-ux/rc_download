import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import HomePageClient from "./home-page"

const SESSION_COOKIE_NAME = "rc_app_session"

export default async function HomePage() {
  const cookieStore = await cookies()
  const hasSessionCookie = Boolean(cookieStore.get(SESSION_COOKIE_NAME)?.value)

  if (hasSessionCookie) {
    redirect("/dashboard")
  }

  return <HomePageClient />
}
