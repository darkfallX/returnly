// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OnboardingFlow } from "./OnboardingFlow";

vi.mock("./OnboardingIllustration", () => ({
  OnboardingIllustration: () => null,
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let container: HTMLDivElement;
let root: Root;
function button(label: string) {
  const result = [...container.querySelectorAll("button")].find((b) =>
    b.textContent?.trim().endsWith(label),
  );
  if (!result) throw new Error(`Missing button: ${label}`);
  return result;
}
async function click(label: string) {
  await act(async () => button(label).click());
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("Onboarding progression", () => {
  it("keeps the server-rendered next action disabled until hydration", () => {
    container.innerHTML = renderToString(
      <MemoryRouter>
        <OnboardingFlow onDemo={() => {}} />
      </MemoryRouter>,
    );
    expect(button("Get started").disabled).toBe(true);
  });
  it("renders the second step and reaches workspace choice only through Continue", async () => {
    const demo = vi.fn();
    await act(async () =>
      root.render(
        <MemoryRouter>
          <OnboardingFlow onDemo={demo} />
        </MemoryRouter>,
      ),
    );
    expect(button("Workspace").disabled).toBe(true);
    await click("Workspace");
    expect(container.querySelector("h1")?.textContent).toBe(
      "We can help you resolve this.",
    );
    await click("Get started");
    expect(container.querySelector("h1")?.textContent).toBe("How resolution works");
    expect(
      [...container.querySelectorAll("li h2")].map((n) => n.textContent),
    ).toEqual([
      "Report the item",
      "Store review",
      "Approve & get pass",
    ]);
    expect(button("Workspace").disabled).toBe(true);
    await click("Continue");
    expect(
      container.querySelector('a[href="/onboarding/buyer"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('a[href="/onboarding/merchant"]'),
    ).not.toBeNull();
    await click("Try demo");
    expect(demo).toHaveBeenCalledTimes(1);
    await click("Back");
    expect(container.querySelector("h1")?.textContent).toBe("How resolution works");
  });

  it("does not dispatch the demo twice while opening", async () => {
    const demo = vi.fn();
    await act(async () =>
      root.render(
        <MemoryRouter>
          <OnboardingFlow onDemo={demo} demoPending />
        </MemoryRouter>,
      ),
    );
    await click("Get started");
    await click("Continue");
    await click("Opening demo…");
    expect(button("Opening demo…").disabled).toBe(true);
    expect(demo).not.toHaveBeenCalled();
  });
});
