import Host from "../core/Host";
import Process from "../core/Process";

namespace Cluster {
  export abstract class Cluster {
    public abstract publishPacket(packet: Host.Packet): Promise<void>;
    public abstract claimProcess(process: Process.Reference): Promise<void>;
    public abstract unclaimProcess(process: Process.Reference): Promise<void>;
  }
}

export default Cluster;
