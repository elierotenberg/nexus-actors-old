import Deferred from "../util/Deferred";

import Executor from "./Executor";
import Host from "./Host";
import Process from "./Process";
import Supervision from "./Supervision";

class ExecutorPoolItem {
  public readonly executor: Executor.Executor<any>;
  public readonly pendingSupervisionRequests: Map<
    Supervision.Id,
    Deferred<Supervision.Response>
  >;
  constructor(executor: Executor.Executor<any>) {
    this.executor = executor;
    this.pendingSupervisionRequests = new Map();
  }
}

const keyOfMemo: WeakMap<Process.Reference, string> = new WeakMap();
class ExecutorPool {
  private readonly pool: Map<string, ExecutorPoolItem>;

  static keyOf(process: Process.Reference): string {
    if (!keyOfMemo.has(process)) {
      keyOfMemo.set(process, process.url.toString());
    }
    return keyOfMemo.get(process) as string;
  }
  public constructor() {
    this.pool = new Map();
  }

  public hasProcess(process: Process.Reference): boolean {
    const key = ExecutorPool.keyOf(process);
    return this.pool.has(key);
  }

  public getExecutor(process: Process.Reference): Executor.Executor<any> {
    if (!this.hasProcess(process)) {
      throw new Host.HostInvariantError(
        "#get must only be used after checking #has."
      );
    }

    const key = ExecutorPool.keyOf(process);
    return (this.pool.get(key) as ExecutorPoolItem).executor;
  }

  public insertProcess(
    process: Process.Reference,
    executor: Executor.Executor<any>
  ): void {
    if (this.hasProcess(process)) {
      throw new Host.HostInvariantError(
        "Process is already referenced by an Executor"
      );
    }

    const key = ExecutorPool.keyOf(process);
    this.pool.set(key, new ExecutorPoolItem(executor));
  }

  public deleteProcess(process: Process.Reference): void {
    if (!this.hasProcess(process)) {
      throw new Host.HostInvariantError("Process is not referenced");
    }

    const key = ExecutorPool.keyOf(process);
    const poolItem = this.pool.get(key) as ExecutorPoolItem;
    // Drain pending supervision requests (if any)
    poolItem.pendingSupervisionRequests.clear();
    this.pool.delete(key);
  }

  public insertDeferredSupervisionRequest(
    request: Supervision.Request,
    deferred: Deferred<Supervision.Response>
  ): void {
    if (!this.hasProcess(request.child)) {
      throw new Host.HostInvariantError("Child process is not referenced");
    }

    const key = ExecutorPool.keyOf(request.child);
    const { pendingSupervisionRequests } = this.pool.get(
      key
    ) as ExecutorPoolItem;
    if (pendingSupervisionRequests.has(request.id)) {
      throw new Host.HostInvariantError("Request id is already referenced");
    }
    pendingSupervisionRequests.set(request.id, deferred);
  }

  public resolveDeferredSupervisionRequest(
    response: Supervision.Response
  ): void {
    if (!this.hasProcess(response.child)) {
      throw new Host.HostInvariantError("Child process is not referenced");
    }

    const key = ExecutorPool.keyOf(response.child);
    const { pendingSupervisionRequests } = this.pool.get(
      key
    ) as ExecutorPoolItem;
    if (!pendingSupervisionRequests.has(response.id)) {
      throw new Host.HostInvariantError("Request id is not referenced");
    }
    const deferred = pendingSupervisionRequests.get(response.id) as Deferred<
      Supervision.Response
    >;
    deferred.resolve(response);
  }
}

export default ExecutorPool;
