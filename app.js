const WIDTH = 512;
const HEIGHT = 512;
const TIMEOUT = 1000;

const G = 0.1;

class Canvas {
  SCALE = 1;
  PIXEL_SCALE = 4;

  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");

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
    this.ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  render(particles) {
    this.ctx.fillStyle = `rgb(255, 255, 255)`;
    this.ctx.fillRect(0, 0, WIDTH, HEIGHT);

    this.ctx.fillStyle = `rgb(0, 0, 0)`;
    this.ctx.font = "10px Arial";

    particles.forEach((p) => {
      this.ctx.fillRect(
        Math.floor(p.position.x) * this.SCALE,
        Math.floor(p.position.y) * this.SCALE,
        this.SCALE + this.PIXEL_SCALE,
        this.SCALE + this.PIXEL_SCALE
      );

      const v = Math.round(Math.sqrt(Math.pow(p.velocity.x, 2) + Math.pow(p.velocity.y, 2)) * 100);

      this.ctx.font = `10px Arial`;
      this.ctx.fillText(
        `[${Math.round(p.position.x)}, ${Math.round(p.position.y)}], <${Math.round(p.velocity.x * 100)}, ${Math.round(
          p.velocity.y * 100
        )}> ${v}`,
        p.position.x * this.SCALE,
        p.position.y * this.SCALE
      );
    });
  }
}

const canvas = new Canvas(document.getElementById("canvas"));

function initParticles(particles) {
  function addParticle(mass, y, x, vy = 0, vx = 0) {
    particles.push({
      id: particles.length,
      mass: mass,
      position: {
        x: x,
        y: y,
      },
      velocity: {
        x: vx,
        y: vy,
      },
    });
  }

  // put particles inside circle
  const X = 200,
    Y = 200,
    R = 100;

  for (let i = 0; i < 10; i++) {
    const r = R * Math.sqrt(Math.random());
    const theta = Math.random() * 2 * Math.PI;

    const pX = X + r * Math.sin(theta);
    const pY = Y + r * Math.cos(theta);

    addParticle(1, pY, pX);
  }

  addParticle(100, Y, X);
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
    // compute forces from other particles using newton's law of universal gravitation
    let ay = 0,
      ax = 0;

    particles.forEach((oP) => {
      if (p.id === oP.id) {
        return;
      }

      // distance
      const dx = oP.position.x - p.position.x;
      const dy = oP.position.y - p.position.y;
      const dSq = Math.pow(dx, 2) + Math.pow(dy, 2);
      const d = Math.sqrt(dSq);

      const f = (G * p.mass * oP.mass) / (dSq + 0.001);
      ay += (f * dy) / d;
      ax += (f * dx) / d;
    });

    // compute velocity
    let vy = p.velocity.y + ay / p.mass;
    let vx = p.velocity.x + ax / p.mass;

    // compute position
    y = p.position.y + vy;
    x = p.position.x + vx;

    // check for overflows
    if (x < 0) {
      vx *= -0.9;
      x += 1;
    }
    if (x > WIDTH) {
      vx *= -0.9;
      x -= 1;
    }
    if (y < 0) {
      vy *= -0.9;
      y += 1;
    }
    if (y > HEIGHT) {
      vy *= -0.9;
      y -= 1;
    }

    return {
      ...p,
      position: {
        x,
        y,
      },
      velocity: {
        x: vx,
        y: vy,
      },
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
