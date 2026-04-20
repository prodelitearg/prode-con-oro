import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/prodelite/AppHeader";
import { BottomNav } from "@/components/prodelite/BottomNav";

export const Route = createFileRoute("/app")({
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/login", search: { redirect: location.href } as never });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  return (
    <div className="min-h-screen pb-20">
      <AppHeader />
      <Outlet />
      <BottomNav />
    </div>
  );
}
