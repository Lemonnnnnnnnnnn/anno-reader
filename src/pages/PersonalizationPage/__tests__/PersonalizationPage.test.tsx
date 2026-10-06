/** @vitest-environment happy-dom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { PersonalizationPage } from "..";

it("renders a side TOC and navigates to personalization sections", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<MemoryRouter><PersonalizationPage /></MemoryRouter>));
  const nav = container.querySelector('nav[aria-label="个性化目录"]')!;
  expect(nav.querySelectorAll("a")).toHaveLength(2);
  expect(container.textContent).not.toContain("沉浸式阅读");
  expect(container.textContent).not.toContain("展示方式");
  const noteLayout = container.querySelector('[aria-label="Note Detail布局"]')!;
  await act(async () => [...noteLayout.querySelectorAll("button")].find(button => button.textContent === "弹窗")!.click());
  expect([...noteLayout.querySelectorAll("button")].find(button => button.textContent === "弹窗")!.getAttribute("aria-pressed")).toBe("true");
  const keyboard = container.querySelector<HTMLElement>("#keyboard")!;
  const scroll = vi.spyOn(keyboard, "scrollIntoView").mockImplementation(() => {});
  await act(async () => nav.querySelector<HTMLAnchorElement>('a[href="#keyboard"]')!.click());
  expect(scroll).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  expect(nav.querySelector('a[aria-current="location"]')?.textContent).toBe("Keyboard");
  for (const link of nav.querySelectorAll("a")) expect(container.querySelector(link.getAttribute("href")!)).not.toBeNull();
  await act(async () => root.unmount());
  container.remove();
});
