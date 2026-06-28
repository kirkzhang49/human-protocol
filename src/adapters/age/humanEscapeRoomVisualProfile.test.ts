import { describe, it, expect } from 'vitest';
import { humanEscapeRoomVisualProfileFor } from './humanEscapeRoomVisualProfile';
import type { RawRenderPlan } from '../../render/raw-webgpu/RawWebGpuTypes';

describe('humanEscapeRoomVisualProfile - Array.isArray Guard', () => {
  const createMockPlan = (overrides?: Partial<RawRenderPlan>): RawRenderPlan => ({
    level: { id: 'test-level' },
    rooms: [],
    lightingProfiles: [],
    visibilityScenarios: [],
    geometry: { materials: [] },
    ...overrides,
  } as unknown as RawRenderPlan);

  describe('Array.isArray guard (line 36)', () => {
    it('should handle lightingProfiles as array', () => {
      const plan = createMockPlan({
        lightingProfiles: [
          {
            roomId: 'room-1',
            artist: { exposure: 1, contrast: 1, saturation: 1, warmth: 0 },
            algorithm: { localLight: 1, contact: 0.5 },
          } as unknown,
        ],
      });

      expect(() => humanEscapeRoomVisualProfileFor(plan)).not.toThrow();
    });

    it('should handle lightingProfiles as empty array', () => {
      const plan = createMockPlan({
        lightingProfiles: [],
      });

      const profile = humanEscapeRoomVisualProfileFor(plan);
      expect(profile).toBeDefined();
      expect(profile.rooms).toEqual({});
    });

    it('should handle lightingProfiles as object (non-array) without throwing', () => {
      const plan = createMockPlan({
        lightingProfiles: {} as unknown as unknown[],
      });

      expect(() => humanEscapeRoomVisualProfileFor(plan)).not.toThrow();
    });

    it('should handle lightingProfiles as null', () => {
      const plan = createMockPlan({
        lightingProfiles: null as unknown as unknown[],
      });

      expect(() => humanEscapeRoomVisualProfileFor(plan)).not.toThrow();
    });

    it('should handle lightingProfiles as undefined', () => {
      const plan = createMockPlan({
        lightingProfiles: undefined as unknown as unknown[],
      });

      expect(() => humanEscapeRoomVisualProfileFor(plan)).not.toThrow();
    });

    it('should return rooms object with valid lightingProfiles', () => {
      const plan = createMockPlan({
        lightingProfiles: [
          {
            roomId: 'room-alpha',
            artist: { exposure: 0.8, contrast: 1.1, saturation: 1, warmth: 0.2 },
            algorithm: { localLight: 1.2, contact: 0.4 },
          } as unknown,
          {
            roomId: 'room-beta',
            artist: { exposure: 1.2, contrast: 0.9, saturation: 1, warmth: -0.1 },
            algorithm: { localLight: 0.8, contact: 0.6 },
          } as unknown,
        ],
        rooms: [
          { id: 'room-alpha', mood: 'danger' } as unknown,
          { id: 'room-beta', mood: 'gallery' } as unknown,
        ] as unknown as { id: string; mood?: string }[],
      });

      const profile = humanEscapeRoomVisualProfileFor(plan);
      expect(profile.rooms).toHaveProperty('room-alpha');
      expect(profile.rooms).toHaveProperty('room-beta');
      expect(profile.rooms['room-alpha']).toHaveProperty('mood', 'danger');
      expect(profile.rooms['room-beta']).toHaveProperty('mood', 'gallery');
    });
  });
});
