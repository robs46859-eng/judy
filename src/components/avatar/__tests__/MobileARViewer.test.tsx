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
  it("renders the Judy model with cross-platform AR modes and privacy guidance", () => {
    render(
      <MobileARViewer
        modelUrl="/models/agreejudy.glb"
        open
        onClose={() => undefined}
      />
    );

    const viewer = document.querySelector("model-viewer");
    expect(screen.getByRole("dialog", { name: "Judy in your space" })).toBeInTheDocument();
    expect(viewer).toHaveAttribute("src", "/models/agreejudy.glb");
    expect(viewer).toHaveAttribute("ar-modes", "webxr scene-viewer quick-look");
    expect(screen.getByText("Place Judy in my space")).toBeInTheDocument();
    expect(screen.getByText(/camera view stays on your phone/i)).toBeInTheDocument();
    expect(document.getElementById("judy-model-viewer-script")).toHaveAttribute(
      "src",
      "/vendor/model-viewer-4.3.1.min.js"
    );
  });

  it("closes without rendering the viewer when requested", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <MobileARViewer modelUrl="/models/agreejudy.glb" open onClose={onClose} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Close AR viewer" }));
    expect(onClose).toHaveBeenCalledOnce();

    rerender(
      <MobileARViewer modelUrl="/models/agreejudy.glb" open={false} onClose={onClose} />
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
