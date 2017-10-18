/**
 * An Executor holds the runtime information/context in which an actor (Process) actually lives.
 * An Executor is distinct from its associated Process.
 * An Executor is owned by a local Host, and is controlled by the Host.
 * If there was no possible confusion with NodeJS, this concept would be named "Node" (as in: part of a cluster)
 */

import FSM from "../util/FSM";
import { InvariantError } from "../util/Invariant";
import Queue from "../util/Queue";
import unreachable from "../util/unreachable";

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
    | "supervising" // Executor has received a supervision request from a children and must reply with a supervision effect
    | "receiving" // Executor is awaiting/catching an async behavior callback
    | "raising" // Executor has caught a runtime exception and is waiting for supervision instructions
    | "terminating" // Executor is terminating and is waiting for children termination
    | "end"; // Executor has ended and cannot receive additional messages

  const allowedExecutorStateTransitions: {
    [K in ExecutorState]: Array<ExecutorState>
  } = {
    start: ["sleeping"],
    sleeping: ["terminating", "supervising", "receiving", "raising"],
    supervising: ["raising", "sleeping"],
    receiving: ["raising", "sleeping"],
    raising: ["terminating", "sleeping"],
    terminating: ["end"],
    end: []
  };

  type ExecutorFSM = FSM<ExecutorState>;

  export class Tick {
    public readonly wallclock: number;
    public constructor(wallclock: number) {
      this.wallclock = wallclock;
    }
  }

  export interface Context {
    createProcess(
      parent: Process.Reference,
      stance: Process.Stance<any>,
      name: string
    ): Promise<Process.Reference>;
    dispatchMessage(message: Message.Message): Promise<void>;
    dispatchSupervisionResponse(response: Supervision.Response): Promise<void>;
    releaseProcess(process: Process.Reference): Promise<void>;
    supervise(request: Supervision.Request): Promise<Supervision.Effect>;
    terminateProcess(process: Process.Reference, reason: any): Promise<void>;
    tick(): Promise<Tick>;
  }

  export class Executor<ProcessState> {
    private readonly context: Context;
    private readonly self: Process.Reference;
    /**
     * The supervised children.
     * The executor implictly subsribes to alerts from the children processes.
     */
    private readonly children: Set<Process.Reference>;
    /**
     * Incoming message queue (back is most recent message, front is least recent message)
     */
    private readonly messages: Queue<Message.Message>;
    /**
     * Incoming supervision request queue (back is most recent alert, front is least recent alert)
     */
    private readonly requests: Queue<Supervision.Request>;

    /**
     * Current state of the executor (not to be confused with process state, which this executor.stance.state).
     */
    private fsm: ExecutorFSM;
    /**
     * Current stance of the executed process
     */
    private stance: Process.Stance<ProcessState>;
    /**
     * This field will be set to 'true' and checked in the sleeping/resume loop.
     */
    private hasTerminationBeenRequested: boolean;
    private terminationReason: any;

    public constructor(
      context: Context,
      self: Process.Reference,
      stance: Process.Stance<ProcessState>
    ) {
      this.context = context;
      this.self = self;
      this.stance = stance;
      this.hasTerminationBeenRequested = false;
      this.children = new Set();
      this.messages = new Queue();
      this.requests = new Queue();

      this.fsm = new FSM("start", allowedExecutorStateTransitions);
    }

    /**
     * Public methods will be invoked by Host
     */

    public pushMessage(message: Message.Message): this {
      this.fsm.assert(state => state !== "end");
      if (this.self.toString() !== message.receiver.toString()) {
        throw new ExecutorInvariantError(
          "Can only accept pushMessage for the currently executed process"
        );
      }
      this.messages.push(message);
      return this;
    }

    public pushSupervisionRequest(request: Supervision.Request): this {
      this.fsm.assert(state => state !== "end");
      this.requests.push(request);
      return this;
    }

    public start(): this {
      this.fsm.assert(state => state === "start");
      this.fsm.transitionTo("sleeping");
      return this;
    }

    public wake(): this {
      Promise.resolve().then(() => {
        if (this.fsm.test(state => state === "sleeping")) {
          this.resume();
        }
      });
      return this;
    }

    public kill(reason: any): this {
      this.hasTerminationBeenRequested = true;
      this.terminationReason = reason;
      return this.wake();
    }

    /**
     * Private methods are hidden from Host
     */

    private become(nextStance: Process.Stance<ProcessState>): void {
      this.fsm.assert(state => state === "receiving");
      this.stance = nextStance;
    }

    private processContext(): Process.Context<ProcessState> {
      return {
        self: this.self,
        state: this.stance.state,
        send: this.send,
        spawn: this.spawn
      };
    }

    /**
     * Resume spinning the internal yield loop. After calling resume, the Executor will either be paused or awaiting.
     * If the executor is not paused, this will throw.
     * Processes yield at any time. If they yield a Promise, this Promise is awaited before any other event is handled.
     */
    private async resume(): Promise<Tick> {
      this.fsm.assert(state => state === "sleeping");
      try {
        if (this.hasTerminationBeenRequested) {
          // Process termination has been requested
          this.fsm.transitionTo("terminating");
          return await this.terminate(this.terminationReason);
        }
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
      // No work to do, stay in sleeping state but create a new Tick.
      this.fsm.transitionTo("sleeping");
      return this.context.tick();
    }

    private async supervise(request: Supervision.Request): Promise<Tick> {
      this.fsm.assert(state => state === "supervising");
      const context = this.processContext();
      let effect: Supervision.Effect;
      try {
        effect = await this.stance.behavior.supervise(context, request);
      } catch (reason) {
        // Host code is assumed to not throw in normal conditions for now.
        await this.context.dispatchSupervisionResponse(
          request.response("stop")
        );
        this.fsm.transitionTo("raising");
        return await this.raise(reason);
      }
      this.context.dispatchSupervisionResponse(request.response(effect));
      this.fsm.transitionTo("sleeping");
      return await this.resume();
    }

    private async receive(message: Message.Message): Promise<Tick> {
      this.fsm.assert(state => state === "receiving");
      const context = this.processContext();
      const payload = message.payload;
      let nextStance: Process.Stance<ProcessState>;
      try {
        nextStance = await this.stance.behavior(context, payload);
      } catch (reason) {
        /**
         * Message is lost and will never be recovered.
         * If you need message recovery, attach the original message to the reason object.
         */
        this.fsm.transitionTo("raising");
        return await this.raise(reason);
      }
      this.become(nextStance);
      this.fsm.transitionTo("sleeping");
      return await this.resume();
    }

    private async raise(reason: any): Promise<Tick> {
      this.fsm.assert(state => state === "raising");
      const context = this.processContext();
      const request = new Supervision.Request(
        new Supervision.Id(),
        this.self,
        reason
      );
      let effect: Supervision.Effect;
      try {
        effect = await this.context.supervise(request);
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

    private async send(target: Process.Reference, payload: any): Promise<void> {
      this.fsm.assert(state => state === "receiving");
      const message = new Message.Message(this.self, target, payload);
      return await this.context.dispatchMessage(message);
    }

    private async spawn(
      stance: Process.Stance<any>,
      name: string
    ): Promise<Process.Reference> {
      this.fsm.assert(state => state === "receiving");
      return await this.context.createProcess(this.self, stance, name);
    }

    private async terminate(reason: any): Promise<Tick> {
      this.fsm.assert(state => state === "terminating");
      await this.context.releaseProcess(this.self);
      this.fsm.transitionTo("end");
      return await this.end();
    }

    private async end(): Promise<Tick> {
      this.fsm.assert(state => state === "end");
      return this.context.tick();
    }
  }
}

export default Executor;
