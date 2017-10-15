/**
 * A Host represents a local execution context.
 * Concepts: cluster-client, send, subscribe, route...
 * A Host relies on a platform-specific backend for actually joining a cluster, sending messages to the cluster, etc.
 * A Host holds a pool of Executors reducing Processes.
 */

import Executor from "./Executor";
import Message from "./Message";
import Process from "./Process";
import Router from "./Router";
import Supervision from "./Supervision";

namespace Host {
  export type Tick = { tick: number };

  export class Host<Router extends Router.Router<any>> {
    async tick(): Promise<Tick> {}
    async supervise(
      executor: Executor.Executor<any>,
      context: Process.Context<any>,
      request: Supervision.Request,
      reason: any
    ): Promise<Supervision.Effect> {}
    async dispatchMessage(message: Message): Promise<void> {}
    async dispatchSupervisionResponse(
      response: Supervision.Response
    ): Promise<void> {}
    async createProcess(
      executor: Executor.Executor<any>,
      stance: Process.Stance<any>,
      name?: string
    ): Promise<Process.Reference> {}
    async terminateProcess(
      executor: Executor.Executor<any>
    ): Promise<Process.Reference> {}
  }
}

export default Host;
