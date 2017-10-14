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
      executor: Executor.Executor<any>,
      context: Process.Context<any>,
      request: Supervision.Request,
      reason: any
    ) => Promise<Supervision.Effect>;
    dispatchMessage: (message: Message) => Promise<void>;
    dispatchSupervisionResponse: (
      response: Supervision.Response
    ) => Promise<void>;
    createProcess: (
      stance: Process.Stance<any>,
      name?: string
    ) => Promise<Process.Reference>;
    terminateProcess: (
      executor: Executor.Executor<any>
    ) => Promise<Process.Reference>;
  }
}

export default Host;
