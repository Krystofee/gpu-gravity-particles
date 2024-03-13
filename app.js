window.onload = function () {
  const G = 60.6743;
  const COMPUTE_BACKGROUND = true;
  const FRAMES_PER_RENDER = 10;

  const canvasElm = document.getElementById("canvas");
  const gpu = new GPU.GPU({ mode: "webgl2" });

  const WIDTH = canvasElm.clientWidth;
  const HEIGHT = canvasElm.clientHeight;

  const DEVICE_WIDTH = WIDTH * window.devicePixelRatio;
  const DEVICE_HEIGHT = HEIGHT * window.devicePixelRatio;

  const PIXEL_SCALE = 2;

  const SCALE = 1 / 8;
  const SCALED_WIDTH = Math.floor(WIDTH / SCALE);
  const SCALED_HEIGHT = Math.floor(HEIGHT / SCALE);

  function initParticles(particles) {
    function addParticle(mass, p, v, isStatic = false) {
      particles.push({
        id: particles.length,
        mass: mass,
        position: p,
        velocity: v,
        isStatic,
      });
    }

    function addGalaxy(mass, C, R, N) {
      for (let i = 0; i < N; i++) {
        const r = R * Math.sqrt(Math.random());
        const theta = Math.random() * 2 * Math.PI;

        const p = C.add(new Vec2(r * Math.sin(theta), r * Math.cos(theta)));

        const v = C.distance(p)
          .normal()
          .normalize()
          .numMul(Math.random() * Math.sqrt((G * 100) / r) * 5);

        // const v = new Vec2(0, 0);

        addParticle(20, p, v);
      }

      addParticle(mass, C, new Vec2(0, 0), true);
    }

    addGalaxy(500, new Vec2(SCALED_WIDTH / 2, SCALED_HEIGHT / 2), 1000, 20000);
    addGalaxy(5000, new Vec2(SCALED_WIDTH / 2 - 1000, SCALED_HEIGHT / 2), 1000, 2000);
  }

  let particles = new Array();
  initParticles(particles);

  const particlesCount = particles.length;

  const computeForcesKernel = gpu
    .createKernel(function (particlesVec4, deviceWidth, deviceHeight, devicePixelRatio, SCALE, G) {
      const x = this.thread.x;
      const y = this.thread.y;

      let totalAx = 0.0;
      let totalAy = 0.0;

      for (let i = 0; i < this.constants.particlesCount; i++) {
        const px = particlesVec4[i][0] * SCALE * devicePixelRatio;
        const py = particlesVec4[i][1] * SCALE * devicePixelRatio;
        const mass = particlesVec4[i][2];

        const dx = x - px;
        const dy = y - py;
        const dSq = dx * dx + dy * dy;

        const fMagnitude = (G * mass) / (dSq + 0.00000001);
        const distInv = 1.0 / Math.sqrt(dSq + 0.00000001);
        totalAx += dx * fMagnitude * distInv;
        totalAy += dy * fMagnitude * distInv;
      }

      const accelerationMagnitude = Math.sqrt(totalAx * totalAx + totalAy * totalAy);
      const cappedAcceleration = Math.min(accelerationMagnitude, 400);
      const normalizedAcceleration = cappedAcceleration / 400;
      const shadow = Math.pow(normalizedAcceleration, 0.5) * 255;

      return [shadow, 0, 255 - shadow, 255]; // Return RGBA values.
    })
    .setOutput([DEVICE_WIDTH, DEVICE_HEIGHT])
    .setConstants({ particlesCount });

  class Canvas {
    SHOW_TEXT = false;

    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");

      this.imageData = null;

      this.init();
    }

    init() {
      var canvasWidth = this.canvas.width;
      var canvasHeight = this.canvas.height;

      this.canvas.width = canvasWidth * window.devicePixelRatio;
      this.canvas.height = canvasHeight * window.devicePixelRatio;
      this.canvas.style.width = canvasWidth + "px";
      this.canvas.style.height = canvasHeight + "px";

      this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

      this.ctx.fillStyle = `rgb(255, 255, 255)`;
      this.ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    renderBackground(particles) {
      if (COMPUTE_BACKGROUND || !this.imageData) {
        const particlesVec4 = particles.map((p) => [p.position.x, p.position.y, p.mass, 0]);
        const output = computeForcesKernel(particlesVec4, DEVICE_WIDTH, DEVICE_HEIGHT, window.devicePixelRatio, SCALE, G);
        this.imageData = new ImageData(DEVICE_WIDTH, DEVICE_HEIGHT);
        let k = 0; // Position in imageData.data

        for (let i = 0; i < output.length; i++) {
          for (let j = 0; j < output[i].length; j++) {
            const color = output[i][j];
            this.imageData.data[k++] = color[0];
            this.imageData.data[k++] = color[1];
            this.imageData.data[k++] = color[2];
            this.imageData.data[k++] = color[3]; // Alpha
          }
        }
      }

      this.ctx.putImageData(this.imageData, 0, 0);
    }

    render(particles) {
      // first run, compute background
      this.renderBackground(particles);

      this.ctx.fillStyle = `rgb(0, 0, 0)`;
      this.ctx.font = "10px Arial";

      particles.forEach((p) => {
        let pixelScale = PIXEL_SCALE;

        if (p.isStatic) {
          pixelScale *= 4;
        }

        this.ctx.fillRect(
          Math.floor(p.position.x) * SCALE,
          Math.floor(p.position.y) * SCALE,
          SCALE + pixelScale,
          SCALE + pixelScale
        );

        if (this.SHOW_TEXT) {
          const v = Math.round(Math.sqrt(Math.pow(p.velocity.x, 2) + Math.pow(p.velocity.y, 2)) * 100);

          this.ctx.font = `10px Arial`;
          this.ctx.fillText(
            `[${Math.round(p.position.x)}, ${Math.round(p.position.y)}], <${Math.round(p.velocity.x * 100)}, ${Math.round(
              p.velocity.y * 100
            )}> ${v}`,
            p.position.x * SCALE,
            p.position.y * SCALE
          );
        }
      });
    }
  }

  const canvas = new Canvas(canvasElm);

  function render() {
    canvas.render(particles);

    const totalVelocity = particles.reduce((acc, p) => Math.sqrt(Math.pow(p.velocity.x, 2) + Math.pow(p.velocity.y, 2)), 0);
    canvas.ctx.fillText(`Velocity sum: ${totalVelocity}`, 10, 10);
  }

  const simulateKernel = gpu
    .createKernel(function (particlesVec4, particlesVec3, G, SOFTENING) {
      const idx = this.thread.x;
      const px = particlesVec4[idx][0];
      const py = particlesVec4[idx][1];
      let vx = particlesVec4[idx][2];
      let vy = particlesVec4[idx][3];
      const mass = particlesVec3[idx][0];
      const isStatic = particlesVec3[idx][2];

      if (isStatic == 1.0) {
        return [px, py, vx, vy];
      }

      let ax = 0.0;
      let ay = 0.0;

      for (let i = 0; i < this.constants.particlesCount; i++) {
        if (idx == i) continue;

        const oPx = particlesVec4[i][0];
        const oPy = particlesVec4[i][1];
        const oMass = particlesVec3[i][0];

        const dx = oPx - px;
        const dy = oPy - py;
        const dSq = dx * dx + dy * dy;

        const f = (G * mass * oMass) / (dSq + 1);
        const distInv = 1.0 / Math.sqrt(dSq + SOFTENING);

        ax += dx * f * distInv;
        ay += dy * f * distInv;
      }

      vx += ax / mass;
      vy += ay / mass;

      return [px + vx, py + vy, vx, vy];
    })
    .setOutput([particlesCount])
    .setConstants({ particlesCount });

  function simulate() {
    const particlesVec4 = particles.map((p) => [p.position.x, p.position.y, p.velocity.x, p.velocity.y]);
    const particlesVec3 = particles.map((p) => [p.mass, p.id, p.isStatic ? 1.0 : 0.0]);

    const newParticlesVec4 = simulateKernel(particlesVec4, particlesVec3, G, 0.1e7);

    particles = particles.map((p, i) => ({
      ...p,
      position: new Vec2(newParticlesVec4[i][0], newParticlesVec4[i][1]),
      velocity: new Vec2(newParticlesVec4[i][2], newParticlesVec4[i][3]),
    }));
    // .filter((p) => p.position.x >= 0 && p.position.y >= 0 && p.position.x <= SCALED_WIDTH && p.position.y <= SCALED_HEIGHT);
  }

  function run() {
    for (let i = 0; i <= FRAMES_PER_RENDER; i++) {
      simulate();
    }

    render();

    requestAnimationFrame(run);
  }

  run();
};
