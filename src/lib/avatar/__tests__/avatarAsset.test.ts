import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { inspectGlb, REQUIRED_VISEME_TARGETS } from '../glbInspector';
import { BUNDLED_AVATAR_MODEL_URL } from '../model';

interface GlbNode {
  name?: string;
}

interface GlbSkin {
  joints?: number[];
}

interface GlbPrimitive {
  attributes?: Record<string, number>;
}

interface GlbMesh {
  primitives?: GlbPrimitive[];
}

interface GlbJson {
  asset?: { version?: string };
  nodes?: GlbNode[];
  skins?: GlbSkin[];
  meshes?: GlbMesh[];
}

function readGlbJson(filePath: string): GlbJson {
  const file = readFileSync(filePath);
  expect(file.toString('utf8', 0, 4)).toBe('glTF');
  expect(file.readUInt32LE(4)).toBe(2);
  expect(file.readUInt32LE(8)).toBe(file.length);

  const jsonLength = file.readUInt32LE(12);
  expect(file.toString('ascii', 16, 20)).toBe('JSON');
  return JSON.parse(file.toString('utf8', 20, 20 + jsonLength)) as GlbJson;
}

describe('Judy production avatar asset', () => {
  it('uses the optimized derivative of the verified facial rig at runtime', () => {
    expect(BUNDLED_AVATAR_MODEL_URL).toBe('/models/judyface-runtime/judyface.gltf');
    const runtimePath = join(process.cwd(), 'public', BUNDLED_AVATAR_MODEL_URL);
    const runtimeDirectory = dirname(runtimePath);
    const document = JSON.parse(readFileSync(runtimePath, 'utf8')) as {
      buffers?: Array<{ uri?: string }>;
      images?: Array<{ uri?: string }>;
      meshes?: Array<{ extras?: { targetNames?: string[] } }>;
      nodes?: Array<{ name?: string }>;
      skins?: Array<{ joints?: number[] }>;
    };
    const dependencies = [
      ...(document.buffers ?? []).map((buffer) => buffer.uri),
      ...(document.images ?? []).map((image) => image.uri),
    ].filter((uri): uri is string => Boolean(uri));

    expect(dependencies.length).toBeGreaterThan(0);
    for (const uri of dependencies) {
      expect(resolve(runtimeDirectory, uri).startsWith(`${runtimeDirectory}/`)).toBe(true);
      expect(existsSync(resolve(runtimeDirectory, uri))).toBe(true);
    }
    for (const image of document.images ?? []) {
      if (image.uri) expect(statSync(resolve(runtimeDirectory, image.uri)).size).toBeLessThan(512_000);
    }

    const runtimeVisemes = new Set(
      (document.meshes ?? []).flatMap((mesh) => mesh.extras?.targetNames ?? [])
    );
    const runtimeJoints = new Set(
      (document.skins ?? []).flatMap((skin) =>
        (skin.joints ?? []).map((jointIndex) => document.nodes?.[jointIndex]?.name)
      )
    );
    expect([...REQUIRED_VISEME_TARGETS].every((target) => runtimeVisemes.has(target))).toBe(true);
    expect(runtimeJoints.has('jaw')).toBe(true);
  });

  it('ships a skinned GLB with the jaw joint expected by the avatar runtime', () => {
    const glb = readGlbJson(join(process.cwd(), 'public/models/judyface.glb'));
    const nodes = glb.nodes ?? [];
    const jointNames = new Set(
      (glb.skins ?? []).flatMap((skin) =>
        (skin.joints ?? []).map((jointIndex) => nodes[jointIndex]?.name)
      )
    );
    const primitiveAttributes = (glb.meshes ?? []).flatMap((mesh) =>
      (mesh.primitives ?? []).map((primitive) => primitive.attributes ?? {})
    );

    expect(glb.asset?.version).toBe('2.0');
    expect(glb.skins?.length).toBeGreaterThan(0);
    expect(jointNames.has('jaw')).toBe(true);
    expect(primitiveAttributes.some((attributes) => 'JOINTS_0' in attributes)).toBe(true);
    expect(primitiveAttributes.some((attributes) => 'WEIGHTS_0' in attributes)).toBe(true);
  });

  it('ships a lip-sync-compatible bundled fallback with every Rhubarb viseme', () => {
    const file = readFileSync(join(process.cwd(), 'public/models/judyface.glb'));
    const report = inspectGlb(file);

    expect(report.valid).toBe(true);
    expect(report.compatible).toBe(true);
    expect(report.lipSyncMode).toBe('visemes');
    expect(report.visemeTargets).toEqual([...REQUIRED_VISEME_TARGETS]);
    expect(report.missingVisemeTargets).toEqual([]);
  });
});
