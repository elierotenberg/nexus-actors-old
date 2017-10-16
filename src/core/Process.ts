/**
 * A Process represents an actor definition.
 * It holds the definition of the core lifecycle methods (some of which are mandatory)
 */

import Host from "./Host";
import Supervision from "./Supervision";
import URLReference from "../util/URLReference";

namespace Process {
  export class Reference extends URLReference<"Process"> {
    public constructor(url: URL) {
      super("Process", url);
    }
  }

  export interface Process {
    self: Reference;
    send(receiver: Reference, payload: any): void;
  }

  export interface Context<State> {
    host: Host.Host;

    self: Reference;

    state: State;

    send(target: Reference, payload: any): Promise<void>;
    spawn(stance: Stance<any>, name?: string): Promise<Reference>;
  }

  export interface Behavior<State> {
    (context: Context<State>, payload: any): Promise<Stance<State>>;
    supervise: Supervision.Strategy<State>;
  }

  export interface Stance<State> {
    state: State;
    behavior: Process.Behavior<State>;
  }
}

export default Process;
