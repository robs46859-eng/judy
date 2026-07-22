#!/usr/bin/env node
/**
 * Add portable Judy AR fallback clips without altering creator-authored clips.
 *
 * Browser Judy uses live Rhubarb cues and procedural body language. Native AR
 * viewers cannot receive those per-frame Three.js updates, so the deployed GLB
 * also carries talk, shiver, cool-down, and greeting loops.
 */

import fs from 'node:fs';
import path from 'node:path';

const [inputName, outputName] = process.argv.slice(2);
if (!inputName || !outputName) {
  throw new Error('Usage: node scripts/enrich-avatar-ar-clips.mjs INPUT.glb OUTPUT.glb');
}

const APP_CLIP_NAMES = new Set(['Judy_Talk', 'Judy_Shiver', 'Judy_CoolDown', 'Judy_Wave']);
const source = fs.readFileSync(inputName);
if (source.toString('ascii', 0, 4) !== 'glTF' || source.readUInt32LE(4) !== 2) {
  throw new Error('Input must be a binary glTF 2.0 file');
}

const jsonLength = source.readUInt32LE(12);
if (source.toString('ascii', 16, 20) !== 'JSON') throw new Error('GLB JSON chunk is missing');
const gltf = JSON.parse(source.toString('utf8', 20, 20 + jsonLength));
const binHeader = 20 + jsonLength;
const binLength = source.readUInt32LE(binHeader);
if (source.toString('ascii', binHeader + 4, binHeader + 8) !== 'BIN\0') {
  throw new Error('GLB binary chunk is missing');
}
let binary = Buffer.from(source.subarray(binHeader + 8, binHeader + 8 + binLength));

gltf.animations ??= [];
gltf.bufferViews ??= [];
gltf.accessors ??= [];
const existingNames = new Set(gltf.animations.map((animation) => animation.name));
const duplicates = [...APP_CLIP_NAMES].filter((name) => existingNames.has(name));
if (duplicates.length) throw new Error(`Input already contains Judy app clips: ${duplicates.join(', ')}`);

function appendFloats(values, type, count) {
  const padding = Buffer.alloc((4 - (binary.length % 4)) % 4);
  const data = Buffer.alloc(values.length * 4);
  values.forEach((value, index) => data.writeFloatLE(value, index * 4));
  const byteOffset = binary.length + padding.length;
  binary = Buffer.concat([binary, padding, data]);
  const bufferView = gltf.bufferViews.length;
  gltf.bufferViews.push({ buffer: 0, byteOffset, byteLength: data.length });
  const accessor = gltf.accessors.length;
  const next = { bufferView, byteOffset: 0, componentType: 5126, count, type };
  if (type === 'SCALAR' && count === values.length) {
    next.min = [Math.min(...values)];
    next.max = [Math.max(...values)];
  }
  gltf.accessors.push(next);
  return accessor;
}

function addClip(name, times, tracks) {
  const input = appendFloats(times, 'SCALAR', times.length);
  const samplers = [];
  const channels = [];
  for (const track of tracks) {
    const width = { SCALAR: 1, VEC3: 3, VEC4: 4 }[track.type];
    const output = appendFloats(track.values, track.type, track.values.length / width);
    const sampler = samplers.length;
    samplers.push({ input, output, interpolation: 'LINEAR' });
    channels.push({ sampler, target: { node: track.node, path: track.path } });
  }
  gltf.animations.push({ name, samplers, channels });
}

function nodeIndex(name) {
  const index = gltf.nodes.findIndex((node) => node.name === name);
  if (index < 0) throw new Error(`Required node ${name} is missing`);
  return index;
}

function multiplyQuaternion(left, right) {
  const [lx, ly, lz, lw] = left;
  const [rx, ry, rz, rw] = right;
  return [
    lw * rx + lx * rw + ly * rz - lz * ry,
    lw * ry - lx * rz + ly * rw + lz * rx,
    lw * rz + lx * ry - ly * rx + lz * rw,
    lw * rw - lx * rx - ly * ry - lz * rz,
  ];
}

function axisAngle(axis, radians) {
  const half = radians / 2;
  const scale = Math.sin(half);
  return [axis[0] * scale, axis[1] * scale, axis[2] * scale, Math.cos(half)];
}

function eulerDelta(x, y, z) {
  return [
    [[1, 0, 0], x],
    [[0, 1, 0], y],
    [[0, 0, 1], z],
  ].reduce((result, [axis, angle]) => multiplyQuaternion(result, axisAngle(axis, angle)), [0, 0, 0, 1]);
}

function rotatedKeys(name, deltas) {
  const node = gltf.nodes[nodeIndex(name)];
  const bind = node.rotation ?? [0, 0, 0, 1];
  return deltas.flatMap((delta) => multiplyQuaternion(bind, eulerDelta(...delta)));
}

