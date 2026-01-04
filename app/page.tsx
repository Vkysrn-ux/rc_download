import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import HomePageClient from "./home-page"

const SESSION_COOKIE_NAME = "rc_app_session"
const ACCEPT_COOKIES_NAME = "rc_cookie_accepted"

export default async function HomePage() {
  const cookieStore = await cookies()
  const hasSessionCookie = Boolean(cookieStore.get(SESSION_COOKIE_NAME)?.value)
  const hasAcceptedCookies = Boolean(cookieStore.get(ACCEPT_COOKIES_NAME)?.value)

  if (hasSessionCookie || hasAcceptedCookies) {
    redirect("/dashboard")
  }

  return <HomePageClient />
}
