const G = 2;

class Canvas {
  SHOW_TEXT = false;

  SCALE = 0.125;
  PIXEL_SCALE = 2;

  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");

    this.WIDTH = canvas.clientWidth;
    this.HEIGHT = canvasElm.clientHeight;

    this.DEVICE_WIDTH = this.WIDTH * window.devicePixelRatio;
    this.DEVICE_HEIGHT = this.HEIGHT * window.devicePixelRatio;

    this.SCALED_WIDTH = Math.floor(this.WIDTH / this.SCALE);
    this.SCALED_HEIGHT = Math.floor(this.HEIGHT / this.SCALE);

    this.imageData = null;

    this.init();
  }

  init() {
    if (window.devicePixelRatio > 1) {
      var canvasWidth = this.canvas.width;
      var canvasHeight = this.canvas.height;

      this.canvas.width = canvasWidth * window.devicePixelRatio;
      this.canvas.height = canvasHeight * window.devicePixelRatio;
      this.canvas.style.width = canvasWidth + "px";
      this.canvas.style.height = canvasHeight + "px";

      this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    this.ctx.fillStyle = `rgb(255, 255, 255)`;
    this.ctx.fillRect(0, 0, this.WIDTH, this.HEIGHT);
  }

  renderBackground(particles) {
    if (!this.imageData) {
      const imageData = this.ctx.createImageData(this.DEVICE_WIDTH, this.DEVICE_HEIGHT);
      const data = imageData.data;

      const staticParticles = particles.filter((p) => p.isStatic);

      // for (let i = 0; i < data.length; i += 4) {
      //   data[i] = Math.floor(Math.random() * 255);
      //   data[i + 1] = Math.floor(Math.random() * 255);
      //   data[i + 2] = Math.floor(Math.random() * 255);
      //   data[i + 3] = 255;
      // }

      let pixelForces = new Uint32Array(this.DEVICE_HEIGHT * this.DEVICE_WIDTH);
      let maxForce = -Infinity;
      let minForce = Infinity;

      for (let y = 0; y < this.DEVICE_HEIGHT; y++) {
        for (let x = 0; x < this.DEVICE_WIDTH; x++) {
          const point = new Vec2(x, y);

          // compute force which influences on every pixel on the screen,
          // which is generated by the static particles
          let acceleration = staticParticles.reduce((acc, p) => {
            const dist = point.distance(p.position.numMul(this.SCALE * window.devicePixelRatio));
            const dSq = dist.lengthSq();
            const f = (G * p.mass) / (dSq + 0.0001);

            const result = Math.min((dist.length() * f) / Math.sqrt(dSq), 10);

            if (result.toString() === "NaN") return acc + 0.1;

            return acc + result;
          }, 0);

          pixelForces[y * this.DEVICE_HEIGHT + x] = acceleration;
          maxForce = Math.max(maxForce, acceleration);
          minForce = Math.min(minForce, acceleration);

          // console.log("Set", y * this.SCALED_HEIGHT + x, " to", acceleration);
        }
      }

      if (maxForce == NaN) throw new Error("max force is nan");
      if (minForce == NaN) throw new Error("min force is nan");

      pixelForces = pixelForces.map((n) => (n / maxForce) * 255);

      for (let i = 0; i < data.length; i += 4) {
        const shadow = Math.floor(pixelForces[i / 4]);
        data[i] = shadow;
        data[i + 1] = 0;
        data[i + 2] = 255 - shadow;
        data[i + 3] = 255;
      }

      this.imageData = imageData;
    }

    this.ctx.putImageData(this.imageData, 0, 0);
  }

  render(particles) {
    // first run, compute background
    this.renderBackground(particles);

    this.ctx.fillStyle = `rgb(0, 0, 0)`;
    this.ctx.font = "10px Arial";

    particles.forEach((p) => {
      let pixelScale = this.PIXEL_SCALE;

      if (p.isStatic) {
        pixelScale *= 4;
      }

      this.ctx.fillRect(
        Math.floor(p.position.x) * this.SCALE,
        Math.floor(p.position.y) * this.SCALE,
        this.SCALE + pixelScale,
        this.SCALE + pixelScale
      );

      if (this.SHOW_TEXT) {
        const v = Math.round(Math.sqrt(Math.pow(p.velocity.x, 2) + Math.pow(p.velocity.y, 2)) * 100);

        this.ctx.font = `10px Arial`;
        this.ctx.fillText(
          `[${Math.round(p.position.x)}, ${Math.round(p.position.y)}], <${Math.round(p.velocity.x * 100)}, ${Math.round(
            p.velocity.y * 100
          )}> ${v}`,
          p.position.x * this.SCALE,
          p.position.y * this.SCALE
        );
      }
    });
  }
}

const canvasElm = document.getElementById("canvas");
const canvas = new Canvas(canvasElm);

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
        .to1()
        .numMul(Math.random() * 10);

      addParticle(1, p, v);
    }

    addParticle(mass, C, new Vec2(0, 0), true);
  }

  addGalaxy(20000, new Vec2(canvas.SCALED_WIDTH / 2 + 1000, canvas.SCALED_HEIGHT / 2), 512, 100);
  addGalaxy(100000, new Vec2(canvas.SCALED_WIDTH / 2 - 500, canvas.SCALED_HEIGHT / 2), 700, 100);
}

let particles = new Array();
initParticles(particles);

function render() {
  canvas.render(particles);

  const totalVelocity = particles.reduce((acc, p) => Math.sqrt(Math.pow(p.velocity.x, 2) + Math.pow(p.velocity.y, 2)), 0);
  canvas.ctx.fillText(`Velocity sum: ${totalVelocity}`, 10, 10);
}

function simulate() {
  particles = particles.map((p) => {
    if (p.isStatic) return p;

    // compute forces from other particles using newton's law of universal gravitation
    const a = new Vec2(0, 0);

    particles.forEach((oP) => {
      if (p.id === oP.id) {
        return;
      }

      // distance
      const dist = p.position.distance(oP.position);
      const dSq = dist.lengthSq();

      const f = (G * p.mass * oP.mass) / (dSq + 1);
      a.inAdd(dist.numMul(f).numDiv(Math.sqrt(dSq)));
    });

    // compute velocity
    const v = p.velocity.add(a.numDiv(p.mass));

    // compute position
    const newPosition = p.position.add(v);

    return {
      ...p,
      position: newPosition,
      velocity: v,
    };
  });
}

function run() {
  simulate();
  render();

  requestAnimationFrame(run);
  // setTimeout(run, 100);
}

run();
