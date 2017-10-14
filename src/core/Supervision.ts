import * as uuid from "../util/uuid";

import Host from "./Host";
import Process from "./Process";

export namespace Supervision {
  export class Id {
    readonly id: string;
    constructor(id: string = uuid.create()) {
      this.id = id;
    }
  }

  // For now we just handle two effects: "resume" and "stop".
  export type Effect = "resume" | "stop" /** | "restart" | "escalate" */;

  export class Request {
    readonly id: Id;
    readonly child: Process.Reference;
    readonly reason: any;

    public constructor(id: Id, child: Process.Reference, reason: any) {
      this.id = id;
      this.child = child;
      this.reason = reason;
    }

    response(effect: Effect) {
      return new Response(this.id, this.child, effect);
    }
  }

  export class Response {
    readonly id: Id;
    readonly child: Process.Reference;
    readonly effect: Effect;

    public constructor(id: Id, child: Process.Reference, effect: Effect) {
      this.id = id;
      this.child = child;
      this.effect = effect;
    }
  }

  export interface Strategy {
    (context: Process.Context, request: Request): Promise<Effect>;
  }
}

export default Supervision;
