/**
 * A Host represents a local execution context.
 * Concepts: cluster-client, send, subscribe, route...
 * A Host relies on a platform-specific backend for actually joining a cluster, sending messages to the cluster, etc.
 * A Host holds a pool of Executors reducing Processes.
 */

import Executor from "./Executor";
import Message from "./Message";
import Process from "./Process";
import Supervision from "./Supervision";

namespace Host {
  export type Tick = { tick: number };

  export interface Host {
    tick(): Promise<Tick>;
    supervise: (
      executor: Executor.Executor,
      context: Process.Context,
      request: Supervision.Request,
      reason: any
    ) => Promise<Supervision.Effect>;
    dispatchMessage: (message: Message) => void;
    dispatchSupervisionResponse: (response: Supervision.Response) => void;
  }
}

export default Host;
