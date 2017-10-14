/**
 * A Process represents an actor definition.
 * It holds the definition of the core lifecycle methods (some of which are mandatory)
 */

import Host from "./Host";
import Supervision from "./Supervision";

namespace Process {
  export class Reference {
    public readonly url: URL;
    public constructor(url: URL) {
      this.url = url;
    }

    public get parent(): Reference {
      return new Reference(new URL("..", this.url.href));
    }
  }

  export interface Process {
    self: Process.Reference;
    send(receiver: Process.Reference, payload: any): void;
  }

  export interface Context<State> {
    host: Host.Host;

    self: Process.Reference;

    state: State;

    send(target: Reference, payload: any): void;
    spawn(
      target: Reference,
      behavior: Behavior<State>,
      state: any
    ): Process.Reference;
  }

  export interface Behavior<State> {
    (context: Context<State>, payload: any): Promise<BecomeEffect<State>>;
    supervise: Supervision.Strategy;
  }

  export interface Stance<State> {
    state: State;
    behavior: Process.Behavior<State>;
  }

  export type PreserveState<State> = { preserveState: true };
  // Singleton (comparison by reference) expressing that we won't change state
  export const preserveState: PreserveState<any> = { preserveState: true };
  Object.freeze(preserveState);

  export type PreserveBehavior<State> = { preserveBehavior: true };
  // Singleton (comparison by reference) expressing that we won't change behavior
  export const preserveBehavior: PreserveBehavior<any> = {
    preserveBehavior: true
  };
  Object.freeze(preserveBehavior);

  export class CompositeBecomeEffect<State> {
    private nextState: PreserveState<State> | State = preserveState;
    private nextBehavior:
      | PreserveBehavior<State>
      | Behavior<State> = preserveBehavior;

    public constructor(
      nextState: PreserveState<State> | State = preserveState,
      nextBehavior: PreserveBehavior<State> | Behavior<State> = preserveBehavior
    ) {
      this.nextState = nextState;
      this.nextBehavior = nextBehavior;
    }

    public setState(nextState: PreserveState<State> | State): this {
      this.nextState = nextState;
      return this;
    }

    public setBehavior(
      nextBehavior: PreserveBehavior<State> | Behavior<State>
    ): this {
      this.nextBehavior = nextBehavior;
      return this;
    }

    public applyTo(
      state: State,
      behavior: Behavior<State>
    ): { state: State; behavior: Behavior<State> } {
      const nextState =
        this.nextState === preserveState ? state : this.nextState as State;
      const nextBehavior =
        this.nextBehavior === preserveBehavior
          ? behavior
          : this.nextBehavior as Behavior<State>;
      return {
        state: nextState,
        behavior: nextBehavior
      };
    }
  }

  function setState<State>(
    nextState: PreserveState<State> | State
  ): CompositeBecomeEffect<State> {
    return new CompositeBecomeEffect(nextState);
  }

  function setBehavior<State>(
    nextBehavior: PreserveBehavior<State> | Behavior<State>
  ) {
    return new CompositeBecomeEffect(preserveState, nextBehavior);
  }

  /**
   * When a BecomeEffect is raised, it is tested against instanceof CompositeBecomeEffect.
   * If the effect matches, it is interpreted as such.
   * Otherwise, it is interpreted as the next state value.
   */
  export type BecomeEffect<State> = CompositeBecomeEffect<State> | State;
  export function become<State>(
    effect: BecomeEffect<State>,
    state: State,
    behavior: Behavior<State>
  ): { state: State; behavior: Behavior<State> } {
    if (effect instanceof CompositeBecomeEffect) {
      return effect.applyTo(state, behavior);
    }
    return {
      state: effect,
      behavior
    };
  }
}

export default Process;
