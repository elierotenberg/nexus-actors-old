import * as cluster from "cluster";
import * as os from "os";

import Host from "../core/Host";

namespace Master {
  export class WorkerReference {
    readonly workerId: number;
    constructor(workerId: number) {
      this.workerId = workerId;
    }
  }

  export class Master {
    readonly numWorkers: number;
    readonly workers: Map<cluster.Worker, WorkerReference>;
    readonly acquiredPaths: Map<string, WorkerReference>;
    constructor(numWorkers: number = os.cpus().length) {
      this.numWorkers = numWorkers;

      this.workers = new Map();
      this.acquiredPaths = new Map();
      this.onWorkerExit = this.onWorkerExit.bind(this);

      for (let iWorker = 0; iWorker < numWorkers; iWorker++) {
        cluster.fork();
      }
      cluster.on("exit", this.onWorkerExit);
    }

    private onWorkerExit(
      worker: cluster.Worker,
      code: number,
      signal: string
    ): void {}

    private onWorkerMessage() {}
  }
}
