namespace Platform {
  export abstract class Platform {
    public clockTick(): number {
      return Date.now();
    }
  }
}

export default Platform;
