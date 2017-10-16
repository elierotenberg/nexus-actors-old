/**
 * A Host represents a local execution context.
 * Concepts: cluster-client, send, subscribe, route...
 * A Host relies on a platform-specific backend for actually joining a cluster, sending messages to the cluster, etc.
 * A Host holds a pool of Executors reducing Processes.
 */
import notImplemented from "../util/notImplemented";
import URLReference from "../util/URLReference";
import unreachable from "../util/unreachable";

import Cluster from "../cluster/Cluster";
import Executor from "./Executor";
import Message from "./Message";
import Platform from "./Platform";
import Process from "./Process";
import Supervision from "./Supervision";

namespace Host {
  export class Reference extends URLReference<"Host"> {
    constructor(url: URL) {
      super("Host", url);
    }
  }

  export class Tick {
    public readonly host: Host.Reference;
    public readonly hostClockDate: number;
    public constructor(host: Host.Reference, hostClockDate: number) {
      this.host = host;
      this.hostClockDate = hostClockDate;
    }
  }

  export type PacketKind =
    | "Message"
    | "SupervisionRequest"
    | "SupervisionResponse";

  export class Packet {
    public readonly kind: PacketKind;
    public readonly target: Process.Reference;
    public readonly payload: any;
    public constructor(
      obj: Message.Message | Supervision.Request | Supervision.Response
    ) {
      if (obj instanceof Message.Message) {
        this.kind = "Message";
        this.target = obj.receiver;
        this.payload = obj.payload;
        return this;
      }
      if (obj instanceof Supervision.Request) {
        this.kind = "SupervisionRequest";
        this.target = obj.child.parent;
        this.payload = {
          id: obj.id,
          reason: obj.reason
        };
        return this;
      }
      if (obj instanceof Supervision.Response) {
        this.kind = "SupervisionResponse";
        this.target = obj.child;
        this.payload = {
          id: obj.id,
          effect: obj.effect
        };
        return this;
      }
      return unreachable();
    }
  }

  export class Host {
    private readonly self: Reference;
    private readonly platform: Platform.Platform;
    private readonly cluster?: Cluster.Cluster;

    public constructor(
      self: Reference,
      platform: Platform.Platform,
      cluster?: Cluster.Cluster
    ) {
      this.self = self;
      this.platform = platform;
      this.cluster = cluster;
    }

    public async tick(): Promise<Tick> {
      // Implicit host capability: construct new Date() appropriately
      return new Tick(this.self, this.platform.clockTick());
    }

    public async supervise(
      executor: Executor.Executor<any>,
      context: Process.Context<any>,
      request: Supervision.Request,
      reason: any
    ): Promise<Supervision.Effect> {
      return notImplemented();
    }

    async dispatchMessage(message: Message.Message): Promise<void> {
      return notImplemented();
    }

    async dispatchSupervisionResponse(
      response: Supervision.Response
    ): Promise<void> {
      return notImplemented();
    }

    async createProcess(
      executor: Executor.Executor<any>,
      stance: Process.Stance<any>,
      name?: string
    ): Promise<Process.Reference> {
      return notImplemented();
    }
    async terminateProcess(
      executor: Executor.Executor<any>
    ): Promise<Process.Reference> {
      return notImplemented();
    }
  }
}

export default Host;