const meshNode = gltf.nodes.findIndex((node) => node.mesh !== undefined);
if (meshNode < 0) throw new Error('Avatar has no mesh node');
const targetNames = gltf.meshes[gltf.nodes[meshNode].mesh].extras?.targetNames ?? [];
if (!targetNames.length) throw new Error('Avatar has no named facial morph targets');

// Some exporters write the complete [keyframe × morph-target] buffer for a
// weights track but leave accessor.count equal to keyframes. Repair that
// metadata so standards-compliant WebXR/model-viewer loaders keep all clips.
for (const animation of gltf.animations) {
  for (const channel of animation.channels ?? []) {
    if (channel.target?.path !== 'weights') continue;
    const sampler = animation.samplers[channel.sampler];
    const input = gltf.accessors[sampler.input];
    const output = gltf.accessors[sampler.output];
    const outputView = gltf.bufferViews[output.bufferView];
    const expectedCount = input.count * targetNames.length;
    const storedScalarCount = outputView.byteLength / 4;
    if (output.type === 'SCALAR' && output.count === input.count && storedScalarCount >= expectedCount) {
      output.count = expectedCount;
    }
  }
}

const talkTimes = [0, 0.1, 0.22, 0.34, 0.48, 0.62, 0.76, 0.9, 1];
const talkShapes = ['viseme_X', 'viseme_A', 'viseme_C', 'viseme_D', 'viseme_B', 'viseme_E', 'viseme_A', 'viseme_C', 'viseme_X'];
const talkWeights = talkShapes.flatMap((shape) => {
  const values = Array(targetNames.length).fill(0);
  const index = targetNames.indexOf(shape);
  if (index >= 0) values[index] = shape === 'viseme_X' ? 1 : 0.72;
  return values;
});
addClip('Judy_Talk', talkTimes, [{ node: meshNode, path: 'weights', values: talkWeights, type: 'SCALAR' }]);

const shiverTimes = Array.from({ length: 11 }, (_, index) => index / 10);
const shiverDeltas = shiverTimes.map((_, index) => [0, 0, index % 2 === 0 ? 0.018 : -0.018]);
addClip('Judy_Shiver', shiverTimes, [{
  node: nodeIndex('Spine01'), path: 'rotation', values: rotatedKeys('Spine01', shiverDeltas), type: 'VEC4',
}]);

const coolTimes = [0, 0.25, 0.5, 0.75, 1];
addClip('Judy_CoolDown', coolTimes, [
  {
    node: nodeIndex('R_Upperarm'), path: 'rotation',
    values: rotatedKeys('R_Upperarm', coolTimes.map(() => [-0.25, 0, -1.2])), type: 'VEC4',
  },
  {
    node: nodeIndex('R_Forearm'), path: 'rotation',
    values: rotatedKeys('R_Forearm', [0.25, -0.25, 0.25, -0.25, 0.25].map((wave) => [-0.75, wave, 0])), type: 'VEC4',
  },
]);

const waveTimes = [0, 0.22, 0.44, 0.66, 0.88, 1.1];
addClip('Judy_Wave', waveTimes, [
  {
    node: nodeIndex('R_Upperarm'), path: 'rotation',
    values: rotatedKeys('R_Upperarm', waveTimes.map(() => [-0.3, 0, -1.35])), type: 'VEC4',
  },
  {
    node: nodeIndex('R_Forearm'), path: 'rotation',
    values: rotatedKeys('R_Forearm', [0, 0.32, -0.32, 0.32, -0.32, 0].map((side) => [-1, side, 0])), type: 'VEC4',
  },
]);

const binaryPadding = Buffer.alloc((4 - (binary.length % 4)) % 4);
binary = Buffer.concat([binary, binaryPadding]);
gltf.buffers[0].byteLength = binary.length;
let json = Buffer.from(JSON.stringify(gltf));
json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);

const output = Buffer.alloc(12 + 8 + json.length + 8 + binary.length);
output.write('glTF', 0, 'ascii');
output.writeUInt32LE(2, 4);
output.writeUInt32LE(output.length, 8);
output.writeUInt32LE(json.length, 12);
output.write('JSON', 16, 'ascii');
json.copy(output, 20);
const outputBinHeader = 20 + json.length;
output.writeUInt32LE(binary.length, outputBinHeader);
output.write('BIN\0', outputBinHeader + 4, 'ascii');
binary.copy(output, outputBinHeader + 8);

fs.mkdirSync(path.dirname(outputName), { recursive: true });
fs.writeFileSync(outputName, output);
console.log(`Wrote ${outputName} with ${gltf.animations.length} animations (${existingNames.size} source + 4 Judy AR clips)`);
