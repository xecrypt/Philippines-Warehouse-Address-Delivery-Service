/**
 * ============================================================
 * PARCEL STATE MACHINE VALIDATOR
 * ============================================================
 * PRD Requirement: "Parcel state transitions cannot be skipped"
 * PRD Requirement: "Invalid transitions are rejected"
 *
 * This validator enforces the strict state machine for parcel lifecycle:
 * EXPECTED → ARRIVED → STORED → DELIVERY_REQUESTED → OUT_FOR_DELIVERY → DELIVERED
 *
 * No state can be skipped. No backwards transitions allowed (except admin override).
 * ============================================================
 */

import { ParcelState } from '@prisma/client';

/**
 * Valid state transitions map
 * Key: current state
 * Value: array of allowed next states
 */
export const VALID_STATE_TRANSITIONS: Record<ParcelState, ParcelState[]> = {
  EXPECTED: [ParcelState.ARRIVED],
  ARRIVED: [ParcelState.STORED],
  STORED: [ParcelState.DELIVERY_REQUESTED],
  DELIVERY_REQUESTED: [ParcelState.OUT_FOR_DELIVERY],
  OUT_FOR_DELIVERY: [ParcelState.DELIVERED],
  DELIVERED: [], // Terminal state - no further transitions
};

/**
 * Human-readable transition rules for error messages
 */
export const TRANSITION_RULES: Record<ParcelState, string> = {
  EXPECTED:
    'Expected parcels can only transition to ARRIVED when physically received',
  ARRIVED: 'Arrived parcels must be processed and moved to STORED',
  STORED: 'Stored parcels can only transition to DELIVERY_REQUESTED by user',
  DELIVERY_REQUESTED:
    'Delivery requested parcels transition to OUT_FOR_DELIVERY when dispatched',
  OUT_FOR_DELIVERY:
    'Out for delivery parcels transition to DELIVERED upon completion',
  DELIVERED: 'Delivered is a terminal state - no further transitions allowed',
};

/**
 * Exception: States that should never be directly set on parcels with exceptions
 */
export const EXCEPTION_LOCKED_STATES: ParcelState[] = [
  ParcelState.DELIVERY_REQUESTED,
  ParcelState.OUT_FOR_DELIVERY,
  ParcelState.DELIVERED,
];

export interface StateTransitionValidationResult {
  valid: boolean;
  error?: string;
  fromState: ParcelState;
  toState: ParcelState;
}

export class ParcelStateMachineValidator {
  /**
   * Validates a state transition from current state to target state
   *
   * @param fromState - Current parcel state
   * @param toState - Desired target state
   * @param hasException - Whether parcel has an active exception
   * @param isAdminOverride - Whether this is an admin override (bypasses some rules)
   * @returns Validation result with error message if invalid
   */
  static validateTransition(
    fromState: ParcelState,
    toState: ParcelState,
    hasException: boolean = false,
    isAdminOverride: boolean = false,
  ): StateTransitionValidationResult {
    // Same state check
    if (fromState === toState) {
      return {
        valid: false,
        error: `Parcel is already in ${toState} state`,
        fromState,
        toState,
      };
    }

    // Exception check: Parcels with exceptions cannot transition (except admin override)
    if (hasException && !isAdminOverride) {
      return {
        valid: false,
        error:
          'Parcel has an active exception. Exception must be resolved before state changes.',
        fromState,
        toState,
      };
    }

    // Get valid transitions for current state
    const allowedTransitions = VALID_STATE_TRANSITIONS[fromState];

    // Check if transition is allowed
    if (!allowedTransitions.includes(toState)) {
      // Admin override allows some special transitions
      if (isAdminOverride && this.isValidAdminOverride(fromState, toState)) {
        return {
          valid: true,
          fromState,
          toState,
        };
      }

      return {
        valid: false,
        error: `Invalid transition from ${fromState} to ${toState}. ${TRANSITION_RULES[fromState]}`,
        fromState,
        toState,
      };
    }

    return {
      valid: true,
      fromState,
      toState,
    };
  }

