class URLReference<Kind> {
  public readonly kind: Kind;
  public readonly url: URL;
  public constructor(kind: Kind, url: URL) {
    this.url = url;
  }

  public get parent(): URLReference<Kind> {
    return new URLReference(this.kind, new URL("..", this.url.href));
  }

  public child(path: string): URLReference<Kind> {
    return new URLReference(this.kind, new URL(path, this.url.href));
  }

  public toString(): string {
    return JSON.stringify({ kind: this.kind, url: this.url.toString() });
  }

  owns(other: URLReference<any>): boolean {
    return other.url.pathname.startsWith(this.url.pathname);
  }
}

export default URLReference;
