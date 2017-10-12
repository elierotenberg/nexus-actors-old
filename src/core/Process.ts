/**
 * A Process represents an actor definition.
 * It holds the definition of the core lifecycle methods (some of which are mandatory)
 */

import Host from "./Host";
import Supervision from "./Supervision";

namespace Process {
  export type Reference = { url: URL };

  export interface Process {
    self: Process.Reference;
    send(receiver: Process.Reference, payload: any): void;
  }

  export interface Context {
    host: Host.Host;

    self: Process.Reference;

    state: any;

    send(target: Reference, payload: any): void;
    spawn(target: Reference, behavior: Behavior, state: any): Process.Reference;
  }

  export interface Behavior {
    (context: Context, payload: any): Promise<any>;
    supervise: Supervision.Strategy;
  }

  export type PreserveState = { preserveState: true };
  // Singleton (comparison by reference) expressing that we won't change state
  export const preserveState: PreserveState = { preserveState: true };
  Object.freeze(preserveState);

  export type PreserveBehavior = { preserveBehavior: true };
  // Singleton (comparison by reference) expressing that we won't change behavior
  export const preserveBehavior: PreserveBehavior = { preserveBehavior: true };
  Object.freeze(preserveBehavior);

  export class CompositeBecomeEffect {
    private nextState: PreserveState | any = preserveState;
    private nextBehavior: PreserveBehavior | Behavior = preserveBehavior;

    public constructor(
      nextState: PreserveState | any = preserveState,
      nextBehavior: PreserveBehavior | Behavior = preserveBehavior
    ) {
      this.nextState = nextState;
      this.nextBehavior = nextBehavior;
    }

    public setState(nextState: PreserveState | any): this {
      this.nextState = nextState;
      return this;
    }

    public setBehavior(nextBehavior: PreserveBehavior | Behavior): this {
      this.nextBehavior = nextBehavior;
      return this;
    }

    public applyTo(
      state: any,
      behavior: Behavior
    ): { state: any; behavior: Behavior } {
      const nextState =
        this.nextState === preserveState ? state : this.nextState as any;
      const nextBehavior =
        this.nextBehavior === preserveBehavior
          ? behavior
          : this.nextBehavior as Behavior;
      return {
        state: nextState,
        behavior: nextBehavior
      };
    }
  }

  function setState(nextState: PreserveState | any): CompositeBecomeEffect {
    return new CompositeBecomeEffect(nextState);
  }

  function setBehavior(nextBehavior: PreserveBehavior | Behavior) {
    return new CompositeBecomeEffect(preserveState, nextBehavior);
  }

  /**
   * When a BecomeEffect is raised, it is tested against instanceof CompositeBecomeEffect.
   * If the effect matches, it is interpreted as such.
   * Otherwise, it is interpreted as the next state value.
   */
  export type BecomeEffect = CompositeBecomeEffect | any;
}

export default Process;
