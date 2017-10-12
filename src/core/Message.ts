import Process from "./Process";

type Message = {
  sender: Process.Reference;
  receiver: Process.Reference;
  payload: any;
};

export default Message;
