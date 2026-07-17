import 'server-only';

const GLB_MAGIC = 'glTF';
const GLB_VERSION = 2;
const JSON_CHUNK_TYPE = 0x4e4f534a;
const BIN_CHUNK_TYPE = 0x004e4942;
// A web avatar above this ceiling is not practical to inspect or render in Judy.
// The limit also prevents sparse accessors from requesting unbounded allocations.
const MAX_ACCESSOR_ELEMENTS = 500_000;

export const REQUIRED_VISEME_TARGETS = [
  'viseme_A',
  'viseme_B',
  'viseme_C',
  'viseme_D',
  'viseme_E',
  'viseme_F',
  'viseme_G',
  'viseme_H',
  'viseme_X',
] as const;

/** ARKit mouth controls that are useful to the avatar runtime. */
export const ARKIT_MOUTH_TARGETS = [
  'jawForward',
  'jawLeft',
  'jawRight',
  'jawOpen',
  'mouthClose',
  'mouthFunnel',
  'mouthPucker',
  'mouthLeft',
  'mouthRight',
  'mouthSmileLeft',
  'mouthSmileRight',
  'mouthFrownLeft',
  'mouthFrownRight',
  'mouthDimpleLeft',
  'mouthDimpleRight',
  'mouthStretchLeft',
  'mouthStretchRight',
  'mouthRollLower',
  'mouthRollUpper',
  'mouthShrugLower',
  'mouthShrugUpper',
  'mouthPressLeft',
  'mouthPressRight',
  'mouthLowerDownLeft',
  'mouthLowerDownRight',
  'mouthUpperUpLeft',
  'mouthUpperUpRight',
] as const;

export type LipSyncMode = 'visemes' | 'arkit' | 'jaw' | 'none';

export interface GlbInspectionMessage {
  code: string;
  message: string;
}

export interface GlbJointReport {
  skinJointIndex: number;
  nodeIndex: number;
  name: string | null;
  isJaw: boolean;
}

export interface GlbSkinReport {
  index: number;
  name: string | null;
  skeletonNodeIndex: number | null;
  joints: GlbJointReport[];
}

export interface GlbMorphTargetReport {
  meshIndex: number;
  meshName: string | null;
  primitiveIndex: number;
  targetIndex: number;
  name: string | null;
  attributes: string[];
}

export interface GlbAnimationReport {
  index: number;
  name: string | null;
  durationSeconds: number | null;
  channelCount: number;
  targetNodeNames: Array<string | null>;
  paths: string[];
}

export interface GlbInspectionReport {
  byteLength: number;
  declaredByteLength: number | null;
  glbVersion: number | null;
  assetVersion: string | null;
  generator: string | null;
  /** Serializable alias used by the upload API. */
  valid: boolean;
  structurallyValid: boolean;
  compatible: boolean;
  lipSyncMode: LipSyncMode;
  jawBones: Array<{ nodeIndex: number; name: string }>;
  jawInfluencedVertices: number;
  visemeTargets: string[];
  missingVisemeTargets: string[];
  arkitMouthTargets: string[];
  /** Unique, named morph targets exposed by the model. */
  morphTargetNames: string[];
  skins: GlbSkinReport[];
  morphTargets: GlbMorphTargetReport[];
  animations: GlbAnimationReport[];
  counts: {
    scenes: number;
    nodes: number;
    meshes: number;
    skins: number;
    animations: number;
    materials: number;
    textures: number;
    images: number;
  };
  issues: GlbInspectionMessage[];
  warnings: GlbInspectionMessage[];
}

interface GlTfAccessor {
  bufferView?: number;
  byteOffset?: number;
  componentType?: number;
  normalized?: boolean;
  count?: number;
  type?: string;
  min?: number[];
  max?: number[];
  sparse?: {
    count?: number;
    indices?: { bufferView?: number; byteOffset?: number; componentType?: number };
    values?: { bufferView?: number; byteOffset?: number };
  };
}

interface GlTfBufferView {
  buffer?: number;
  byteOffset?: number;
  byteLength?: number;
  byteStride?: number;
}

interface GlTfDocument {
  asset?: { version?: string; generator?: string };
  scene?: number;
  scenes?: Array<{ name?: string; nodes?: number[] }>;
  buffers?: Array<{ byteLength?: number; uri?: string }>;
  bufferViews?: GlTfBufferView[];
  accessors?: GlTfAccessor[];
  nodes?: Array<{
    name?: string;
    mesh?: number;
    skin?: number;
    children?: number[];
  }>;
  skins?: Array<{ name?: string; skeleton?: number; joints?: number[]; inverseBindMatrices?: number }>;
  meshes?: Array<{
    name?: string;
    extras?: { targetNames?: unknown };
    primitives?: Array<{
      attributes?: Record<string, number>;
      indices?: number;
      targets?: Array<Record<string, number>>;
      extras?: { targetNames?: unknown };
    }>;
  }>;
  animations?: Array<{
    name?: string;
    samplers?: Array<{ input?: number; output?: number }>;
    channels?: Array<{ target?: { node?: number; path?: string }; sampler?: number }>;
  }>;
  materials?: unknown[];
  textures?: unknown[];
  images?: unknown[];
}

