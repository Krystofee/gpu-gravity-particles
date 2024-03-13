class Vec2 {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  normal() {
    return new Vec2(this.y, -this.x);
  }

  normalize() {
    const l = this.length();
    this.x = this.x / l;
    this.y = this.y / l;
    return this;
  }

  invert() {
    return new Vec2(-this.x, -this.y);
  }

  distance(other) {
    return new Vec2(other.x - this.x, other.y - this.y);
  }

  lengthSq() {
    return this.x * this.x + this.y * this.y;
  }

  length() {
    return Math.sqrt(this.lengthSq());
  }

  inAdd(other) {
    this.x += other.x;
    this.y += other.y;
    return this;
  }

  add(other) {
    return new Vec2(this.x + other.x, this.y + other.y);
  }

  inSub(other) {
    this.x -= other.x;
    this.y -= other.y;
    return this;
  }

  sub(other) {
    return new Vec2(this.x - other.x, this.y - other.y);
  }

  numMul(n) {
    return new Vec2(this.x * n, this.y * n);
  }

  numDiv(n) {
    return new Vec2(this.x / n, this.y / n);
  }
}
