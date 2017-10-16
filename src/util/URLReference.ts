class URLReference<Kind> {
  public readonly kind: Kind;
  public readonly url: URL;
  public constructor(kind: Kind, url: URL) {
    this.url = url;
  }

  public get parent(): URLReference<Kind> {
    return new URLReference(this.kind, new URL("..", this.url.href));
  }
}

export default URLReference;
