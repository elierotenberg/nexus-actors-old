import Process from "./Process";

export namespace Scheduling {
  export class Create<State> {
    public readonly child: Process.Reference;
    public readonly stance: Process.Stance<State>;
    constructor(child: Process.Reference, stance: Process.Stance<State>) {
      this.child = child;
      this.stance = stance;
    }
  }

  export class Terminate {
    public readonly target: Process.Reference;
    public readonly reason: any;
    constructor(target: Process.Reference, reason: any) {
      this.target = target;
      this.reason = reason;
    }
  }
}

export default Scheduling;
