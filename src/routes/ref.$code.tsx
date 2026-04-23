import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/ref/$code")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/register",
      search: { ref: params.code } as never,
    });
  },
});
