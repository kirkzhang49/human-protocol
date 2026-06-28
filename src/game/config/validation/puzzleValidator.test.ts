import { describe, it, expect } from 'vitest';
import { validatePuzzles, validateSwitches } from './puzzleValidator';
import type { LevelDefinition, LevelPuzzleDefinition } from '../schema/levelConfig';

describe('Config Validators - Puzzle Validation', () => {
  const createMockLevel = (): LevelDefinition => ({
    id: 'test-level',
    title: 'Test Level',
    puzzles: [],
    waves: [],
    map: {
      cells: [],
      rooms: [],
      interactions: [],
      keyItems: [],
      doors: [],
      navigation: { criticalPathRoomIds: [], roomGraph: {} },
      materialsManifest: {},
      navigationMesh: { triangles: [], vertices: [] },
    },
  } as unknown as LevelDefinition);

  const createMockPuzzle = (overrides?: Partial<LevelPuzzleDefinition>): LevelPuzzleDefinition => ({
    id: 'test-puzzle',
    roomId: 'test-room',
    type: 'hitSequence',
    success: { actions: [] },
    fail: { actions: [] },
    ...overrides,
  } as unknown as LevelPuzzleDefinition);

  describe('validatePuzzles', () => {
    it('should handle level with no puzzles', () => {
      const level = createMockLevel();
      const errors: unknown[] = [];
      const warnings: unknown[] = [];

      validatePuzzles(level, errors, warnings);

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(0);
    });

    it('should detect duplicate puzzle IDs', () => {
      const level = createMockLevel();
      const puzzle1 = createMockPuzzle({ id: 'puzzle-1', roomId: 'test-room' });
      const puzzle2 = createMockPuzzle({ id: 'puzzle-1', roomId: 'test-room' });
      level.puzzles = [puzzle1, puzzle2];

      if (level.map) {
        level.map.cells = [
          {
            id: 'test-room',
            roomType: 'normal',
            doorways: [],
            visuals: {},
            displayName: 'Test Room',
          } as unknown,
        ];
      }

      const errors: unknown[] = [];
      const warnings: unknown[] = [];

      validatePuzzles(level, errors, warnings);

      const duplicateError = errors.find(
        (e: unknown) => typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === 'puzzle.duplicate'
      );
      expect(duplicateError).toBeDefined();
    });

    it('should detect missing room references', () => {
      const level = createMockLevel();
      const puzzle = createMockPuzzle({
        id: 'puzzle-1',
        roomId: 'nonexistent-room',
      });
      level.puzzles = [puzzle];

      if (level.map) {
        level.map.cells = [];
      }

      const errors: unknown[] = [];
      const warnings: unknown[] = [];

      validatePuzzles(level, errors, warnings);

      const roomError = errors.find(
        (e: unknown) => typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === 'puzzle.room.missing'
      );
      expect(roomError).toBeDefined();
    });

    it('should handle valid puzzle configuration', () => {
      const level = createMockLevel();
      const puzzle = createMockPuzzle({
        id: 'puzzle-1',
        roomId: 'test-room',
      });
      level.puzzles = [puzzle];

      if (level.map) {
        level.map.cells = [
          {
            id: 'test-room',
            roomType: 'normal',
            doorways: [],
            visuals: {},
            displayName: 'Test Room',
          } as unknown,
        ];
      }

      const errors: unknown[] = [];
      const warnings: unknown[] = [];

      expect(() => validatePuzzles(level, errors, warnings)).not.toThrow();
    });
  });

  describe('validateSwitches', () => {
    const createWallSwitchLevel = (switchCount: number, doorId = 'door-a'): LevelDefinition => ({
      ...createMockLevel(),
      map: {
        id: 'test-map',
        schemaVersion: 'hp.map.v1',
        rooms: [{ id: 'room-a' }, { id: 'room-b' }],
        doors: [{ id: doorId, fromRoomId: 'room-a', toRoomId: 'room-b', lock: { type: 'none' } }],
        interactions: Array.from({ length: switchCount }, (_, index) => ({
          id: `switch-panel-${index + 1}`,
          type: 'switch',
          roomId: 'room-a',
        })),
        keyItems: [],
        navigation: { criticalPathRoomIds: ['room-a', 'room-b'], optionalRoomIds: [], maxBacktrackSeconds: 0, mobileReadableDoorCount: 1 },
      },
      switches: Array.from({ length: switchCount }, (_, index) => ({
        id: `wall-switch-${index + 1}`,
        roomId: 'room-a',
        interactionId: `switch-panel-${index + 1}`,
        presentation: { kind: 'wall_lever' },
        wallMount: { roomId: 'room-a', side: 'east', offset: 0, height: 1.34 },
        states: [
          {
            id: 'open',
            actions: [
              { type: 'open_door', doorId },
              { type: 'close_door', doorId },
            ],
          },
        ],
      })),
    } as unknown as LevelDefinition);

    it('should reject a door controlled by more than two wall switches', () => {
      const level = createWallSwitchLevel(3);
      const errors: unknown[] = [];
      const warnings: unknown[] = [];

      validateSwitches(level, errors, warnings);

      const limitError = errors.find(
        (e: unknown) => typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === 'switch.wall.door.controllers.limit'
      );
      expect(limitError).toBeDefined();
    });

    it('should reject more than four wall switches in one level', () => {
      const level = createWallSwitchLevel(5, 'door-limit');
      const errors: unknown[] = [];
      const warnings: unknown[] = [];

      validateSwitches(level, errors, warnings);

      const countError = errors.find(
        (e: unknown) => typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === 'switch.wall.count.limit'
      );
      expect(countError).toBeDefined();
    });
  });
});
