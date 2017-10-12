type Assertion = () => boolean;

class InvariantError extends Error {
  constructor(kind: string = "InvariantError", description: string) {
    const message = `${kind}: ${description}`;
    super(message);
    Object.setPrototypeOf(this, InvariantError.prototype);
  }
}

export { InvariantError };
