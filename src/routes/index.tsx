import { createFileRoute } from "@tanstack/react-router";
import { Chat } from "@/components/chat/Chat";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "WorkPilot AI — Freelancer Operations Co-pilot" },
      {
        name: "description",
        content:
          "Premium AI operations dashboard for freelancers — track hours, manage projects, draft invoices, and chat with your AI co-pilot.",
      },
    ],
  }),
});

function Index() {
  return <Chat />;
}
