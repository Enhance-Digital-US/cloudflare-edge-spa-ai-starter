import { type ChatMessage, MAX_CONTEXT_CHARS } from "@cf-ai-spa/shared";

// Keeps the newest messages whose combined length fits the budget, so a long
// conversation becomes a sliding window instead of an ever-growing (and ever more
// expensive) prompt. The newest message is always kept; the schema caps its size.
export function fitToBudget(messages: ChatMessage[], maxChars = MAX_CONTEXT_CHARS): ChatMessage[] {
  let total = 0;
  let start = messages.length;
  for (let i = messages.length - 1; i >= 0; i--) {
    total += messages[i]?.content.length ?? 0;
    if (total > maxChars && i < messages.length - 1) break;
    start = i;
  }
  return messages.slice(start);
}
