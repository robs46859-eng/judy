import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { inspectGlb, REQUIRED_VISEME_TARGETS } from '../glbInspector';

const JSON_CHUNK_TYPE = 0x4e4f534a;
const BIN_CHUNK_TYPE = 0x004e4942;

function padded(buffer: Buffer, fill: number): Buffer {
  const padding = (4 - (buffer.length % 4)) % 4;
  return padding === 0 ? buffer : Buffer.concat([buffer, Buffer.alloc(padding, fill)]);
}

function makeGlb(document: Record<string, unknown>, binary = Buffer.alloc(0)): Buffer {
  const json = padded(Buffer.from(JSON.stringify(document)), 0x20);
  const bin = padded(binary, 0);
  const total = 12 + 8 + json.length + (bin.length > 0 ? 8 + bin.length : 0);
  const header = Buffer.alloc(12);
  header.write('glTF', 0, 'ascii');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(total, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(json.length, 0);
  jsonHeader.writeUInt32LE(JSON_CHUNK_TYPE, 4);
  if (bin.length === 0) return Buffer.concat([header, jsonHeader, json]);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(bin.length, 0);
  binHeader.writeUInt32LE(BIN_CHUNK_TYPE, 4);
  return Buffer.concat([header, jsonHeader, json, binHeader, bin]);
}

function baseDocument(binaryLength: number): Record<string, unknown> {
  return {
    asset: { version: '2.0', generator: 'test' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    buffers: [{ byteLength: binaryLength }],
  };
}

describe('inspectGlb', () => {
  it('rejects the current rig for lip sync because its jaw has no weighted vertices', () => {
    const file = readFileSync(join(process.cwd(), 'public/models/judyrig.glb'));
    const report = inspectGlb(file);

    expect(report.structurallyValid).toBe(true);
    expect(report.valid).toBe(true);
    expect(report.assetVersion).toBe('2.0');
    expect(report.skins).toHaveLength(1);
    expect(report.jawBones.map((bone) => bone.name)).toEqual(['jaw']);
    expect(report.jawInfluencedVertices).toBe(0);
    expect(report.morphTargets).toEqual([]);
    expect(report.animations).toEqual([]);
    expect(report.lipSyncMode).toBe('none');
    expect(report.compatible).toBe(false);
    expect(report.issues).toContainEqual(expect.objectContaining({ code: 'JAW_UNWEIGHTED' }));
    expect(() => JSON.stringify(report)).not.toThrow();
  });

  it('counts a case-insensitive jaw joint through strided normalized integer skin data', () => {
    const binary = Buffer.alloc(84);
    // POSITION: three VEC3 float vertices (36 bytes).
    binary.writeFloatLE(0, 0);
    binary.writeFloatLE(1, 12);
    binary.writeFloatLE(2, 24);
    // JOINTS_0: VEC4 u8 with 8-byte stride at offset 36.
    Buffer.from([1, 0, 0, 0]).copy(binary, 36);
    Buffer.from([0, 1, 0, 0]).copy(binary, 44);
    Buffer.from([1, 0, 0, 0]).copy(binary, 52);
    // WEIGHTS_0: normalized VEC4 u8 with 8-byte stride at offset 60.
    Buffer.from([255, 0, 0, 0]).copy(binary, 60);
    Buffer.from([255, 1, 0, 0]).copy(binary, 68);
    Buffer.from([0, 0, 0, 0]).copy(binary, 76);

    const report = inspectGlb(
      makeGlb({
        ...baseDocument(binary.length),
        nodes: [{ mesh: 0, skin: 0 }, { name: 'root' }, { name: 'JAW_Main' }],
        skins: [{ name: 'Rig', joints: [1, 2] }],
        bufferViews: [
          { buffer: 0, byteOffset: 0, byteLength: 36 },
          { buffer: 0, byteOffset: 36, byteLength: 24, byteStride: 8 },
          { buffer: 0, byteOffset: 60, byteLength: 24, byteStride: 8 },
        ],
        accessors: [
          { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' },
          { bufferView: 1, componentType: 5121, count: 3, type: 'VEC4' },
          { bufferView: 2, componentType: 5121, normalized: true, count: 3, type: 'VEC4' },
        ],
        meshes: [{ primitives: [{ attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 } }] }],
      }, binary)
    );

    expect(report.structurallyValid).toBe(true);
    expect(report.jawBones.map((bone) => bone.name)).toEqual(['JAW_Main']);
    expect(report.jawInfluencedVertices).toBe(2);
    expect(report.lipSyncMode).toBe('jaw');
    expect(report.compatible).toBe(true);
  });

  it('prefers a complete case-insensitive Rhubarb viseme set', () => {
    const binary = Buffer.alloc(12);
    const names = REQUIRED_VISEME_TARGETS.map((name, index) =>
      index % 2 === 0 ? name.toLowerCase() : name
    );
    const report = inspectGlb(
      makeGlb({
        ...baseDocument(binary.length),
        nodes: [{ mesh: 0 }],
        bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 12 }],
        accessors: [{ bufferView: 0, componentType: 5126, count: 1, type: 'VEC3' }],
        meshes: [
          {
            extras: { targetNames: names },
            primitives: [
              {
                attributes: { POSITION: 0 },
                targets: names.map(() => ({ POSITION: 0 })),
              },
            ],
          },
        ],
      }, binary)
    );

    expect(report.structurallyValid).toBe(true);
    expect(report.missingVisemeTargets).toEqual([]);
    expect(report.visemeTargets).toHaveLength(9);
    expect(report.morphTargetNames).toEqual(names);
    expect(report.lipSyncMode).toBe('visemes');
    expect(report.compatible).toBe(true);
  });

  it('recognizes an ARKit jawOpen morph when a complete viseme set is absent', () => {
    const binary = Buffer.alloc(12);
    const report = inspectGlb(
      makeGlb({
        ...baseDocument(binary.length),
        nodes: [{ mesh: 0 }],
        bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 12 }],
        accessors: [{ bufferView: 0, componentType: 5126, count: 1, type: 'VEC3' }],
        meshes: [
          {
            extras: { targetNames: ['jawOpen', 'mouthPucker'] },
            primitives: [
              {
                attributes: { POSITION: 0 },
                targets: [{ POSITION: 0 }, { POSITION: 0 }],
              },
            ],
          },
        ],
      }, binary)
    );

    expect(report.arkitMouthTargets).toEqual(['jawOpen', 'mouthPucker']);
    expect(report.lipSyncMode).toBe('arkit');
    expect(report.compatible).toBe(true);
  });

  it('reports accessors that exceed their buffer view without throwing', () => {
    const binary = Buffer.alloc(4);
    const report = inspectGlb(
      makeGlb({
        ...baseDocument(binary.length),
        nodes: [{ mesh: 0 }],
        bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 4 }],
        accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' }],
        meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
      }, binary)
    );

    expect(report.structurallyValid).toBe(false);
    expect(report.valid).toBe(false);
    expect(report.compatible).toBe(false);
    expect(report.issues).toContainEqual(expect.objectContaining({ code: 'ACCESSOR_OUT_OF_BOUNDS' }));
  });

  it('rejects hostile collection shapes and extreme accessor counts without throwing', () => {
    const binary = Buffer.alloc(4);
    const file = makeGlb({
      ...baseDocument(binary.length),
      scenes: { nodes: [0] },
      nodes: [{ mesh: 0 }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 4 }],
      accessors: [
        {
          bufferView: 0,
          componentType: 5121,
          count: Number.MAX_SAFE_INTEGER,
          type: 'SCALAR',
        },
      ],
    }, binary);

    expect(() => inspectGlb(file)).not.toThrow();
    const report = inspectGlb(file);
    expect(report.valid).toBe(false);
    expect(report.compatible).toBe(false);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'GLTF_ARRAY_INVALID' }),
        expect.objectContaining({ code: 'ACCESSOR_COUNT_LIMIT' }),
      ])
    );
  });

  it('rejects sparse data that points outside the embedded BIN chunk', () => {
    const binary = Buffer.alloc(16);
    const report = inspectGlb(
      makeGlb({
        ...baseDocument(binary.length),
        bufferViews: [
          { buffer: 0, byteOffset: 0, byteLength: 4 },
          { buffer: 0, byteOffset: 12, byteLength: 8 },
        ],
        accessors: [
          {
            componentType: 5126,
            count: 2,
            type: 'SCALAR',
            sparse: {
              count: 2,
              indices: { bufferView: 0, componentType: 5121 },
              values: { bufferView: 1 },
            },
          },
        ],
      }, binary)
    );

    expect(report.valid).toBe(false);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'BUFFER_VIEW_OUT_OF_BOUNDS' }),
        expect.objectContaining({ code: 'SPARSE_BIN_OUT_OF_BOUNDS' }),
      ])
    );
  });
});
