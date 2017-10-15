import Process from "./Process";

namespace Router {
  export class Packet<Kind, Payload> {
    public readonly target: Process.Reference;
    public readonly kind: Kind;
    public readonly payload: Payload;
    public constructor(
      target: Process.Reference,
      kind: Kind,
      payload: Payload
    ) {
      this.target = target;
      this.kind = kind;
      this.payload = payload;
    }
  }

  export type Routable =
    | "Message"
    | "SupervisionRequest"
    | "SupervisionResponse";

  export interface Router<Payload> {
    (kind: Routable, target: Process.Reference, payload: Payload): Promise<
      void
    >;
  }
}

export default Router;
