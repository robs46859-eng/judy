import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
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
  it('uses the validated agreejudy GLB at runtime within the upload-size ceiling', () => {
    expect(BUNDLED_AVATAR_MODEL_URL).toBe('/models/agreejudy.glb');
    const runtimePath = join(process.cwd(), 'public', BUNDLED_AVATAR_MODEL_URL);
    expect(existsSync(runtimePath)).toBe(true);
    expect(statSync(runtimePath).size).toBeLessThanOrEqual(25 * 1024 * 1024);
  });

  it('ships a skinned GLB with animation-ready joint weights', () => {
    const glb = readGlbJson(join(process.cwd(), 'public/models/agreejudy.glb'));
    const primitiveAttributes = (glb.meshes ?? []).flatMap((mesh) =>
      (mesh.primitives ?? []).map((primitive) => primitive.attributes ?? {})
    );

    expect(glb.asset?.version).toBe('2.0');
    expect(glb.skins?.length).toBeGreaterThan(0);
    expect(primitiveAttributes.some((attributes) => 'JOINTS_0' in attributes)).toBe(true);
    expect(primitiveAttributes.some((attributes) => 'WEIGHTS_0' in attributes)).toBe(true);
  });

  it('ships every Rhubarb viseme and ARKit jaw controls required for lip sync', () => {
    const file = readFileSync(join(process.cwd(), 'public/models/agreejudy.glb'));
    const report = inspectGlb(file);

    expect(report.valid).toBe(true);
    expect(report.compatible).toBe(true);
    expect(report.lipSyncMode).toBe('visemes');
    expect(report.visemeTargets).toEqual([...REQUIRED_VISEME_TARGETS]);
    expect(report.missingVisemeTargets).toEqual([]);
    expect(report.arkitMouthTargets).toContain('jawOpen');
  });
});
