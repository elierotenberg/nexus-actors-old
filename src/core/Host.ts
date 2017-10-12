/**
 * A Host represents a local execution context.
 * Concepts: cluster-client, send, subscribe, route...
 * A Host relies on a platform-specific backend for actually joining a cluster, sending messages to the cluster, etc.
 * A Host holds a pool of Executors reducing Processes.
 */

import Executor from "./Executor";
import Process from "./Process";
import Supervision from "./Supervision";

namespace Host {
  export interface Host {
    supervise: (
      executor: Executor.Executor,
      context: Process.Context,
      request: Supervision.Request
    ) => Promise<Supervision.Effect>;
  }
}

export default Host;
