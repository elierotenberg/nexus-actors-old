import { InvariantError } from "./Invariant";

class NotImplementedInvariantError extends InvariantError {
  constructor() {
    super("NotImplementedInvariantError", "Not implemented code reached");
  }
}

export default (): never => {
  throw new NotImplementedInvariantError();
};
