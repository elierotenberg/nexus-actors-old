import Message from "./Message";
import Supervision from "./Supervision";
import Scheduling from "./Scheduling";

namespace Packet {
  export type Packet =
    | Message.Message
    | Supervision.Request
    | Supervision.Response
    | Scheduling.Create<any>
    | Scheduling.Terminate;
}

export default Packet;
