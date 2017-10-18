import * as cluster from "cluster";

import Host from "../core/Host";

import { InvariantError } from "../util/Invariant";

namespace Worker {
  export class WorkerContextInvariantError extends InvariantError {
    constructor(description: string) {
      super("WorkerContextInvariantError", description);
    }
  }

  export class WorkerContext implements Host.Context {
    constructor() {
      if (!cluster.isWorker) {
        throw new WorkerContextInvariantError(
          "WorkerContext can only be instatiated within a node cluster worker"
        );
      }
    }
  }
}
