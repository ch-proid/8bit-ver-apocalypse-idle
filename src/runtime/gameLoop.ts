export type FixedStepCallback = (dt: number, alpha: number) => void;

export class FixedStepLoop {
  private accumulator = 0;
  private previousTime = 0;
  private frameId = 0;
  private running = false;

  constructor(
    private readonly fixedDelta: number,
    private readonly callback: FixedStepCallback,
  ) {}

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.previousTime = performance.now();
    this.frameId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frameId);
  }

  private readonly frame = (time: number): void => {
    if (!this.running) {
      return;
    }

    const delta = Math.min(0.25, (time - this.previousTime) / 1000);
    this.previousTime = time;
    this.accumulator += delta;

    while (this.accumulator >= this.fixedDelta) {
      this.callback(this.fixedDelta, 1);
      this.accumulator -= this.fixedDelta;
    }

    this.callback(0, this.accumulator / this.fixedDelta);
    this.frameId = requestAnimationFrame(this.frame);
  };
}
