/**
 * An Executor holds the runtime information/context in which an actor (Process) actually lives.
 * An Executor is distinct from its associated Process.
 * An Executor is owned by a local Host, and is controlled by the Host.
 * If there was no possible confusion with NodeJS, this concept would be named "Node" (as in: part of a cluster)
 */

import { InvariantError } from "../util/Invariant";
import Queue from "../util/Queue";

import Host from "./Host";
import Message from "./Message";
import Process from "./Process";
import Supervision from "./Supervision";

namespace Executor {
  export class ExecutorInvariantError extends InvariantError {
    constructor(description: string) {
      super("ExecutorInvariantError", description);
    }
  }

  /**
   */
  export type Status =
    | "start" // Executor is starting/constructing
    | "sleeping" // Executor is asleep and can be serialized/terminated/resumed
    | "receiving" // Executor is awaiting/catching an async behavior callback
    | "raising" // Executor has caught a runtime exception and is waiting for supervision instructions
    | "supervising" // Executor has received a supervision request from a children and must reply with a supervision effect
    | "end"; // Executor has ended and cannot receive additional messages

  export class Executor {
    private readonly host: Host.Host;
    private readonly self: Process.Reference;
    /**
     * The supervised children.
     * The executor implictly subsribes to alerts from the children processes.
     */
    private readonly children: Set<Process.Reference>;
    /**
     * Incoming message queue (back is most recent message, front is least recent message)
     */
    private readonly messages: Queue<Message>;
    /**
     * Incoming supervision request queue (back is most recent alert, front is least recent alert)
     */
    private readonly requests: Queue<Supervision.Request>;

    /**
     * Current status of the executor (not to be confused with process state).
     */
    private status: Status;

    private behavior: Process.Behavior;
    private state: any;

    public constructor(
      host: Host.Host,
      self: Process.Reference,
      initialBehavior: Process.Behavior,
      initialState: any
    ) {
      this.host = host;
      this.self = self;
      this.children = new Set();
      this.messages = new Queue();
      this.requests = new Queue();

      this.status = "start";
    }

    public pushMessage(message: Message): this {
      if (this.status === "end") {
        throw new ExecutorInvariantError(
          "Executor cannot handle message after is has ended"
        );
      }
      this.messages.push(message);
      return this;
    }

    public pushNotification(request: Supervision.Request): this {
      if (this.status === "end") {
        throw new ExecutorInvariantError(
          "Executor cannot handle notifications after it has ended"
        );
      }
      this.requests.push(request);
      return this;
    }

    /**
     * Resume spinning the internal yield loop. After calling resume, the Executor will either be paused or awaiting.
     * If the executor is not paused, this will throw.
     * Processes yield at any time. If they yield a Promise, this Promise is awaited before any other event is handled.
     */
    public resume(): void {
      if (this.status !== "sleeping") {
        throw new ExecutorInvariantError(
          `Executor status must be 'sleeping' to be resumed. Insted, status is '${this
            .status}'.`
        );
      }
      this.progress();
    }

    private async progress(): Promise<void> {
      if (this.status !== "sleeping") {
        throw new ExecutorInvariantError(
          `Executor status must be 'sleeping' to progress. Instead, status is '${this
            .status}`
        );
      }
      try {
        if (!this.requests.empty) {
          // Notifications are handled first.
          const request = this.requests.front();
          this.requests.pop();
          this.status = "supervising";
          await this.supervise(request);
        } else if (!this.messages.empty) {
          // Messages are handled only if no request is pending
          const message = this.messages.front();
          this.messages.pop();
          this.status = "receiving";
          await this.receive(message);
        } else {
          // No work to do, return to sleeping state
          this.status = "sleeping";
        }
      } catch (reason) {
        // Exceptions uncaught by userland code are forwarded to the supervision
        this.status = "raising";
        await this.raise(reason);
      }
    }

    private context(): Process.Context {
      return {
        host: this.host,
        self: this.self,
        state: this.state,
        send: this.send,
        spawn: this.spawn
      };
    }

    private async supervise(request: Supervision.Request): Promise<void> {
      if (this.status !== "supervising") {
        throw new ExecutorInvariantError(
          `Executor status must be 'supervising' to supervise. Instead, status is '${this
            .status}.`
        );
      }
      const context = this.context();
      let effect: Supervision.Effect;
      try {
        effect = await this.behavior.supervise(context, request);
      } catch (reason) {
        effect = await this.host.supervise(this, context, request, reason);
      }
    }

    private async receive(message: Message): Promise<void> {}

    private async raise(reason: any): Promise<void> {}

    private async send(target: Process.Reference, payload: any) {}

    private spawn(
      target: Process.Reference,
      behavior: Process.Behavior,
      state: any
    ): Process.Reference {}
  }
}

export default Executor;
