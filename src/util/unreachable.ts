import { InvariantError } from "./Invariant";

class UnreachableInvariantError extends InvariantError {
  constructor() {
    super("UnreachableInvariantError", "Unreachable code reached");
  }
}

export default (): never => {
  throw new UnreachableInvariantError();
};
