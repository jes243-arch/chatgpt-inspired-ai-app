"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Moon, Sun, Plus, Search, Send, Mic, Volume2, Copy, RefreshCcw, Paperclip, Sparkles, Shield, MessageSquareText } from "lucide-react";
import { useTheme } from "next-themes";

type Role = "user" | "assistant" | "system";

type Message = {
  id: string;
  role: Role;
  content: string;
};

type Conversation = {
  id: string;
  title: string;
  is_private: boolean;
  updated_at: string;
};

export default function Home() {
  const { theme, setTheme } = useTheme();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "assistant", content: "Hi! I’m NovaChat. Ask me anything, generate code, summarize docs, or work through a problem." }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [isPrivate, setIsPrivate] = useState(true);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      const res = await fetch("/api/conversations", { method: "GET" });
      const result = await res.json();
      if (res.ok && result.conversations) {
        setConversations(result.conversations);
        if (!selectedConversationId && result.conversations[0]) {
          setSelectedConversationId(result.conversations[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const createNewChat = async () => {
    const title = `New chat ${conversations.length + 1}`;
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, isPrivate: isPrivate })
      });
      const result = await res.json();
      if (res.ok) {
        setSelectedConversationId(result.conversation.id);
        setMessages([]);
        await fetchConversations();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input
    };

    const recentMessages = [...messages, userMessage].map((m) => ({
      role: m.role,
      content: m.content
    }));

    setMessages((prev) => [...prev, userMessage, { id: "pending", role: "assistant", content: "" }]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selectedConversationId,
          messages: recentMessages,
          useWebSearch: webSearchEnabled
        })
      });

      if (!res.ok || !res.body) {
        throw new Error("Failed to send message");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.type === "chunk") {
              assistantText += payload.content;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === "pending" ? { ...msg, content: assistantText } : msg
                )
              );
            } else if (payload.type === "done") {
              setMessages((prev) => prev.filter((msg) => msg.id !== "pending"));
            }
          } catch {
            // ignore
          }
        }
      }

      await fetchConversations();
    } catch (error) {
      setMessages((prev) => prev.filter((msg) => msg.id !== "pending"));
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: "Something went wrong. Please try again." }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const regenerate = async () => {
    if (messages.length === 0) return;
    setIsLoading(true);
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMessage) return;

    const filteredMessages = messages.filter((m) => m.id !== "pending");
    setMessages([...filteredMessages, { id: "pending", role: "assistant", content: "" }]);

    try {
      const payloadMessages = filteredMessages.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selectedConversationId,
          messages: [...payloadMessages, { role: "user", content: lastUserMessage.content }],
          useWebSearch: webSearchEnabled
        })
      });

      if (!res.ok || !res.body) throw new Error("Regenerate failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let response = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.type === "chunk") {
              response += payload.content;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === "pending" ? { ...msg, content: response } : msg
                )
              );
            }
          } catch {}
        }
      }

      setMessages((prev) => prev.filter((msg) => msg.id !== "pending"));
      await fetchConversations();
    } catch {
      setMessages((prev) => prev.filter((msg) => msg.id !== "pending"));
    } finally {
      setIsLoading(false);
    }
  };

  const copyLastAssistant = async () => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant) return;
    await navigator.clipboard.writeText(lastAssistant.content);
  };

  const toggleVoiceInput = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is unsupported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    setIsListening(true);
    recognition.start();
  };

  const speakResponse = () => {
    if (typeof window === "undefined") return;
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant) return;

    const utterance = new SpeechSynthesisUtterance(lastAssistant.content);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    if (selectedConversationId) formData.append("conversationId", selectedConversationId);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: `Uploaded "${file.name}" successfully.` }
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: "Upload failed. Please try again." }
      ]);
    }
  };

  const sidebarConversations = useMemo(() => conversations.slice(0, 10), [conversations]);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <div className="flex h-screen">
        <aside className="hidden w-80 flex-col border-r border-slate-200 bg-white/80 p-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 md:flex">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white">
                N
              </div>
              <div>
                <div className="text-lg font-semibold">NovaChat</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Private AI workspace</div>
              </div>
            </div>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>

          <button
            onClick={createNewChat}
            className="mb-5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 font-medium text-white transition hover:bg-slate-800 dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            <Plus size={18} /> New chat
          </button>

          <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950">
            <Search size={16} className="text-slate-500" />
            <input className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" placeholder="Search chats" />
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto">
            {sidebarConversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => setSelectedConversationId(conversation.id)}
                className={`flex w-full items-center justify-between rounded-xl p-3 text-left transition ${
                  selectedConversationId === conversation.id
                    ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white"
                    : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900"
                }`}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{conversation.title}</div>
                  <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{conversation.is_private ? "Private" : "Shared"}</div>
                </div>
                <MessageSquareText size={14} className="text-slate-400" />
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-emerald-500" />
                <span className="text-sm font-medium">Private mode</span>
              </div>
              <button
                onClick={() => setIsPrivate((prev) => !prev)}
                className={`relative h-6 w-11 rounded-full ${isPrivate ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"}`}
              >
                <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${isPrivate ? "left-6" : "left-1"}`} />
              </button>
            </div>
          </div>
        </aside>

        <section className="flex flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-brand-100 p-2 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                <Sparkles size={18} />
              </div>
              <div>
                <div className="font-semibold">NovaChat</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Conversation context enabled</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setWebSearchEnabled((prev) => !prev)}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  webSearchEnabled
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                }`}
              >
                Web search
              </button>
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="rounded-lg border border-slate-200 p-2 dark:border-slate-700"
              >
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </div>
          </header>

          <div className="chat-scrollbar flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="mx-auto max-w-3xl space-y-5">
              {messages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-slate-500">Start a new conversation</div>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-7 shadow-sm ${
                        message.role === "user"
                          ? "bg-slate-900 text-white dark:bg-brand-600"
                          : "bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{message.content || (isLoading ? "..." : "")}</div>
                    </div>
                  </div>
                ))
              )}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-200">Thinking...</div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          </div>

          <div className="border-t border-slate-200 bg-white/80 p-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
            <div className="mx-auto max-w-3xl">
              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  onClick={copyLastAssistant}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Copy size={13} /> Copy response
                </button>
                <button
                  onClick={regenerate}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <RefreshCcw size={13} /> Regenerate
                </button>
                <button
                  onClick={speakResponse}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Volume2 size={13} /> Voice output
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-soft dark:border-slate-700 dark:bg-slate-950">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  rows={1}
                  placeholder="Message NovaChat..."
                  className="max-h-40 min-h-[52px] w-full resize-none bg-transparent px-3 py-3 text-sm outline-none placeholder:text-slate-400"
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-lg border border-slate-200 bg-white p-2 text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <Paperclip size={17} />
                    </button>
                    <button
                      onClick={toggleVoiceInput}
                      className={`rounded-lg border p-2 transition ${
                        isListening ? "border-red-400 bg-red-50 text-red-500 dark:bg-red-900/20" : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      }`}
                    >
                      <Mic size={17} />
                    </button>
                    <input ref={fileInputRef} type="file" hidden onChange={handleUpload} />
                  </div>

                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() || isLoading}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-600"
                  >
                    <Send size={17} />
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
