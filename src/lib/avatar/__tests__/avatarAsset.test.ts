import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { inspectGlb, REQUIRED_VISEME_TARGETS } from '../glbInspector';

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
