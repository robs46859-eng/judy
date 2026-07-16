import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';

const mocks = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock('node:child_process', () => ({ spawn: mocks.spawn }));

import { buildRhubarbArgs, runRhubarb, RhubarbUnavailableError } from '../rhubarb';

describe('buildRhubarbArgs (pure)', () => {
  it('always requests JSON output and passes the wav path last', () => {
    expect(buildRhubarbArgs('/tmp/audio.wav')).toEqual(['-f', 'json', '/tmp/audio.wav']);
  });

  it('includes --dialogFile when a transcript path is given', () => {
    expect(buildRhubarbArgs('/tmp/audio.wav', { dialogFilePath: '/tmp/dialog.txt' })).toEqual([
      '-f',
      'json',
      '--dialogFile',
      '/tmp/dialog.txt',
      '/tmp/audio.wav',
    ]);
  });

  it('omits --dialogFile when no transcript path is given', () => {
    const args = buildRhubarbArgs('/tmp/audio.wav', {});
    expect(args).not.toContain('--dialogFile');
  });
});

class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = vi.fn();
}

describe('runRhubarb', () => {
  beforeEach(() => {
    mocks.spawn.mockReset();
  });

  it('resolves with parsed cues on a clean exit', async () => {
    const child = new FakeChildProcess();
    mocks.spawn.mockReturnValue(child);

    const promise = runRhubarb('/tmp/audio.wav');
    child.stdout.emit(
      'data',
      Buffer.from(JSON.stringify({ mouthCues: [{ start: 0, end: 0.1, value: 'X' }] }))
    );
    child.emit('close', 0);

    await expect(promise).resolves.toEqual([{ start: 0, end: 0.1, value: 'X' }]);
  });

  it('rejects with RhubarbUnavailableError on a non-zero exit code', async () => {
    const child = new FakeChildProcess();
    mocks.spawn.mockReturnValue(child);

    const promise = runRhubarb('/tmp/audio.wav');
    child.stderr.emit('data', Buffer.from('boom'));
    child.emit('close', 1);

    await expect(promise).rejects.toBeInstanceOf(RhubarbUnavailableError);
  });

  it('rejects with RhubarbUnavailableError when the output is not valid JSON', async () => {
    const child = new FakeChildProcess();
    mocks.spawn.mockReturnValue(child);

    const promise = runRhubarb('/tmp/audio.wav');
    child.stdout.emit('data', Buffer.from('not json'));
    child.emit('close', 0);

    await expect(promise).rejects.toBeInstanceOf(RhubarbUnavailableError);
  });

  it('rejects with RhubarbUnavailableError when spawn itself throws (binary missing)', async () => {
    mocks.spawn.mockImplementation(() => {
      throw new Error('ENOENT');
    });

    await expect(runRhubarb('/tmp/audio.wav')).rejects.toBeInstanceOf(RhubarbUnavailableError);
  });

  it('rejects with RhubarbUnavailableError on an async spawn error event', async () => {
    const child = new FakeChildProcess();
    mocks.spawn.mockReturnValue(child);

    const promise = runRhubarb('/tmp/audio.wav');
    child.emit('error', new Error('spawn failed'));

    await expect(promise).rejects.toBeInstanceOf(RhubarbUnavailableError);
  });
});
