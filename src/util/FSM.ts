import { InvariantError } from "./Invariant";

type AllowedStateTransitions<State extends string> = {
  [Substate in State]: Array<State>
};

class FSMInvariantError<State extends string> extends InvariantError {
  constructor(description: string) {
    super("FSMInvariantError", description);
  }
}

class FSM<State extends string> {
  private state: State;
  private allowedStateTransitions: AllowedStateTransitions<State>;
  public constructor(
    initialState: State,
    allowedStateTransitions: AllowedStateTransitions<State>
  ) {
    this.state = initialState;
    this.allowedStateTransitions = allowedStateTransitions;
  }

  public test(predicate: (state: State) => boolean): boolean {
    return predicate(this.state);
  }

  public assert(predicate: (state: State) => boolean) {
    if (!predicate(this.state)) {
      throw new FSMInvariantError("Assertion not matched");
    }
  }

  public transitionTo(nextState: State) {
    if (!this.allowedStateTransitions[this.state].includes(nextState)) {
      throw new FSMInvariantError(
        `Transition from '${this.state}' to '${nextState}' is not allowed`
      );
    }
    this.state = nextState;
  }
}

export default FSM;
