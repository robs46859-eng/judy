// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import MobileARViewer from "../MobileARViewer";

afterEach(() => {
  cleanup();
  document.getElementById("judy-model-viewer-script")?.remove();
  document.body.style.overflow = "";
});

describe("MobileARViewer", () => {
  it("renders cross-platform AR with Judy chat and privacy guidance", () => {
    const onSendMessage = vi.fn();
    render(
      <MobileARViewer
        modelUrl="/models/agreejudy.glb"
        open
        onClose={() => undefined}
        messages={[{ role: "judy", text: "Where are we headed?" }]}
        isSending={false}
        onSendMessage={onSendMessage}
      />
    );

    const viewer = document.querySelector("model-viewer");
    expect(screen.getByRole("dialog", { name: "Judy in your space" })).toBeInTheDocument();
    expect(viewer).toHaveAttribute("src", "/models/agreejudy.glb");
    expect(viewer).toHaveAttribute("ar-modes", "webxr scene-viewer quick-look");
    expect(screen.getByText("Place Judy in my space")).toBeInTheDocument();
    expect(screen.getByText("Where are we headed?")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Message Judy"), {
      target: { value: "Find dinner nearby" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message to Judy" }));
    expect(onSendMessage).toHaveBeenCalledWith("Find dinner nearby");
    expect(screen.getByText(/camera view stays on your phone/i)).toBeInTheDocument();
    expect(document.getElementById("judy-model-viewer-script")).toHaveAttribute(
      "src",
      "/vendor/model-viewer-4.3.1.min.js"
    );
  });

  it("closes without rendering the viewer when requested", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <MobileARViewer
        modelUrl="/models/agreejudy.glb"
        open
        onClose={onClose}
        messages={[]}
        isSending={false}
        onSendMessage={() => undefined}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Close AR viewer" }));
    expect(onClose).toHaveBeenCalledOnce();

    rerender(
      <MobileARViewer
        modelUrl="/models/agreejudy.glb"
        open={false}
        onClose={onClose}
        messages={[]}
        isSending={false}
        onSendMessage={() => undefined}
      />
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
