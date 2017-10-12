import Host from "./Host";
import Process from "./Process";

export namespace Supervision {
  export type Effect = "resume" | "restart" | "stop" | "escalate";

  export class Request {
    readonly parent: Process.Reference;
    readonly child: Process.Reference;
    readonly reason: any;

    public constructor(
      parent: Process.Reference,
      child: Process.Reference,
      reason: any
    ) {
      this.parent = parent;
      this.child = child;
      this.reason = reason;
    }
  }

  export class Response {
    readonly parent: Process.Reference;
    readonly child: Process.Reference;
    readonly effect: Effect;

    public constructor(
      parent: Process.Reference,
      child: Process.Reference,
      effect: Effect
    ) {
      this.parent = parent;
      this.child = child;
      this.effect = effect;
    }
  }

  export interface Strategy {
    (context: Process.Context, request: Request): Promise<Effect>;
  }
}

export default Supervision;