  /**
   * Checks if a state transition would be skipping intermediate states
   *
   * @param fromState - Current state
   * @param toState - Target state
   * @returns True if transition skips states
   */
  static isSkippingStates(
    fromState: ParcelState,
    toState: ParcelState,
  ): boolean {
    const stateOrder = [
      ParcelState.EXPECTED,
      ParcelState.ARRIVED,
      ParcelState.STORED,
      ParcelState.DELIVERY_REQUESTED,
      ParcelState.OUT_FOR_DELIVERY,
      ParcelState.DELIVERED,
    ];

    const fromIndex = stateOrder.indexOf(fromState);
    const toIndex = stateOrder.indexOf(toState);

    // If jumping more than 1 position, states are being skipped
    return toIndex - fromIndex > 1;
  }

  /**
   * Checks if a transition is moving backwards in the lifecycle
   *
   * @param fromState - Current state
   * @param toState - Target state
   * @returns True if transition is backwards
   */
  static isBackwardsTransition(
    fromState: ParcelState,
    toState: ParcelState,
  ): boolean {
    const stateOrder = [
      ParcelState.EXPECTED,
      ParcelState.ARRIVED,
      ParcelState.STORED,
      ParcelState.DELIVERY_REQUESTED,
      ParcelState.OUT_FOR_DELIVERY,
      ParcelState.DELIVERED,
    ];

    const fromIndex = stateOrder.indexOf(fromState);
    const toIndex = stateOrder.indexOf(toState);

    return toIndex < fromIndex;
  }

  /**
   * Admin overrides can perform certain "special" transitions
   * that regular users cannot, but still with restrictions.
   *
   * Allowed admin overrides:
   * - Move DELIVERED back to STORED (e.g., delivery was incorrect)
   * - Move OUT_FOR_DELIVERY back to STORED (e.g., delivery failed)
   * - Move DELIVERY_REQUESTED back to STORED (e.g., user cancellation)
   *
   * @param fromState - Current state
   * @param toState - Target state
   * @returns True if valid admin override
   */
  private static isValidAdminOverride(
    fromState: ParcelState,
    toState: ParcelState,
  ): boolean {
    const allowedAdminOverrides: Record<ParcelState, ParcelState[]> = {
      DELIVERED: [ParcelState.STORED], // Incorrect delivery
      OUT_FOR_DELIVERY: [ParcelState.STORED], // Delivery failed
      DELIVERY_REQUESTED: [ParcelState.STORED], // User cancellation
      // Other states don't have admin overrides
      EXPECTED: [],
      ARRIVED: [],
      STORED: [],
    };

    const allowed = allowedAdminOverrides[fromState] || [];
    return allowed.includes(toState);
  }

  /**
   * Gets all valid next states for a given current state
   *
   * @param currentState - Current parcel state
   * @param isAdmin - Whether requesting user is admin (affects available states)
   * @returns Array of valid next states
   */
  static getValidNextStates(
    currentState: ParcelState,
    isAdmin: boolean = false,
  ): ParcelState[] {
    const standardTransitions = VALID_STATE_TRANSITIONS[currentState] || [];

    if (!isAdmin) {
      return standardTransitions;
    }

    // Admin gets additional override options
    const adminOverrides: Record<ParcelState, ParcelState[]> = {
      DELIVERED: [ParcelState.STORED],
      OUT_FOR_DELIVERY: [ParcelState.STORED],
      DELIVERY_REQUESTED: [ParcelState.STORED],
      EXPECTED: [],
      ARRIVED: [],
      STORED: [],
    };

    const overrides = adminOverrides[currentState] || [];
    return [...new Set([...standardTransitions, ...overrides])]; // Remove duplicates
  }

  /**
   * Validates that a parcel in exception state is not being moved to
   * states that require full processing (delivery/dispatch)
   *
   * @param toState - Target state
   * @param hasException - Whether parcel has exception
   * @returns True if valid
   */
  static validateExceptionStateLock(
    toState: ParcelState,
    hasException: boolean,
  ): boolean {
    if (!hasException) {
      return true; // No exception, any state is fine
    }

    // Parcels with exceptions cannot be moved to these states
    return !EXCEPTION_LOCKED_STATES.includes(toState);
  }
}
