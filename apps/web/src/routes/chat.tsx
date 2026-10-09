import { Button, Textarea } from "@cf-ai-spa/ui";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
  Message,
  MessageContent,
  MessageResponse,
  Shimmer,
  Suggestion,
  Suggestions,
} from "@cf-ai-spa/ui/ai-elements";
import { fetchHttpStream, useChat } from "@tanstack/ai-react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { authClient } from "../lib/auth-client";

export const Route = createFileRoute("/chat")({
  // UX guard only — the API enforces auth on /api/ai/* regardless.
  beforeLoad: async ({ location }) => {
    const { data } = await authClient.getSession();
    if (!data) {
      throw redirect({ to: "/sign-in", search: { redirect: location.href } });
    }
  },
  component: ChatPage,
});

const suggestions = [
  "How do Workers differ from serverless?",
  "Query a D1 database in TypeScript",
  "Edge computing benefits for AI",
  "Design a KV caching strategy",
];

function ChatPage() {
  const [input, setInput] = useState("");
  // One server-side Conversation (Durable Object) per visit to this page; the API
  // persists each turn under the signed-in user's id + this conversation id.
  const [conversationId] = useState(() => crypto.randomUUID());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, sendMessage, isLoading, error } = useChat({
    connection: fetchHttpStream("/api/ai/chat"),
    forwardedProps: { conversationId },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ content: input });
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const handleSuggestion = (suggestion: string) => {
    sendMessage({ content: suggestion });
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      <Conversation className="flex-1 min-h-0">
        <ConversationContent className="max-w-3xl mx-auto">
          {isEmpty && !isLoading && (
            <ConversationEmptyState
              title="Chat with Workers AI"
              description="Powered by Kimi K2.7 Code running on Cloudflare's edge network. Ask anything about code, architecture, or Cloudflare."
              icon={
                <svg
                  aria-hidden="true"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              }
            >
              <div className="space-y-2 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <svg
                    aria-hidden="true"
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-primary"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold">Chat with Workers AI</h2>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Powered by Kimi K2.7 Code running on Cloudflare's edge network. Ask anything about
                  code, architecture, or Cloudflare.
                </p>
              </div>

              <Suggestions className="justify-center">
                {suggestions.map((s) => (
                  <Suggestion key={s} suggestion={s} onClick={handleSuggestion} />
                ))}
              </Suggestions>
            </ConversationEmptyState>
          )}

          {messages.map((message, idx) => {
            // "activity" messages are in-progress status updates, not chat turns.
            if (message.role === "activity") return null;
            const textContent = message.parts
              ?.filter((part) => part.type === "text")
              .map((part) => part.content)
              .join("");

            const isLastAssistant = message.role === "assistant" && idx === messages.length - 1;

            return (
              <Message key={message.id} from={message.role}>
                <MessageContent>
                  {message.role === "user" ? (
                    <p className="whitespace-pre-wrap">{textContent}</p>
                  ) : (
                    <MessageResponse isAnimating={isLastAssistant && isLoading}>
                      {textContent}
                    </MessageResponse>
                  )}
                </MessageContent>
              </Message>
            );
          })}

          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <Message from="assistant">
              <MessageContent>
                <Shimmer duration={1.5}>Thinking...</Shimmer>
              </MessageContent>
            </Message>
          )}
        </ConversationContent>

        <ConversationScrollButton />
      </Conversation>

      {error && (
        <div className="mx-4 mb-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          Failed to send message. Check that the API is running and you're authenticated.
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="flex gap-2 border-t border-border p-4 max-w-3xl mx-auto w-full"
      >
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={handleTextareaInput}
          onKeyDown={handleKeyDown}
          placeholder="Send a message... (Shift+Enter for new line)"
          disabled={isLoading}
          rows={1}
          className="min-h-[44px] max-h-[200px] resize-none"
        />
        <Button
          type="submit"
          size="icon"
          disabled={isLoading || !input.trim()}
          className="shrink-0 h-[44px] w-[44px]"
        >
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </Button>
      </form>
    </div>
  );
}
