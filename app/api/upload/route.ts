import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const conversationId = formData.get("conversationId") as string | null;

  if (!file) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();

  if (authError || !userData.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const safeName = `${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
  const path = `${userData.user.id}/${conversationId ?? "general"}/${safeName}`;

  const { data, error } = await supabase.storage
    .from("chat-files")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false
    });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ path: data.path });
}
