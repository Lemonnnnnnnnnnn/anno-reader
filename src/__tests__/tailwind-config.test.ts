/**
 * Tests for the Tailwind CSS configuration.
 *
 * Verifies darkMode setting and that all semantic color tokens
 * use the { DEFAULT, dark } object format for theme switching.
 *
 * @vitest-environment node
 */

import { describe, it, expect } from "vitest";
import config from "../../tailwind.config";

const colors = config.theme?.extend?.colors as Record<
  string,
  { DEFAULT: string; dark: string }
>;

describe("tailwind.config.ts", () => {
  describe("darkMode", () => {
    it("should be set to 'class'", () => {
      expect(config.darkMode).toBe("class");
    });
  });

  describe("semantic color tokens", () => {
    const expectedTokens = [
      "bg",
      "surface",
      "text",
      "text-secondary",
      "text-muted",
      "border",
      "accent",
      "accent-hover",
      "error",
      "error-bg",
    ];

    it.each(expectedTokens)(
      'should have "%s" as an object with DEFAULT and dark',
      (token) => {
        const value = colors[token];
        expect(value).toBeDefined();
        expect(typeof value).toBe("object");
        expect(typeof value.DEFAULT).toBe("string");
        expect(typeof value.dark).toBe("string");
      }
    );

    it("should have exactly 10 color tokens", () => {
      expect(Object.keys(colors)).toHaveLength(10);
    });

    it("should not have any plain-string color tokens", () => {
      for (const [, value] of Object.entries(colors)) {
        expect(typeof value).not.toBe("string");
      }
    });
  });

  describe("color values", () => {
    it("should preserve original light-mode values", () => {
      expect(colors.bg.DEFAULT).toBe("#f6f6f6");
      expect(colors.surface.DEFAULT).toBe("#ffffff");
      expect(colors.text.DEFAULT).toBe("#0f0f0f");
      expect(colors["text-secondary"].DEFAULT).toBe("#6b7280");
      expect(colors["text-muted"].DEFAULT).toBe("#9ca3af");
      expect(colors.border.DEFAULT).toBe("#e5e5e5");
      expect(colors.accent.DEFAULT).toBe("#374151");
      expect(colors["accent-hover"].DEFAULT).toBe("#1f2937");
      expect(colors.error.DEFAULT).toBe("#dc2626");
      expect(colors["error-bg"].DEFAULT).toBe("#fef2f2");
    });

    it("should have dark-mode variants for all tokens", () => {
      expect(colors.bg.dark).toBe("#1a1a1a");
      expect(colors.surface.dark).toBe("#242424");
      expect(colors.text.dark).toBe("#e5e5e5");
      expect(colors["text-secondary"].dark).toBe("#a3a3a3");
      expect(colors["text-muted"].dark).toBe("#737373");
      expect(colors.border.dark).toBe("#404040");
      expect(colors.accent.dark).toBe("#60a5fa");
      expect(colors["accent-hover"].dark).toBe("#93c5fd");
      expect(colors.error.dark).toBe("#ef4444");
      expect(colors["error-bg"].dark).toBe("#451a1a");
    });
  });
});
