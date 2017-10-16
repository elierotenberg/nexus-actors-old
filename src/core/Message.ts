import Process from "./Process";

namespace Message {
  export class Message {
    public readonly sender: Process.Reference;
    public readonly receiver: Process.Reference;
    public readonly payload: any;
    public constructor(
      sender: Process.Reference,
      receiver: Process.Reference,
      payload: any
    ) {
      this.sender = sender;
      this.receiver = receiver;
      this.payload = payload;
    }
  }
}

export default Message;
