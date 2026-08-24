import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChromeTrigger } from "./ChromeTrigger";

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ChromeTrigger open={open} onToggle={() => setOpen((o) => !o)} />
      {open ? <div id="singulo-chrome">chrome</div> : null}
    </>
  );
}

describe("ChromeTrigger", () => {
  it("exposes correct ARIA attributes", () => {
    render(<Harness />);
    const button = screen.getByTestId("chrome-trigger");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveAttribute("aria-controls", "singulo-chrome");
    expect(button.getAttribute("aria-label")).toMatch(/show interface controls/i);
  });

  it("is reachable with Tab", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.tab();
    expect(screen.getByTestId("chrome-trigger")).toHaveFocus();
  });

  it("expands and collapses on click", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const button = screen.getByTestId("chrome-trigger");
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById("singulo-chrome")).not.toBeNull();
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById("singulo-chrome")).toBeNull();
  });

  it("toggles with Enter and Space", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const button = screen.getByTestId("chrome-trigger");
    button.focus();
    await user.keyboard("{Enter}");
    expect(button).toHaveAttribute("aria-expanded", "true");
    await user.keyboard(" ");
    expect(button).toHaveAttribute("aria-expanded", "false");
  });
});
