import { describe, expect, it } from 'vitest';
import {
  classifyAvatarWeather,
  isPlatformWalkWindow,
  samplePlatformWalk,
  selectAvatarBehavior,
} from '../behavior';

describe('avatar behavior selection', () => {
  it('uses temperature and severe condition words for weather gestures', () => {
    expect(classifyAvatarWeather({ temperatureF: 35, condition: 'Clear' })).toBe('cold');
    expect(classifyAvatarWeather({ temperatureF: 90, condition: 'Sunny' })).toBe('hot');
    expect(classifyAvatarWeather({ temperatureF: 70, condition: 'Snow showers' })).toBe('cold');
    expect(classifyAvatarWeather({ temperatureF: 70, condition: 'Partly cloudy' })).toBe('comfortable');
  });

  it('keeps conversation gestures ahead of ambient weather', () => {
    expect(selectAvatarBehavior({
      phase: 'speaking', talking: true, elapsedSeconds: 16, weather: { temperatureF: 20 },
    }).gesture).toBe('talk');
    expect(selectAvatarBehavior({
      phase: 'welcoming', talking: false, elapsedSeconds: 0, weather: { temperatureF: 95 },
    })).toMatchObject({ animationName: 'Judy_Wave', gesture: 'wave' });
  });

  it('shivers, fans, and periodically walks only while idle', () => {
    expect(selectAvatarBehavior({
      phase: 'idle', talking: false, elapsedSeconds: 2, weather: { temperatureF: 40 },
    })).toMatchObject({ animationName: 'Judy_Shiver', gesture: 'shiver' });
    expect(selectAvatarBehavior({
      phase: 'idle', talking: false, elapsedSeconds: 2, weather: { temperatureF: 88 },
    })).toMatchObject({ animationName: 'Judy_CoolDown', gesture: 'fan' });
    expect(isPlatformWalkWindow(16)).toBe(true);
    expect(selectAvatarBehavior({
      phase: 'idle', talking: false, elapsedSeconds: 16, weather: { temperatureF: 70 },
    })).toMatchObject({ animationName: 'Walk_Forward_InPlace', gesture: 'walk', walking: true });
  });

  it('returns a centered, bounded path at walk boundaries', () => {
    expect(samplePlatformWalk(14)).toEqual({ x: 0, z: 0, yaw: expect.any(Number) });
    const middle = samplePlatformWalk(16.25);
    expect(Math.abs(middle.x)).toBeLessThanOrEqual(0.2);
    expect(Math.abs(middle.z)).toBeLessThanOrEqual(0.055);
    expect(samplePlatformWalk(20)).toEqual({ x: 0, z: 0, yaw: 0 });
  });

  it('disables authored motion for reduced-motion users', () => {
    expect(selectAvatarBehavior({
      phase: 'idle', talking: false, elapsedSeconds: 16, reducedMotion: true,
    })).toEqual({ animationName: 'Idle', gesture: 'idle', walking: false });
  });
});
