// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import AvatarManager from "../AvatarManager";

vi.mock("@/components/avatar/AvatarStage", () => ({
  default: ({ modelUrl }: { modelUrl: string }) => (
    <div data-testid="avatar-stage" data-model-url={modelUrl} />
  ),
}));

const bundled = {
  modelUrl: "/models/bundled.glb",
  report: {
    compatible: true,
    lipSyncMode: "jaw",
    jawInfluencedVertices: 412,
    morphTargetNames: [],
    issues: [],
    warnings: [],
  },
};

const current = {
  filename: "travel-daddy.glb",
  size: 2_830_436,
  uploadedAt: "2026-07-17T15:00:00.000Z",
  modelUrl: "/api/admin/avatar/model/travel-daddy.glb",
  report: {
    compatible: true,
    lipSyncMode: "visemes",
    jawInfluencedVertices: 892,
    visemeTargets: ["viseme_A", "viseme_X"],
    issues: [],
    warnings: [{ code: "NO_BLINKS", message: "Blink morphs are not present." }],
  },
};

function response(body: unknown, ok = true, status = ok ? 200 : 422): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AvatarManager", () => {
  it("loads the current asset, rig details, and 3D preview", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response({ current, bundled })));

    render(<AvatarManager />);

    expect((await screen.findAllByText("travel-daddy.glb")).length).toBeGreaterThan(0);
    expect(screen.getByText("Compatible rig")).toBeInTheDocument();
    expect(screen.getByText("visemes")).toBeInTheDocument();
    expect(screen.getByText("892")).toBeInTheDocument();
    expect(screen.getByText("viseme_A")).toBeInTheDocument();
    expect(screen.getByText("Blink morphs are not present.")).toBeInTheDocument();
    expect(screen.getByTestId("avatar-stage")).toHaveAttribute(
      "data-model-url",
      current.modelUrl
    );
  });

  it("shows and previews the bundled avatar when no upload is active", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response({ current: null, bundled })));

    render(<AvatarManager />);

    expect(await screen.findByText(/No uploaded avatar is active/)).toBeInTheDocument();
    expect(screen.getByText("Bundled rig validation")).toBeInTheDocument();
    expect(screen.getByTestId("avatar-stage")).toHaveAttribute(
      "data-model-url",
      bundled.modelUrl
    );
  });

  it("uploads the avatar field, reports busy progress, and activates a valid response", async () => {
    let resolveUpload: ((value: Response) => void) | null = null;
    const uploadResponse = new Promise<Response>((resolve) => {
      resolveUpload = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ current: null, bundled }))
      .mockReturnValueOnce(uploadResponse);
    vi.stubGlobal("fetch", fetchMock);

    render(<AvatarManager />);
    const picker = await screen.findByLabelText("GLB avatar file");
    const file = new File(["glTF"], "new-avatar.glb", { type: "model/gltf-binary" });
    fireEvent.change(picker, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Upload, validate & activate" }));

    expect(screen.getByRole("button", { name: "Uploading and validating…" })).toBeDisabled();
    expect(screen.getByRole("progressbar", { name: "Avatar upload and validation in progress" })).toBeInTheDocument();
    const request = fetchMock.mock.calls[1];
    expect(request[0]).toBe("/api/admin/avatar");
    expect(request[1]?.method).toBe("POST");
    expect(request[1]?.body).toBeInstanceOf(FormData);
    expect((request[1]?.body as FormData).get("avatar")).toBe(file);

    const uploaded = { ...current, filename: "new-avatar.glb", modelUrl: "/avatars/new-avatar.glb" };
    await act(async () => {
      resolveUpload?.(response({ current: uploaded, report: uploaded.report }));
      await uploadResponse;
    });

    expect(await screen.findByText("new-avatar.glb is validated and active.")).toBeInTheDocument();
    expect(screen.getByTestId("avatar-stage")).toHaveAttribute(
      "data-model-url",
      uploaded.modelUrl
    );
  });

  it("renders the validator report when an incompatible upload is rejected", async () => {
    const rejectedReport = {
      compatible: false,
      lipSyncMode: "none",
      jawInfluencedVertices: 0,
      morphTargetNames: [],
      issues: [
        {
          code: "NO_LIP_SYNC_RIG",
          message: "No jaw bone or supported facial morph targets were found.",
        },
      ],
      warnings: [],
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response({ current, bundled }))
        .mockResolvedValueOnce(
          response({ error: "Avatar rig is incompatible.", report: rejectedReport }, false)
        )
    );

    render(<AvatarManager />);
    const file = new File(["glTF"], "static.glb", { type: "model/gltf-binary" });
    fireEvent.change(await screen.findByLabelText("GLB avatar file"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload, validate & activate" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Avatar rig is incompatible.");
    expect(screen.getByText("Uploaded file validation")).toBeInTheDocument();
    expect(screen.getByText("Incompatible rig")).toBeInTheDocument();
    expect(
      screen.getByText("No jaw bone or supported facial morph targets were found.")
    ).toBeInTheDocument();
    expect(screen.getByTestId("avatar-stage")).toHaveAttribute(
      "data-model-url",
      current.modelUrl
    );
  });

  it("rejects a non-GLB selection before making an upload request", async () => {
    const fetchMock = vi.fn(async () => response({ current: null, bundled }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AvatarManager />);

    const file = new File(["not a model"], "avatar.txt", { type: "text/plain" });
    fireEvent.change(await screen.findByLabelText("GLB avatar file"), {
      target: { files: [file] },
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Choose a .glb avatar model.");
    expect(screen.getByRole("button", { name: "Upload, validate & activate" })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("reports a failed status request without exposing destructive controls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response({ error: "Administrator access required." }, false, 403))
    );

    render(<AvatarManager />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Administrator access required.");
    expect(screen.queryByRole("button", { name: /delete|remove|clear/i })).not.toBeInTheDocument();
  });
});
