/**
 * Tests for buildChatSystemPrompt (chapter context injection).
 */

import { describe, it, expect } from "vitest";
import { buildChatSystemPrompt } from "@/lib/chat/context";

describe("buildChatSystemPrompt", () => {
  it("builds a persona-only prompt without book or chapter", () => {
    const prompt = buildChatSystemPrompt({});

    expect(prompt).toContain("reading assistant");
    expect(prompt).not.toContain("Book:");
    expect(prompt).not.toContain("Current chapter:");
  });

  it("includes book title and author when provided", () => {
    const prompt = buildChatSystemPrompt({
      bookTitle: "A Mind For Numbers",
      bookAuthor: "Barbara Oakley",
    });

    expect(prompt).toContain("Book: A Mind For Numbers");
    expect(prompt).toContain("Author: Barbara Oakley");
    expect(prompt).not.toContain("Current chapter:");
  });

  it("injects the bound chapter title and full text", () => {
    const prompt = buildChatSystemPrompt({
      bookTitle: "A Mind For Numbers",
      bookAuthor: "Barbara Oakley",
      chapter: {
        href: "chapter7.xhtml",
        title: "Chapter 7",
        text: "Chunking is the umbrella term for...",
      },
    });

    expect(prompt).toContain("Current chapter: Chapter 7");
    expect(prompt).toContain(
      "Full text of the current chapter:\nChunking is the umbrella term for...",
    );
  });

  it("omits the chapter block when the resolved text is empty", () => {
    const prompt = buildChatSystemPrompt({
      bookTitle: "Book",
      chapter: { href: "ch1.xhtml", title: "Chapter 1", text: "   " },
    });

    expect(prompt).not.toContain("Current chapter:");
  });
});
