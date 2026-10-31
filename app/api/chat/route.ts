import { NextRequest } from "next/server";
import { z } from "zod";
import { openai } from "@/lib/openai";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({
  conversationId: z.string().uuid().optional(),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string()
    })
  ),
  useWebSearch: z.boolean().default(false)
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);

    const supabase = await createServerSupabaseClient();
    const { data: userData, error: authError } = await supabase.auth.getUser();

    if (authError || !userData.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let conversationId = data.conversationId;

    if (!conversationId) {
      const conversationTitle = data.messages[0]?.content?.slice(0, 40) || "New chat";
      const { data: createdConversation, error: conversationError } = await supabase
        .from("conversations")
        .insert({
          user_id: userData.user.id,
          title: conversationTitle,
          is_private: true
        })
        .select()
        .single();

      if (conversationError || !createdConversation) {
        return Response.json({ error: conversationError?.message || "Could not create conversation" }, { status: 500 });
      }

      conversationId = createdConversation.id;
    }

    const systemPrompt =
      "You are NovaChat, a helpful and concise AI assistant. Provide direct answers, write clean code, and maintain context across the conversation.";

    const messagesForModel = [
      { role: "system", content: systemPrompt },
      ...data.messages.map((m) => ({ role: m.role, content: m.content }))
    ];

    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messagesForModel,
      stream: true,
      temperature: 0.7,
      max_tokens: 1200
    });

    const encoder = new TextEncoder();
    let fullResponse = "";

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content ?? "";
            if (!delta) continue;
            fullResponse += delta;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "chunk", content: delta })}\n\n`)
            );
          }

          const lastUserMessage = data.messages.filter((m) => m.role === "user").at(-1);
          const finalUser = lastUserMessage?.content || "";

          if (conversationId) {
            await supabase.from("messages").insert([
              { conversation_id: conversationId, role: "user", content: finalUser },
              { conversation_id: conversationId, role: "assistant", content: fullResponse }
            ]);
          }

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done", content: fullResponse })}\n\n`)
          );
          controller.close();
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", content: "Streaming failed." })}\n\n`
            )
          );
          controller.close();
        }
      }
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      }
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Invalid request payload or server error." }, { status: 500 });
  }
}
