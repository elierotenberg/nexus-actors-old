/**
 * An Executor holds the runtime information/context in which an actor (Process) actually lives.
 * An Executor is distinct from its associated Process.
 * An Executor is owned by a local Host, and is controlled by the Host.
 * If there was no possible confusion with NodeJS, this concept would be named "Node" (as in: part of a cluster)
 */

import { InvariantError } from "../util/Invariant";
import FSM from "../util/FSM";
import Queue from "../util/Queue";
import unreachable from "../util/unreachable";

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
  export type ExecutorState =
    | "start" // Executor is starting/constructing
    | "sleeping" // Executor is asleep and can be serialized/terminated/resumed
    | "receiving" // Executor is awaiting/catching an async behavior callback
    | "raising" // Executor has caught a runtime exception and is waiting for supervision instructions
    | "supervising" // Executor has received a supervision request from a children and must reply with a supervision effect
    | "terminating" // Executor is terminating and is waiting for children termination
    | "end"; // Executor has ended and cannot receive additional messages

  const allowedExecutorStateTransitions: {
    [K in ExecutorState]: Array<ExecutorState>
  } = {
    start: ["sleeping", "sleeping"],
    sleeping: ["supervising", "receiving", "raising"],
    receiving: ["raising", "sleeping"],
    raising: ["terminating", "sleeping"],
    supervising: ["raising", "sleeping"],
    terminating: ["end"],
    end: []
  };

  type ExecutorFSM = FSM<ExecutorState>;

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
    private fsm: ExecutorFSM;

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

      this.fsm = new FSM("start", allowedExecutorStateTransitions);
    }

    private become({
      state,
      behavior
    }: {
      state: any;
      behavior: Process.Behavior;
    }) {
      this.fsm.assert(state => state === "receiving");
      this.state = state;
      this.behavior = behavior;
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

    public pushMessage(message: Message): this {
      this.fsm.assert(state => state !== "end");
      this.messages.push(message);
      return this;
    }

    public pushSupervisionRequest(request: Supervision.Request): this {
      this.fsm.assert(state => state !== "end");
      this.requests.push(request);
      return this;
    }

    /**
     * Resume spinning the internal yield loop. After calling resume, the Executor will either be paused or awaiting.
     * If the executor is not paused, this will throw.
     * Processes yield at any time. If they yield a Promise, this Promise is awaited before any other event is handled.
     */
    public async resume(): Promise<Host.Tick> {
      this.fsm.assert(state => state === "sleeping");
      try {
        if (!this.requests.empty) {
          // Notifications are handled first.
          const request = this.requests.front();
          this.requests.pop();
          this.fsm.transitionTo("supervising");
          return await this.supervise(request);
        }
        if (!this.messages.empty) {
          // Messages are handled only if no request is pending
          const message = this.messages.front();
          this.messages.pop();
          this.fsm.transitionTo("receiving");
          return await this.receive(message);
        }
      } catch (reason) {
        // Exceptions uncaught by userland code are forwarded to the supervision
        this.fsm.transitionTo("raising");
        return await this.raise(reason);
      }
      // No work to do, stay in sleeping state but create a new Host.Tick.
      this.fsm.transitionTo("sleeping");
      return this.host.tick();
    }

    private async supervise(request: Supervision.Request): Promise<Host.Tick> {
      this.fsm.assert(state => state === "supervising");
      const context = this.context();
      let effect: Supervision.Effect;
      try {
        effect = await this.behavior.supervise(context, request);
      } catch (reason) {
        this.host.dispatchSupervisionResponse(request.response("stop"));
        this.fsm.transitionTo("raising");
        return await this.raise(reason);
      }
      this.host.dispatchSupervisionResponse(request.response(effect));
      this.fsm.transitionTo("sleeping");
      return await this.resume();
    }

    private async receive(message: Message): Promise<Host.Tick> {
      this.fsm.assert(state => state === "receiving");
      const context = this.context();
      const payload = message.payload;
      let effect: Process.BecomeEffect;
      try {
        effect = await this.behavior(context, payload);
      } catch (reason) {
        /**
         * Message is lost and will never be recovered.
         * If you need message recovery, attach the original message to the reason object.
         */
        this.fsm.transitionTo("raising");
        return await this.raise(reason);
      }
      this.become(Process.become(effect, this.state, this.behavior));
      const { state, behavior } = Process.become(
        effect,
        this.state,
        this.behavior
      );
      this.state = state;
      this.behavior = behavior;
      this.fsm.transitionTo("sleeping");
      return await this.resume();
    }

    private async raise(reason: any): Promise<Host.Tick> {
      this.fsm.assert(state => state === "raising");
      const context = this.context();
      const request = new Supervision.Request(
        new Supervision.Id(),
        this.self,
        reason
      );
      let effect: Supervision.Effect;
      try {
        effect = await this.host.supervise(this, context, request, reason);
      } catch (fatal) {
        this.fsm.transitionTo("terminating");
        return await this.terminate(fatal);
      }
      if (effect === "resume") {
        this.fsm.transitionTo("sleeping");
        return await this.resume();
      }
      if (effect === "stop") {
        this.fsm.transitionTo("terminating");
        return await this.terminate(reason);
      }
      return unreachable();
    }

    private async send(target: Process.Reference, payload: any) {}

    private spawn(
      target: Process.Reference,
      behavior: Process.Behavior,
      state: any
    ): Process.Reference {}

    private async terminate(reason: any): Promise<Host.Tick> {}
  }
}

export default Executor;
