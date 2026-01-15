/**
 * ============================================================
 * PARCEL STATE MACHINE VALIDATOR TESTS
 * ============================================================
 * Tests enforce PRD requirements for state transitions
 * ============================================================
 */

import { ParcelState } from '@prisma/client';
import { ParcelStateMachineValidator } from './parcel-state-machine.validator';

describe('ParcelStateMachineValidator', () => {
  describe('validateTransition', () => {
    describe('Valid transitions', () => {
      it('should allow EXPECTED → ARRIVED', () => {
        const result = ParcelStateMachineValidator.validateTransition(
          ParcelState.EXPECTED,
          ParcelState.ARRIVED,
        );
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should allow ARRIVED → STORED', () => {
        const result = ParcelStateMachineValidator.validateTransition(
          ParcelState.ARRIVED,
          ParcelState.STORED,
        );
        expect(result.valid).toBe(true);
      });

      it('should allow STORED → DELIVERY_REQUESTED', () => {
        const result = ParcelStateMachineValidator.validateTransition(
          ParcelState.STORED,
          ParcelState.DELIVERY_REQUESTED,
        );
        expect(result.valid).toBe(true);
      });

      it('should allow DELIVERY_REQUESTED → OUT_FOR_DELIVERY', () => {
        const result = ParcelStateMachineValidator.validateTransition(
          ParcelState.DELIVERY_REQUESTED,
          ParcelState.OUT_FOR_DELIVERY,
        );
        expect(result.valid).toBe(true);
      });

      it('should allow OUT_FOR_DELIVERY → DELIVERED', () => {
        const result = ParcelStateMachineValidator.validateTransition(
          ParcelState.OUT_FOR_DELIVERY,
          ParcelState.DELIVERED,
        );
        expect(result.valid).toBe(true);
      });
    });

    describe('Invalid transitions (skipping states)', () => {
      it('should reject EXPECTED → STORED (skips ARRIVED)', () => {
        const result = ParcelStateMachineValidator.validateTransition(
          ParcelState.EXPECTED,
          ParcelState.STORED,
        );
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid transition');
      });

      it('should reject ARRIVED → DELIVERY_REQUESTED (skips STORED)', () => {
        const result = ParcelStateMachineValidator.validateTransition(
          ParcelState.ARRIVED,
          ParcelState.DELIVERY_REQUESTED,
        );
        expect(result.valid).toBe(false);
      });

      it('should reject EXPECTED → DELIVERED (skips all intermediate)', () => {
        const result = ParcelStateMachineValidator.validateTransition(
          ParcelState.EXPECTED,
          ParcelState.DELIVERED,
        );
        expect(result.valid).toBe(false);
      });
    });

    describe('Invalid transitions (backwards)', () => {
      it('should reject DELIVERED → ARRIVED (backwards)', () => {
        const result = ParcelStateMachineValidator.validateTransition(
          ParcelState.DELIVERED,
          ParcelState.ARRIVED,
        );
        expect(result.valid).toBe(false);
      });

      it('should reject STORED → ARRIVED (backwards)', () => {
        const result = ParcelStateMachineValidator.validateTransition(
          ParcelState.STORED,
          ParcelState.ARRIVED,
        );
        expect(result.valid).toBe(false);
      });

      it('should reject OUT_FOR_DELIVERY → DELIVERY_REQUESTED (backwards)', () => {
        const result = ParcelStateMachineValidator.validateTransition(
          ParcelState.OUT_FOR_DELIVERY,
          ParcelState.DELIVERY_REQUESTED,
        );
        expect(result.valid).toBe(false);
      });
    });

    describe('Same state transitions', () => {
      it('should reject STORED → STORED (same state)', () => {
        const result = ParcelStateMachineValidator.validateTransition(
          ParcelState.STORED,
          ParcelState.STORED,
        );
        expect(result.valid).toBe(false);
        expect(result.error).toContain('already in');
      });

      it('should reject DELIVERED → DELIVERED', () => {
        const result = ParcelStateMachineValidator.validateTransition(
          ParcelState.DELIVERED,
          ParcelState.DELIVERED,
        );
        expect(result.valid).toBe(false);
      });
    });

    describe('Terminal state', () => {
      it('should reject any transition from DELIVERED', () => {
        const result = ParcelStateMachineValidator.validateTransition(
          ParcelState.DELIVERED,
          ParcelState.STORED,
        );
        expect(result.valid).toBe(false);
        expect(result.error).toContain('terminal state');
      });
    });

    describe('Exception handling', () => {
      it('should reject transitions when parcel has exception', () => {
        const result = ParcelStateMachineValidator.validateTransition(
          ParcelState.STORED,
          ParcelState.DELIVERY_REQUESTED,
          true, // hasException = true
        );
        expect(result.valid).toBe(false);
        expect(result.error).toContain('exception');
      });

      it('should allow transitions when parcel has no exception', () => {
        const result = ParcelStateMachineValidator.validateTransition(
          ParcelState.STORED,
          ParcelState.DELIVERY_REQUESTED,
          false, // hasException = false
        );
        expect(result.valid).toBe(true);
      });
    });

    describe('Admin overrides', () => {
      it('should allow admin to move DELIVERED → STORED', () => {
        const result = ParcelStateMachineValidator.validateTransition(
          ParcelState.DELIVERED,
          ParcelState.STORED,
          false,
          true, // isAdminOverride = true
        );
        expect(result.valid).toBe(true);
      });

      it('should allow admin to move OUT_FOR_DELIVERY → STORED', () => {
        const result = ParcelStateMachineValidator.validateTransition(
          ParcelState.OUT_FOR_DELIVERY,
          ParcelState.STORED,
          false,
          true,
        );
        expect(result.valid).toBe(true);
      });

      it('should allow admin to move DELIVERY_REQUESTED → STORED', () => {
        const result = ParcelStateMachineValidator.validateTransition(
          ParcelState.DELIVERY_REQUESTED,
          ParcelState.STORED,
          false,
          true,
        );
        expect(result.valid).toBe(true);
      });

      it('should allow admin override even with exceptions', () => {
        const result = ParcelStateMachineValidator.validateTransition(
          ParcelState.DELIVERY_REQUESTED,
          ParcelState.STORED,
          true, // hasException = true
          true, // isAdminOverride = true
        );
        expect(result.valid).toBe(true);
      });

      it('should reject admin override for invalid transitions', () => {
        const result = ParcelStateMachineValidator.validateTransition(
          ParcelState.ARRIVED,
          ParcelState.DELIVERED, // Still not allowed even for admin
          false,
          true,
        );
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('isSkippingStates', () => {
    it('should return false for adjacent states', () => {
      expect(
        ParcelStateMachineValidator.isSkippingStates(
          ParcelState.ARRIVED,
          ParcelState.STORED,
        ),
      ).toBe(false);
    });

    it('should return true when skipping one state', () => {
      expect(
        ParcelStateMachineValidator.isSkippingStates(
          ParcelState.ARRIVED,
          ParcelState.DELIVERY_REQUESTED,
        ),
      ).toBe(true);
    });

    it('should return true when skipping multiple states', () => {
      expect(
        ParcelStateMachineValidator.isSkippingStates(
          ParcelState.EXPECTED,
          ParcelState.DELIVERED,
        ),
      ).toBe(true);
    });
  });

  describe('isBackwardsTransition', () => {
    it('should return false for forward transitions', () => {
      expect(
        ParcelStateMachineValidator.isBackwardsTransition(
          ParcelState.STORED,
          ParcelState.DELIVERY_REQUESTED,
        ),
      ).toBe(false);
    });

    it('should return true for backwards transitions', () => {
      expect(
        ParcelStateMachineValidator.isBackwardsTransition(
          ParcelState.DELIVERED,
          ParcelState.STORED,
        ),
      ).toBe(true);
    });

    it('should return false for same state', () => {
      expect(
        ParcelStateMachineValidator.isBackwardsTransition(
          ParcelState.STORED,
          ParcelState.STORED,
        ),
      ).toBe(false);
    });
  });

  describe('getValidNextStates', () => {
    it('should return correct next states for EXPECTED', () => {
      const states = ParcelStateMachineValidator.getValidNextStates(
        ParcelState.EXPECTED,
      );
      expect(states).toEqual([ParcelState.ARRIVED]);
    });

    it('should return correct next states for STORED', () => {
      const states = ParcelStateMachineValidator.getValidNextStates(
        ParcelState.STORED,
      );
      expect(states).toEqual([ParcelState.DELIVERY_REQUESTED]);
    });

    it('should return empty array for DELIVERED (terminal)', () => {
      const states = ParcelStateMachineValidator.getValidNextStates(
        ParcelState.DELIVERED,
      );
      expect(states).toEqual([]);
    });

    it('should include admin overrides when isAdmin=true', () => {
      const states = ParcelStateMachineValidator.getValidNextStates(
        ParcelState.DELIVERED,
        true,
      );
      expect(states).toContain(ParcelState.STORED);
    });

    it('should not include admin overrides when isAdmin=false', () => {
      const states = ParcelStateMachineValidator.getValidNextStates(
        ParcelState.DELIVERED,
        false,
      );
      expect(states).not.toContain(ParcelState.STORED);
      expect(states).toEqual([]);
    });
  });

  describe('validateExceptionStateLock', () => {
    it('should allow any state when hasException=false', () => {
      expect(
        ParcelStateMachineValidator.validateExceptionStateLock(
          ParcelState.DELIVERED,
          false,
        ),
      ).toBe(true);
    });

    it('should reject DELIVERY_REQUESTED when hasException=true', () => {
      expect(
        ParcelStateMachineValidator.validateExceptionStateLock(
          ParcelState.DELIVERY_REQUESTED,
          true,
        ),
      ).toBe(false);
    });

    it('should reject OUT_FOR_DELIVERY when hasException=true', () => {
      expect(
        ParcelStateMachineValidator.validateExceptionStateLock(
          ParcelState.OUT_FOR_DELIVERY,
          true,
        ),
      ).toBe(false);
    });

    it('should reject DELIVERED when hasException=true', () => {
      expect(
        ParcelStateMachineValidator.validateExceptionStateLock(
          ParcelState.DELIVERED,
          true,
        ),
      ).toBe(false);
    });

    it('should allow STORED when hasException=true', () => {
      expect(
        ParcelStateMachineValidator.validateExceptionStateLock(
          ParcelState.STORED,
          true,
        ),
      ).toBe(true);
    });
  });
});
