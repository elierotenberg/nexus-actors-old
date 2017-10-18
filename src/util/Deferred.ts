import FSM from "./FSM";

type State = "pending" | "rejected" | "resolved";

const allowedStateTransitions: { [K in State]: Array<State> } = {
  pending: ["rejected", "resolved"],
  rejected: [],
  resolved: []
};

type DeferredFSM = FSM<State>;

class Deferred<Result> {
  private fsm: DeferredFSM;
  private readonly _promise: Promise<Result>;
  private _resolve: (result: Result) => any;
  private _reject: (reason: any) => any;

  public constructor() {
    this.fsm = new FSM("pending", allowedStateTransitions);
    this._promise = new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  public async join(): Promise<Result> {
    return this._promise;
  }

  public resolve(result: Result): void {
    this.fsm.assert(state => state === "pending");
    this.fsm.transitionTo("resolved");
    this._resolve(result);
  }

  public reject(reason: any): void {
    this.fsm.assert(state => state === "pending");
    this.fsm.transitionTo("rejected");
    this._reject(reason);
  }
}

export default Deferred;
