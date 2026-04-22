import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PromoteSchema = z.object({ email: z.string().email().max(255) });
const SetRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["user", "admin", "superadmin"]),
});

async function assertSuperadmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const isSuper = (data ?? []).some((r) => r.role === "superadmin");
  if (!isSuper) throw new Error("Solo superadmin puede ejecutar esta acción");
}

export const promoteToAdminFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PromoteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertSuperadmin(userId);

    // Find user by email in profiles
    const { data: profile, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("user_id, email, nombre, apellido")
      .ilike("email", data.email.trim())
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!profile) throw new Error(`No existe un usuario con email ${data.email}`);

    // Check if already admin
    const { data: existing, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", profile.user_id)
      .eq("role", "admin")
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (existing) {
      return { ok: true, alreadyAdmin: true, userId: profile.user_id, email: profile.email };
    }

    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: profile.user_id, role: "admin" });
    if (insErr) throw new Error(insErr.message);

    return { ok: true, alreadyAdmin: false, userId: profile.user_id, email: profile.email };
  });

export const revokeAdminFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SetRoleSchema.pick({ userId: true }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertSuperadmin(userId);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", "admin");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
