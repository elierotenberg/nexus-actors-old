/**
 * A Host represents a local execution context.
 * Concepts: cluster-client, send, subscribe, route...
 * A Host relies on a platform-specific backend for actually joining a cluster, sending messages to the cluster, etc.
 * A Host holds a pool of Executors reducing Processes.
 */
import Deferred from "../util/Deferred";
import { InvariantError } from "../util/Invariant";
import notImplemented from "../util/notImplemented";
import URLReference from "../util/URLReference";
import unreachable from "../util/unreachable";

import Cluster from "../cluster/Cluster";
import Executor from "./Executor";
import Message from "./Message";
import Packet from "./Packet";
import Platform from "./Platform";
import Process from "./Process";
import Scheduling from "./Scheduling";
import Supervision from "./Supervision";

import ExecutorPool from "./Host.ExecutorPool";

namespace Host {
  export class HostInvariantError extends InvariantError {
    constructor(description: string) {
      super("HostInvariantError", description);
    }
  }

  export class Reference extends URLReference<"Host"> {
    constructor(url: URL) {
      super("Host", url);
    }
  }

  export interface Context {
    wallclock(): Promise<number>;
    publish(packet: Packet.Packet): Promise<void>;
    acquire(host: Reference): Promise<void>;
    release(host: Reference): Promise<void>;
  }

  export class Host {
    private readonly self: Reference;
    private readonly context: Context;
    private readonly executorPool: ExecutorPool;

    public constructor(self: Reference, context: Context) {
      this.self = self;
      this.context = context;

      this.executorPool = new ExecutorPool();

      // Early bind methods that will be bound to this.executorContext()
      this.createProcess = this.createProcess.bind(this);
      this.dispatchMessage = this.dispatchMessage.bind(this);
      this.dispatchSupervisionResponse = this.dispatchSupervisionResponse.bind(
        this
      );
      this.supervise = this.supervise.bind(this);
      this.terminateProcess = this.terminateProcess.bind(this);
      this.tick = this.tick.bind(this);
    }
    /**
     * Public methods will be invoked by the underlying Context implementation
     */

    public async receive(packet: Packet.Packet): Promise<void> {
      if (packet instanceof Message.Message) {
        return await this.receiveMessage(packet.payload);
      }
      if (packet instanceof Supervision.Request) {
        return await this.receiveSupervisionRequest(packet);
      }
      if (packet instanceof Supervision.Response) {
        return await this.receiveSupervisionResponse(packet);
      }
      if (packet instanceof Scheduling.Create) {
        return await this.receiveCreate(packet);
      }
      if (packet instanceof Scheduling.Terminate) {
        return await this.receiveTerminate(packet);
      }
    }

    private async receiveMessage(message: Message.Message): Promise<void> {
      if (!this.executorPool.hasProcess(message.receiver)) {
        throw new HostInvariantError("Local process should have an executor");
      }
      const receiverExecutor = this.executorPool.getExecutor(
        message.receiver
      ) as Executor.Executor<any>;
      receiverExecutor.pushMessage(message);
      receiverExecutor.wake();
      return;
    }

    private async receiveSupervisionRequest(
      request: Supervision.Request
    ): Promise<void> {
      if (!this.executorPool.hasProcess(request.child.parent)) {
        const response = new Supervision.Response(
          request.id,
          request.child,
          "stop"
        );
        await this.context.publish(response);
        throw new HostInvariantError("Local process should have an executor");
      }
      const parentExecutor = this.executorPool.getExecutor(
        request.child.parent
      ) as Executor.Executor<any>;
      parentExecutor.pushSupervisionRequest(request);
      parentExecutor.wake();
    }

    private async receiveSupervisionResponse(
      response: Supervision.Response
    ): Promise<void> {
      return await this.executorPool.resolveDeferredSupervisionRequest(
        response
      );
    }

    private async receiveCreate(create: Scheduling.Create<any>): Promise<void> {
      const { child, stance } = create;
      const executor = new Executor.Executor(
        this.executorContext(),
        child,
        stance
      )
        .start()
        .wake();
      this.executorPool.insertProcess(child, executor);
      return;
    }

    private async receiveTerminate(
      terminate: Scheduling.Terminate
    ): Promise<void> {
      const { target, reason } = terminate;
      if (!this.executorPool.hasProcess(target)) {
        throw new HostInvariantError("Local process should have an executor");
      }

      const executor = this.executorPool.getExecutor(
        target
      ) as Executor.Executor<any>;
      await executor.kill(reason); // Releasing of this executor will happen in this.releaseExecutor
    }

    private executorContext(): Executor.Context {
      return {
        releaseProcess: this.releaseProcess,
        createProcess: this.createProcess,
        dispatchMessage: this.dispatchMessage,
        dispatchSupervisionResponse: this.dispatchSupervisionResponse,
        supervise: this.supervise,
        terminateProcess: this.terminateProcess,
        tick: this.tick
      };
    }

    private async releaseProcess(process: Process.Reference): Promise<void> {
      this.executorPool.deleteProcess(process);
    }

    private async tick(): Promise<Executor.Tick> {
      return new Executor.Tick(await this.context.wallclock());
    }

    private async supervise(
      request: Supervision.Request
    ): Promise<Supervision.Effect> {
      const deferred = new Deferred() as Deferred<Supervision.Response>;
      this.executorPool.insertDeferredSupervisionRequest(request, deferred);

      // Reception will be handled by a local or remote Host#receiveSupervisionRequest
      await this.context.publish(request);
      // This might take a while and should probably be gated by some sort of timeout in the future.
      const response = await deferred.join();
      return response.effect;
    }

    private async dispatchMessage(message: Message.Message): Promise<void> {
      return await this.context.publish(message);
    }

    private async dispatchSupervisionResponse(
      response: Supervision.Response
    ): Promise<void> {
      return await this.context.publish(response);
    }

    private async createProcess(
      parent: Process.Reference,
      stance: Process.Stance<any>,
      name: string
    ): Promise<Process.Reference> {
      const child = parent.child(name);
      await this.context.publish(new Scheduling.Create(child, stance));
      return child;
    }

    private async terminateProcess(
      target: Process.Reference,
      reason: any
    ): Promise<void> {
      return await this.context.publish(
        new Scheduling.Terminate(target, reason)
      );
    }
  }
}

export default Host;
