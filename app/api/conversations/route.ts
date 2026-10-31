import { NextRequest } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const createSchema = z.object({
  title: z.string().min(1).max(120),
  isPrivate: z.boolean().default(true)
});

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();

  if (authError || !userData.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("user_id", userData.user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ conversations: data });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();

  if (authError || !userData.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json();
  const data = createSchema.parse(json);

  const { data: conversation, error } = await supabase
    .from("conversations")
    .insert({
      user_id: userData.user.id,
      title: data.title,
      is_private: data.isPrivate
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ conversation }, { status: 201 });
}