interface Chunk {
  type: number;
  data: Buffer;
}

interface AccessorLayout {
  accessor: GlTfAccessor;
  componentType: number;
  componentSize: number;
  componentCount: number;
  elementSize: number;
  count: number;
  view: GlTfBufferView | null;
  stride: number;
  start: number;
  readable: boolean;
}

const COMPONENT_INFO: Record<number, { size: number; read: (buffer: Buffer, offset: number) => number }> = {
  5120: { size: 1, read: (buffer, offset) => buffer.readInt8(offset) },
  5121: { size: 1, read: (buffer, offset) => buffer.readUInt8(offset) },
  5122: { size: 2, read: (buffer, offset) => buffer.readInt16LE(offset) },
  5123: { size: 2, read: (buffer, offset) => buffer.readUInt16LE(offset) },
  5125: { size: 4, read: (buffer, offset) => buffer.readUInt32LE(offset) },
  5126: { size: 4, read: (buffer, offset) => buffer.readFloatLE(offset) },
};

const TYPE_COMPONENTS: Record<string, number> = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
};

function emptyReport(byteLength: number): GlbInspectionReport {
  return {
    byteLength,
    declaredByteLength: null,
    glbVersion: null,
    assetVersion: null,
    generator: null,
    valid: false,
    structurallyValid: false,
    compatible: false,
    lipSyncMode: 'none',
    jawBones: [],
    jawInfluencedVertices: 0,
    visemeTargets: [],
    missingVisemeTargets: [...REQUIRED_VISEME_TARGETS],
    arkitMouthTargets: [],
    morphTargetNames: [],
    skins: [],
    morphTargets: [],
    animations: [],
    counts: {
      scenes: 0,
      nodes: 0,
      meshes: 0,
      skins: 0,
      animations: 0,
      materials: 0,
      textures: 0,
      images: 0,
    },
    issues: [],
    warnings: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function integer(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : fallback;
}

function jawBoneName(name: string): boolean {
  const normalized = name
    .normalize('NFKC')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .toLowerCase();
  return /(?:^|\s)(?:jaw|mandible)(?:\s|$)/u.test(normalized);
}

function targetNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((name) => (typeof name === 'string' ? name : ''));
}

function matrixElementSize(type: string, componentSize: number, componentCount: number): number {
  if (type === 'MAT2' && componentSize === 1) return 8;
  if (type === 'MAT3' && componentSize === 1) return 12;
  if (type === 'MAT3' && componentSize === 2) return 24;
  return componentSize * componentCount;
}

function normalizedValue(value: number, componentType: number): number {
  switch (componentType) {
    case 5120:
      return Math.max(value / 127, -1);
    case 5121:
      return value / 255;
    case 5122:
      return Math.max(value / 32767, -1);
    case 5123:
      return value / 65535;
    case 5125:
      return value / 4294967295;
    default:
      return value;
  }
}

function rangeFits(offset: number, byteLength: number, containerLength: number): boolean {
  return (
    Number.isSafeInteger(offset) &&
    Number.isSafeInteger(byteLength) &&
    Number.isSafeInteger(containerLength) &&
    offset >= 0 &&
    byteLength >= 0 &&
    containerLength >= 0 &&
    offset <= containerLength &&
    byteLength <= containerLength - offset
  );
}

/**
 * Inspects a binary glTF entirely in memory. It never writes the asset or its
 * embedded data to disk, and returns messages rather than throwing for an
 * untrusted/malformed upload.
 */
export function inspectGlb(buffer: Buffer): GlbInspectionReport {
  const report = emptyReport(buffer.length);
  const structuralIssues: GlbInspectionMessage[] = [];
  const issueKeys = new Set<string>();
  const warningKeys = new Set<string>();

  const issue = (code: string, message: string) => {
    const key = `${code}:${message}`;
    if (issueKeys.has(key)) return;
    issueKeys.add(key);
    const entry = { code, message };
    structuralIssues.push(entry);
    report.issues.push(entry);
  };
  const warning = (code: string, message: string) => {
    const key = `${code}:${message}`;
    if (warningKeys.has(key)) return;
    warningKeys.add(key);
    report.warnings.push({ code, message });
  };

  if (buffer.length < 12) {
    issue('GLB_HEADER_TRUNCATED', 'The file is too short to contain a GLB header.');
    return report;
  }

  if (buffer.toString('ascii', 0, 4) !== GLB_MAGIC) {
    issue('INVALID_GLB_MAGIC', 'The file does not begin with the glTF binary magic value.');
  }
  report.glbVersion = buffer.readUInt32LE(4);
  if (report.glbVersion !== GLB_VERSION) {
    issue('UNSUPPORTED_GLB_VERSION', `Expected GLB version 2, received ${report.glbVersion}.`);
  }

  report.declaredByteLength = buffer.readUInt32LE(8);
  if (report.declaredByteLength !== buffer.length) {
    issue(
      'GLB_LENGTH_MISMATCH',
      `The GLB declares ${report.declaredByteLength} bytes but contains ${buffer.length}.`
    );
  }

  const chunks: Chunk[] = [];
  let cursor = 12;
  while (cursor < buffer.length) {
    if (cursor + 8 > buffer.length) {
      issue('CHUNK_HEADER_TRUNCATED', `The chunk header at byte ${cursor} is truncated.`);
      break;
    }
    const byteLength = buffer.readUInt32LE(cursor);
    const type = buffer.readUInt32LE(cursor + 4);
    const dataStart = cursor + 8;
    const dataEnd = dataStart + byteLength;
    if (byteLength % 4 !== 0) {
      issue('CHUNK_ALIGNMENT_INVALID', `The chunk at byte ${cursor} is not four-byte aligned.`);
    }
    if (dataEnd > buffer.length) {
      issue('CHUNK_OUT_OF_BOUNDS', `The chunk at byte ${cursor} extends beyond the file.`);
      break;
    }
    chunks.push({ type, data: buffer.subarray(dataStart, dataEnd) });
    cursor = dataEnd;
  }

  if (chunks.length === 0 || chunks[0].type !== JSON_CHUNK_TYPE) {
    issue('JSON_CHUNK_MISSING', 'A GLB 2.0 file must begin with a JSON chunk.');
    return report;
  }
  const binaryChunks = chunks.filter((chunk) => chunk.type === BIN_CHUNK_TYPE);
  if (binaryChunks.length > 1) {
    issue('MULTIPLE_BIN_CHUNKS', 'A GLB may contain at most one binary chunk.');
  }
  const bin = binaryChunks[0]?.data ?? null;
  for (const chunk of chunks.slice(1)) {
    if (chunk.type !== BIN_CHUNK_TYPE) {
      warning('UNKNOWN_CHUNK', `Ignoring unknown GLB chunk type 0x${chunk.type.toString(16)}.`);
    }
  }

  let document: GlTfDocument;
  try {
    const parsed: unknown = JSON.parse(chunks[0].data.toString('utf8').replace(/[\u0000\u0020]+$/u, ''));
    if (!isRecord(parsed)) throw new Error('JSON root is not an object');
    document = parsed as GlTfDocument;
  } catch {
    issue('JSON_CHUNK_INVALID', 'The GLB JSON chunk could not be parsed as an object.');
    return report;
  }

  const valueList = <T>(value: unknown, label: string): T[] => {
    if (value === undefined) return [];
    if (!Array.isArray(value)) {
      issue('GLTF_ARRAY_INVALID', `${label} must be an array.`);
      return [];
    }
    return value as T[];
  };
  const objectList = <T>(value: unknown, label: string): T[] =>
    valueList<unknown>(value, label).map((entry, index) => {
      if (!isRecord(entry)) {
        issue('GLTF_OBJECT_INVALID', `${label}[${index}] must be an object.`);
        return {} as T;
      }
      return entry as T;
    });

  report.assetVersion = typeof document.asset?.version === 'string' ? document.asset.version : null;
  report.generator = typeof document.asset?.generator === 'string' ? document.asset.generator : null;
  if (report.assetVersion !== '2.0') {
    issue('INVALID_ASSET_VERSION', 'The glTF asset version must be 2.0.');
  }

  const scenes = objectList<NonNullable<GlTfDocument['scenes']>[number]>(document.scenes, 'scenes');
  const nodes = objectList<NonNullable<GlTfDocument['nodes']>[number]>(document.nodes, 'nodes');
  const meshes = objectList<NonNullable<GlTfDocument['meshes']>[number]>(document.meshes, 'meshes');
  const skins = objectList<NonNullable<GlTfDocument['skins']>[number]>(document.skins, 'skins');
  const animations = objectList<NonNullable<GlTfDocument['animations']>[number]>(
    document.animations,
    'animations'
  );
  const accessors = objectList<GlTfAccessor>(document.accessors, 'accessors');
  const bufferViews = objectList<GlTfBufferView>(document.bufferViews, 'bufferViews');
  const buffers = objectList<NonNullable<GlTfDocument['buffers']>[number]>(document.buffers, 'buffers');
  const materials = valueList<unknown>(document.materials, 'materials');
  const textures = valueList<unknown>(document.textures, 'textures');
  const images = valueList<unknown>(document.images, 'images');
  const hasAccessor = (index: unknown): index is number =>
    typeof index === 'number' && Number.isSafeInteger(index) && index >= 0 && index < accessors.length;
  report.counts = {
    scenes: scenes.length,
    nodes: nodes.length,
    meshes: meshes.length,
    skins: skins.length,
    animations: animations.length,
    materials: materials.length,
    textures: textures.length,
    images: images.length,
  };

  if (document.scene !== undefined && (!Number.isInteger(document.scene) || !scenes[document.scene])) {
    issue('DEFAULT_SCENE_INVALID', 'The default scene index does not reference an existing scene.');
  }
  scenes.forEach((scene, sceneIndex) => {
    for (const nodeIndex of valueList<number>(scene.nodes, `scenes[${sceneIndex}].nodes`)) {
      if (!Number.isInteger(nodeIndex) || !nodes[nodeIndex]) {
        issue('SCENE_NODE_INVALID', `Scene ${sceneIndex} references missing node ${nodeIndex}.`);
      }
    }
  });
  nodes.forEach((node, nodeIndex) => {
    for (const childIndex of valueList<number>(node.children, `nodes[${nodeIndex}].children`)) {
      if (!Number.isInteger(childIndex) || !nodes[childIndex]) {
        issue('NODE_CHILD_INVALID', `Node ${nodeIndex} references missing child ${childIndex}.`);
      }
    }
    if (node.mesh !== undefined && (!Number.isInteger(node.mesh) || !meshes[node.mesh])) {
      issue('NODE_MESH_INVALID', `Node ${nodeIndex} references missing mesh ${node.mesh}.`);
    }
    if (node.skin !== undefined && (!Number.isInteger(node.skin) || !skins[node.skin])) {
      issue('NODE_SKIN_INVALID', `Node ${nodeIndex} references missing skin ${node.skin}.`);
    }
  });

  const declaredBufferLength = integer(buffers[0]?.byteLength, -1);
  if (bufferViews.length > 0 && buffers.length === 0) {
    issue('BUFFER_MISSING', 'Buffer views exist but the glTF declares no buffers.');
  }
  if (buffers.length > 1) {
    issue('MULTIPLE_BUFFERS_UNSUPPORTED', 'Uploaded avatars must use a single embedded GLB buffer.');
  }
  if (buffers.some((declaredBuffer) => typeof declaredBuffer.uri === 'string')) {
    issue('EXTERNAL_BUFFER_UNSUPPORTED', 'Uploaded avatars must embed buffer data in the GLB binary chunk.');
  }
  if (declaredBufferLength >= 0) {
    if (!bin && declaredBufferLength > 0) {
      issue('BIN_CHUNK_MISSING', 'The glTF declares binary data but the GLB has no BIN chunk.');
    } else if (bin && declaredBufferLength > bin.length) {
      issue('BIN_CHUNK_TOO_SHORT', 'The BIN chunk is shorter than the declared glTF buffer.');
    } else if (bin && bin.length - declaredBufferLength > 3) {
      issue('BIN_CHUNK_PADDING_INVALID', 'The BIN chunk contains more than three padding bytes.');
    }
  }

  bufferViews.forEach((view, viewIndex) => {
    const bufferIndex = integer(view.buffer, -1);
    const byteOffset = integer(view.byteOffset, 0);
    const byteLength = integer(view.byteLength, -1);
    if (bufferIndex < 0 || !buffers[bufferIndex]) {
      issue('BUFFER_VIEW_BUFFER_INVALID', `Buffer view ${viewIndex} references a missing buffer.`);
      return;
    }
    if (byteOffset < 0 || byteLength < 0) {
      issue('BUFFER_VIEW_RANGE_INVALID', `Buffer view ${viewIndex} has an invalid byte range.`);
      return;
    }
    const parentLength = integer(buffers[bufferIndex]?.byteLength, -1);
    if (parentLength >= 0 && !rangeFits(byteOffset, byteLength, parentLength)) {
      issue('BUFFER_VIEW_OUT_OF_BOUNDS', `Buffer view ${viewIndex} exceeds its declared buffer.`);
    }
    if (bufferIndex === 0 && bin && !rangeFits(byteOffset, byteLength, bin.length)) {
      issue('BUFFER_VIEW_OUT_OF_BOUNDS', `Buffer view ${viewIndex} exceeds the GLB BIN chunk.`);
    }
    if (view.byteStride !== undefined) {
      const stride = integer(view.byteStride, -1);
      if (stride < 4 || stride > 252 || stride % 4 !== 0) {
        issue('BUFFER_VIEW_STRIDE_INVALID', `Buffer view ${viewIndex} has invalid byteStride ${view.byteStride}.`);
      }
    }
  });

  const layouts: Array<AccessorLayout | null> = accessors.map((accessor, accessorIndex) => {
    const componentType = integer(accessor.componentType, -1);
    const component = COMPONENT_INFO[componentType];
    const componentCount =
      typeof accessor.type === 'string' && Object.hasOwn(TYPE_COMPONENTS, accessor.type)
        ? TYPE_COMPONENTS[accessor.type]
        : undefined;
    const count = integer(accessor.count, -1);
    if (!component) {
      issue('ACCESSOR_COMPONENT_TYPE_INVALID', `Accessor ${accessorIndex} has an invalid component type.`);
    }
    if (!componentCount) {
      issue('ACCESSOR_TYPE_INVALID', `Accessor ${accessorIndex} has an invalid element type.`);
    }
    if (count <= 0) {
      issue('ACCESSOR_COUNT_INVALID', `Accessor ${accessorIndex} has an invalid count.`);
    }
    if (count > MAX_ACCESSOR_ELEMENTS) {
      issue(
        'ACCESSOR_COUNT_LIMIT',
        `Accessor ${accessorIndex} exceeds the ${MAX_ACCESSOR_ELEMENTS.toLocaleString('en-US')} element upload limit.`
      );
    }
    if (!component || !componentCount || count <= 0 || count > MAX_ACCESSOR_ELEMENTS) return null;

    const elementSize = matrixElementSize(accessor.type!, component.size, componentCount);
    if (accessor.bufferView === undefined) {
      if (!accessor.sparse) {
        issue('ACCESSOR_DATA_MISSING', `Accessor ${accessorIndex} has neither a buffer view nor sparse data.`);
      }
      return {
        accessor,
        componentType,
        componentSize: component.size,
        componentCount,
        elementSize,
        count,
        view: null,
        stride: elementSize,
        start: 0,
        readable: Boolean(bin),
      };
    }

    const bufferViewIndex = integer(accessor.bufferView, -1);
    const view = bufferViews[bufferViewIndex];
    if (!view) {
      issue('ACCESSOR_BUFFER_VIEW_INVALID', `Accessor ${accessorIndex} references a missing buffer view.`);
      return null;
    }
    const accessorOffset = integer(accessor.byteOffset, 0);
    const viewOffset = integer(view.byteOffset, 0);
    const viewLength = integer(view.byteLength, -1);
    const stride = view.byteStride === undefined ? elementSize : integer(view.byteStride, -1);
    if (accessorOffset < 0 || accessorOffset % component.size !== 0) {
      issue('ACCESSOR_OFFSET_INVALID', `Accessor ${accessorIndex} has an invalid byte offset.`);
    }
    if (stride < elementSize || stride % component.size !== 0) {
      issue('ACCESSOR_STRIDE_INVALID', `Accessor ${accessorIndex} has an invalid element stride.`);
    }
    const usedBytes = (count - 1) * stride + elementSize;
    if (!Number.isSafeInteger(usedBytes) || !rangeFits(accessorOffset, usedBytes, viewLength)) {
      issue('ACCESSOR_OUT_OF_BOUNDS', `Accessor ${accessorIndex} exceeds buffer view ${accessor.bufferView}.`);
    }
    const bufferIndex = integer(view.buffer, -1);
    const start = viewOffset + accessorOffset;
    const readable = Boolean(
      bin &&
        bufferIndex === 0 &&
        Number.isSafeInteger(start) &&
        rangeFits(start, usedBytes, bin.length)
    );
    return {
      accessor,
      componentType,
      componentSize: component.size,
      componentCount,
      elementSize,
      count,
      view,
      stride,
      start,
      readable,
    };
  });

  const validateSparse = (accessor: GlTfAccessor, accessorIndex: number) => {
    const sparse = accessor.sparse;
    if (!sparse) return;
    const sparseCount = integer(sparse.count, -1);
    const accessorCount = integer(accessor.count, -1);
    if (sparseCount <= 0 || sparseCount > accessorCount || sparseCount > MAX_ACCESSOR_ELEMENTS) {
      issue('SPARSE_COUNT_INVALID', `Accessor ${accessorIndex} has an invalid sparse count.`);
      return;
    }
    const indexType = integer(sparse.indices?.componentType, -1);
    const indexComponent = COMPONENT_INFO[indexType];
    if (![5121, 5123, 5125].includes(indexType) || !indexComponent) {
      issue('SPARSE_INDEX_TYPE_INVALID', `Accessor ${accessorIndex} has an invalid sparse index type.`);
      return;
    }
    const indicesViewIndex = integer(sparse.indices?.bufferView, -1);
    const valuesViewIndex = integer(sparse.values?.bufferView, -1);
    const indicesView = bufferViews[indicesViewIndex];
    const valuesView = bufferViews[valuesViewIndex];
    if (!indicesView || !valuesView) {
      issue('SPARSE_BUFFER_VIEW_INVALID', `Accessor ${accessorIndex} references a missing sparse buffer view.`);
      return;
    }
    const indexOffset = integer(sparse.indices?.byteOffset, 0);
    const valueOffset = integer(sparse.values?.byteOffset, 0);
    const layout = layouts[accessorIndex];
    const indicesViewLength = integer(indicesView.byteLength, -1);
    const valuesViewLength = integer(valuesView.byteLength, -1);
    const indicesBytes = sparseCount * indexComponent.size;
    const valuesBytes = layout ? sparseCount * layout.elementSize : -1;
    if (
      !layout ||
      indexOffset % indexComponent.size !== 0 ||
      valueOffset % layout.componentSize !== 0 ||
      !Number.isSafeInteger(indicesBytes) ||
      !Number.isSafeInteger(valuesBytes) ||
      !rangeFits(indexOffset, indicesBytes, indicesViewLength) ||
      !rangeFits(valueOffset, valuesBytes, valuesViewLength)
    ) {
      issue('SPARSE_DATA_OUT_OF_BOUNDS', `Accessor ${accessorIndex} sparse data exceeds its buffer view.`);
    }
    const indicesStart = integer(indicesView.byteOffset, -1) + indexOffset;
    const valuesStart = integer(valuesView.byteOffset, -1) + valueOffset;
    if (
      integer(indicesView.buffer, -1) !== 0 ||
      integer(valuesView.buffer, -1) !== 0 ||
      !bin ||
      !rangeFits(indicesStart, indicesBytes, bin.length) ||
      !rangeFits(valuesStart, valuesBytes, bin.length)
    ) {
      issue('SPARSE_BIN_OUT_OF_BOUNDS', `Accessor ${accessorIndex} sparse data is not readable from the GLB BIN chunk.`);
    }
  };
  accessors.forEach(validateSparse);

  const readAccessor = (accessorIndex: number, applyNormalization = true): number[][] | null => {
    const layout = layouts[accessorIndex];
    if (!layout || !bin) return null;
    if (layout.view && !layout.readable) return null;
    const values = Array.from({ length: layout.count }, () =>
      Array.from({ length: layout.componentCount }, () => 0)
    );
    const component = COMPONENT_INFO[layout.componentType];
    if (layout.view) {
      for (let row = 0; row < layout.count; row += 1) {
        for (let column = 0; column < layout.componentCount; column += 1) {
          const raw = component.read(bin, layout.start + row * layout.stride + column * layout.componentSize);
          values[row][column] =
            applyNormalization && layout.accessor.normalized
              ? normalizedValue(raw, layout.componentType)
              : raw;
        }
      }
    }

    const sparse = layout.accessor.sparse;
    if (!sparse) return values;
    const sparseCount = integer(sparse.count, -1);
    const indexType = integer(sparse.indices?.componentType, -1);
    const indexComponent = COMPONENT_INFO[indexType];
    const indexView = bufferViews[integer(sparse.indices?.bufferView, -1)];
    const valuesView = bufferViews[integer(sparse.values?.bufferView, -1)];
    if (sparseCount < 0 || !indexComponent || !indexView || !valuesView) return null;
    if (integer(indexView.buffer, -1) !== 0 || integer(valuesView.buffer, -1) !== 0) return null;
    const indexStart = integer(indexView.byteOffset, 0) + integer(sparse.indices?.byteOffset, 0);
    const valuesStart = integer(valuesView.byteOffset, 0) + integer(sparse.values?.byteOffset, 0);
    const indicesBytes = sparseCount * indexComponent.size;
    const valuesBytes = sparseCount * layout.elementSize;
    if (
      !rangeFits(indexStart, indicesBytes, bin.length) ||
      !rangeFits(valuesStart, valuesBytes, bin.length)
    ) {
      return null;
    }
    let previousDestination = -1;
    for (let sparseRow = 0; sparseRow < sparseCount; sparseRow += 1) {
      const destination = indexComponent.read(bin, indexStart + sparseRow * indexComponent.size);
      if (!values[destination] || destination <= previousDestination) {
        issue('SPARSE_INDEX_INVALID', `Accessor ${accessorIndex} has an invalid sparse index sequence.`);
        return null;
      }
      previousDestination = destination;
      for (let column = 0; column < layout.componentCount; column += 1) {
        const raw = component.read(
          bin,
          valuesStart + sparseRow * layout.elementSize + column * layout.componentSize
        );
        values[destination][column] =
          applyNormalization && layout.accessor.normalized
            ? normalizedValue(raw, layout.componentType)
            : raw;
      }
    }
    return values;
  };

  const jawNodeIndexes = new Set<number>();
  report.skins = skins.map((skin, skinIndex) => {
    const joints = valueList<number>(skin.joints, `skins[${skinIndex}].joints`).map(
      (nodeIndex, skinJointIndex): GlbJointReport => {
      const node = Number.isSafeInteger(nodeIndex) ? nodes[nodeIndex] : undefined;
      if (!Number.isSafeInteger(nodeIndex) || nodeIndex < 0 || !node) {
        issue('SKIN_JOINT_INVALID', `Skin ${skinIndex} references missing node ${nodeIndex}.`);
      }
      const name = typeof node?.name === 'string' ? node.name : null;
      const isJaw = name !== null && jawBoneName(name);
      if (isJaw) jawNodeIndexes.add(nodeIndex);
      return { skinJointIndex, nodeIndex, name, isJaw };
      }
    );
    if (skin.skeleton !== undefined && (!Number.isInteger(skin.skeleton) || !nodes[skin.skeleton])) {
      issue('SKIN_SKELETON_INVALID', `Skin ${skinIndex} references a missing skeleton node.`);
    }
    if (skin.inverseBindMatrices !== undefined && !hasAccessor(skin.inverseBindMatrices)) {
      issue('INVERSE_BIND_ACCESSOR_INVALID', `Skin ${skinIndex} references missing inverse bind matrices.`);
    }
    return {
      index: skinIndex,
      name: typeof skin.name === 'string' ? skin.name : null,
      skeletonNodeIndex: skin.skeleton ?? null,
      joints,
    };
  });
  report.jawBones = [...jawNodeIndexes]
    .sort((a, b) => a - b)
    .map((nodeIndex) => ({ nodeIndex, name: nodes[nodeIndex]?.name ?? `node-${nodeIndex}` }));

  meshes.forEach((mesh, meshIndex) => {
    const meshNames = targetNames(mesh.extras?.targetNames);
    objectList<NonNullable<NonNullable<GlTfDocument['meshes']>[number]['primitives']>[number]>(
      mesh.primitives,
      `meshes[${meshIndex}].primitives`
    ).forEach((primitive, primitiveIndex) => {
      const primitiveNames = targetNames(primitive.extras?.targetNames);
      objectList<Record<string, number>>(
        primitive.targets,
        `meshes[${meshIndex}].primitives[${primitiveIndex}].targets`
      ).forEach((attributes, targetIndex) => {
        const name = meshNames[targetIndex] || primitiveNames[targetIndex] || null;
        report.morphTargets.push({
          meshIndex,
          meshName: typeof mesh.name === 'string' ? mesh.name : null,
          primitiveIndex,
          targetIndex,
          name,
          attributes: Object.keys(attributes).sort(),
        });
        for (const accessorIndex of Object.values(attributes)) {
          if (!hasAccessor(accessorIndex)) {
            issue(
              'MORPH_ACCESSOR_INVALID',
              `Mesh ${meshIndex} morph target ${targetIndex} references a missing accessor.`
            );
          }
        }
      });
      for (const accessorIndex of Object.values(primitive.attributes ?? {})) {
        if (!hasAccessor(accessorIndex)) {
          issue('ATTRIBUTE_ACCESSOR_INVALID', `Mesh ${meshIndex} references a missing attribute accessor.`);
        }
      }
      if (primitive.indices !== undefined && !hasAccessor(primitive.indices)) {
        issue('INDEX_ACCESSOR_INVALID', `Mesh ${meshIndex} references a missing index accessor.`);
      }
    });
  });

  const morphNames = [
    ...new Set(
      report.morphTargets.map((target) => target.name).filter((name): name is string => Boolean(name))
    ),
  ];
  report.morphTargetNames = morphNames;
  const morphNamesByLowercase = new Map(morphNames.map((name) => [name.toLowerCase(), name]));
  report.visemeTargets = REQUIRED_VISEME_TARGETS.map((required) =>
    morphNamesByLowercase.get(required.toLowerCase())
  ).filter((name): name is string => Boolean(name));
  report.missingVisemeTargets = REQUIRED_VISEME_TARGETS.filter(
    (required) => !morphNamesByLowercase.has(required.toLowerCase())
  );
  const arkitNamesByLowercase = new Map(ARKIT_MOUTH_TARGETS.map((name) => [name.toLowerCase(), name]));
  report.arkitMouthTargets = morphNames.filter((name) => arkitNamesByLowercase.has(name.toLowerCase()));

  const countedUsages = new Set<string>();
  nodes.forEach((node) => {
    if (node.mesh === undefined || node.skin === undefined) return;
    const mesh = meshes[node.mesh];
    const skin = report.skins[node.skin];
    if (!mesh || !skin) return;
    const jawJointSlots = new Set(
      skin.joints.filter((joint) => joint.isJaw).map((joint) => joint.skinJointIndex)
    );
    if (jawJointSlots.size === 0) return;

    objectList<NonNullable<NonNullable<GlTfDocument['meshes']>[number]['primitives']>[number]>(
      mesh.primitives,
      `meshes[${node.mesh}].primitives`
    ).forEach((primitive, primitiveIndex) => {
      const usageKey = `${node.skin}:${node.mesh}:${primitiveIndex}`;
      if (countedUsages.has(usageKey)) return;
      countedUsages.add(usageKey);
      const jointsIndex = primitive.attributes?.JOINTS_0;
      const weightsIndex = primitive.attributes?.WEIGHTS_0;
      if (jointsIndex === undefined || weightsIndex === undefined) {
        issue(
          'SKIN_ATTRIBUTES_MISSING',
          `Mesh ${node.mesh} primitive ${primitiveIndex} lacks JOINTS_0 or WEIGHTS_0.`
        );
        return;
      }
      if (!hasAccessor(jointsIndex) || !hasAccessor(weightsIndex)) {
        issue('SKIN_ACCESSOR_INVALID', `Mesh ${node.mesh} has missing joint or weight accessors.`);
        return;
      }
      const jointAccessor = accessors[jointsIndex];
      const weightAccessor = accessors[weightsIndex];
      if (jointAccessor?.type !== 'VEC4' || ![5121, 5123].includes(integer(jointAccessor?.componentType, -1))) {
        issue('JOINT_ACCESSOR_INVALID', `Mesh ${node.mesh} has an invalid JOINTS_0 accessor.`);
        return;
      }
      if (
        weightAccessor?.type !== 'VEC4' ||
        ![5121, 5123, 5126].includes(integer(weightAccessor?.componentType, -1))
      ) {
        issue('WEIGHT_ACCESSOR_INVALID', `Mesh ${node.mesh} has an invalid WEIGHTS_0 accessor.`);
        return;
      }
      if (weightAccessor.componentType !== 5126 && weightAccessor.normalized !== true) {
        issue('WEIGHTS_NOT_NORMALIZED', `Mesh ${node.mesh} integer WEIGHTS_0 must be normalized.`);
      }
      const jointRows = readAccessor(jointsIndex, false);
      const weightRows = readAccessor(weightsIndex, true);
      if (!jointRows || !weightRows) return;
      if (jointRows.length !== weightRows.length) {
        issue('SKIN_ATTRIBUTE_COUNT_MISMATCH', `Mesh ${node.mesh} has mismatched joint and weight counts.`);
        return;
      }
      const positionIndex = primitive.attributes?.POSITION;
      if (
        hasAccessor(positionIndex) &&
        integer(accessors[positionIndex].count, -1) !== jointRows.length
      ) {
        issue('SKIN_POSITION_COUNT_MISMATCH', `Mesh ${node.mesh} skin data does not match its vertex count.`);
        return;
      }
      for (let vertex = 0; vertex < jointRows.length; vertex += 1) {
        let influenced = false;
        for (let channel = 0; channel < 4; channel += 1) {
          if (jawJointSlots.has(jointRows[vertex][channel]) && weightRows[vertex][channel] > 0) {
            influenced = true;
            break;
          }
        }
        if (influenced) report.jawInfluencedVertices += 1;
      }
    });
  });

  report.animations = animations.map((animation, animationIndex) => {
    let durationSeconds: number | null = null;
    const samplers = objectList<
      NonNullable<NonNullable<GlTfDocument['animations']>[number]['samplers']>[number]
    >(animation.samplers, `animations[${animationIndex}].samplers`);
    const channels = objectList<
      NonNullable<NonNullable<GlTfDocument['animations']>[number]['channels']>[number]
    >(animation.channels, `animations[${animationIndex}].channels`);
    for (const sampler of samplers) {
      if (!hasAccessor(sampler.input)) {
        issue('ANIMATION_INPUT_INVALID', `Animation ${animationIndex} references a missing input accessor.`);
        continue;
      }
      const accessor = accessors[sampler.input];
      const max = accessor.max?.[0];
      if (typeof max === 'number' && Number.isFinite(max)) {
        durationSeconds = Math.max(durationSeconds ?? 0, max);
      } else {
        const rows = readAccessor(sampler.input);
        if (rows) {
          for (const row of rows) {
            if (Number.isFinite(row[0])) durationSeconds = Math.max(durationSeconds ?? 0, row[0]);
          }
        }
      }
      if (!hasAccessor(sampler.output)) {
        issue('ANIMATION_OUTPUT_INVALID', `Animation ${animationIndex} references a missing output accessor.`);
      }
    }
    const targetNodeNames = [
      ...new Set(
        channels.map((channel) => {
          const nodeIndex = channel.target?.node;
          if (nodeIndex === undefined) return null;
          if (!nodes[nodeIndex]) {
            issue('ANIMATION_NODE_INVALID', `Animation ${animationIndex} references missing node ${nodeIndex}.`);
            return null;
          }
          return nodes[nodeIndex].name ?? null;
        })
      ),
    ];
    const paths = [
      ...new Set(
        channels
          .map((channel) => channel.target?.path)
          .filter((path): path is string => typeof path === 'string')
      ),
    ];
    channels.forEach((channel, channelIndex) => {
      const samplerIndex = integer(channel.sampler, -1);
      if (samplerIndex < 0 || !samplers[samplerIndex]) {
        issue(
          'ANIMATION_SAMPLER_INVALID',
          `Animation ${animationIndex} channel ${channelIndex} references a missing sampler.`
        );
      }
      const path = channel.target?.path;
      if (path !== undefined && !['translation', 'rotation', 'scale', 'weights', 'pointer'].includes(path)) {
        issue(
          'ANIMATION_PATH_INVALID',
          `Animation ${animationIndex} channel ${channelIndex} has an invalid target path.`
        );
      }
    });
    return {
      index: animationIndex,
      name: typeof animation.name === 'string' ? animation.name : null,
      durationSeconds,
      channelCount: channels.length,
      targetNodeNames,
      paths,
    };
  });

  report.structurallyValid = structuralIssues.length === 0;
  report.valid = report.structurallyValid;

  const hasCompleteVisemeSet = report.missingVisemeTargets.length === 0;
  const hasJawOpen = report.arkitMouthTargets.some((name) => name.toLowerCase() === 'jawopen');
  if (hasCompleteVisemeSet) {
    report.lipSyncMode = 'visemes';
  } else if (hasJawOpen) {
    report.lipSyncMode = 'arkit';
  } else if (report.jawInfluencedVertices > 0) {
    report.lipSyncMode = 'jaw';
  }

  if (report.visemeTargets.length > 0 && !hasCompleteVisemeSet) {
    warning(
      'PARTIAL_VISEME_SET',
      `The model is missing ${report.missingVisemeTargets.join(', ')} from the Rhubarb viseme set.`
    );
  }
  if (report.arkitMouthTargets.length > 0 && !hasJawOpen) {
    warning('ARKIT_JAW_OPEN_MISSING', 'ARKit mouth targets are present, but jawOpen is missing.');
  }
  if (report.jawBones.length > 0 && report.jawInfluencedVertices === 0) {
    const entry = {
      code: 'JAW_UNWEIGHTED',
      message: 'A jaw bone exists, but no vertices have a nonzero weight for it.',
    };
    if (report.lipSyncMode === 'none') report.issues.push(entry);
    else report.warnings.push(entry);
  }
  if (report.lipSyncMode === 'none' && report.jawBones.length === 0) {
    report.issues.push({
      code: 'LIP_SYNC_CONTROLS_MISSING',
      message: 'No complete viseme set, usable ARKit jaw target, or weighted jaw bone was found.',
    });
  }

  report.compatible = report.structurallyValid && report.lipSyncMode !== 'none';
  return report;
}
