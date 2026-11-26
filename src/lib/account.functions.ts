import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ReviewAccountInput = z.object({
  userId: z.string().uuid(),
  status: z.enum(["approved", "rejected"]),
});

export const listPendingAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError || !isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: accessRows, error: accessError } = await supabaseAdmin
      .from("account_access")
      .select("user_id, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (accessError) throw new Error("Unable to load pending accounts");

    const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (usersError) throw new Error("Unable to load account email addresses");

    const emailById = new Map(usersData.users.map((user) => [user.id, user.email ?? null]));
    return (accessRows ?? []).map((row) => ({
      userId: row.user_id,
      email: emailById.get(row.user_id) ?? null,
      createdAt: row.created_at,
    }));
  });

export const reviewAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReviewAccountInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError || !isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error } = await supabaseAdmin
      .from("account_access")
      .update({
        status: data.status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
      })
      .eq("user_id", data.userId)
      .eq("status", "pending")
      .select("user_id")
      .maybeSingle();

    if (error) throw new Error("Unable to update account access");
    if (!updated) throw new Error("This account is no longer awaiting review");
    return { ok: true };
  });