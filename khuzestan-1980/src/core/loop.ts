import { MAX_FRAME_TIME, SIM_DT } from './constants';

/**
 * Fixed-timestep loop: the simulation always advances in SIM_DT steps (deterministic),
 * while rendering runs once per animation frame. `timeScale` implements pause / fast-forward.
 */
export class GameLoop {
  timeScale = 1;
  paused = false;
  private acc = 0;
  private last = 0;
  private raf = 0;
  private running = false;

  constructor(
    private update: (dt: number) => void,
    private render: (frameDt: number, alpha: number) => void,
  ) {}

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const frame = (now: number) => {
      if (!this.running) return;
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > MAX_FRAME_TIME) dt = MAX_FRAME_TIME;
      if (!this.paused) {
        this.acc += dt * this.timeScale;
        // Cap steps per frame so a slow frame cannot snowball.
        let steps = 0;
        while (this.acc >= SIM_DT && steps < 8) {
          this.update(SIM_DT);
          this.acc -= SIM_DT;
          steps++;
        }
        if (steps === 8) this.acc = 0;
      }
      this.render(dt, this.acc / SIM_DT);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
}
