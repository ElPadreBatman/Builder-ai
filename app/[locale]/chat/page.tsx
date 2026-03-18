import { redirect } from "next/navigation"

// Temporarily redirect to the non-locale version until full migration
export default function LocaleChatPage() {
  redirect("/chat")
}
