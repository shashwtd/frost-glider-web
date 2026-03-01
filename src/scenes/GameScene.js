import Phaser from 'phaser';

// Terrain chunks
const CHUNK_WIDTH = 600;         // Each chunk covers 600px
const POINT_SPACING = 10;        // Points within each chunk
const CHUNKS_AHEAD = 4;          // Chunks to keep ahead of camera
const CHUNKS_BEHIND = 2;         // Chunks to keep behind camera
const HILL_AMPLITUDE = 130;
const FILL_BOTTOM = 2000;        // Absolute Y for fill bottom (way off screen)

// Player
const GRAVITY = 0.4;
const MIN_SPEED = 1.8;
const MAX_SPEED = 9;
const START_SPEED = 3;

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    this.gameWidth = this.scale.width;
    this.gameHeight = this.scale.height;
    this.baseY = this.gameHeight * 0.5;

    this.terrainSeed = Math.random() * 10000;

    // Chunk management: Map of chunkIndex → { ground, detail } graphics objects
    this.chunks = new Map();

    // Player state
    this.px = 300;
    this.py = this.getTerrainY(300) - 20;
    this.vx = START_SPEED;
    this.vy = 0;
    this.grounded = false;
    this.score = 0;
    this.alive = true;

    // Layers
    this.createSkyBackground();
    this.playerGraphics = this.add.graphics().setDepth(10);

    // Generate initial chunks
    this.updateChunks();

    // HUD
    this.scoreText = this.add.text(20, 20, 'Score: 0', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setScrollFactor(0).setDepth(100);

    // Restart
    this.input.on('pointerdown', () => {
      if (!this.alive) this.scene.restart();
    });
    this.input.keyboard.on('keydown-R', () => {
      if (!this.alive) this.scene.restart();
    });
  }

  // ── Terrain math (deterministic, no stored points needed) ──────

  getTerrainY(x) {
    const s = this.terrainSeed;
    return this.baseY
      + Math.sin((x + s) * 0.0003) * HILL_AMPLITUDE * 1.6
      + Math.sin((x + s) * 0.0009) * HILL_AMPLITUDE * 0.9
      + Math.sin((x + s) * 0.0025) * HILL_AMPLITUDE * 0.35
      + Math.sin((x + s) * 0.006) * HILL_AMPLITUDE * 0.08;
  }

  getTerrainSlope(x) {
    const dx = 4;
    return (this.getTerrainY(x + dx) - this.getTerrainY(x - dx)) / (dx * 2);
  }

  // ── Chunk system ───────────────────────────────────────────────

  getChunkIndex(x) {
    return Math.floor(x / CHUNK_WIDTH);
  }

  // Simple deterministic hash for icicle placement
  seededRandom(seed) {
    const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  createChunk(index) {
    const startX = index * CHUNK_WIDTH;
    const endX = startX + CHUNK_WIDTH;

    const points = [];
    for (let x = startX; x <= endX + POINT_SPACING; x += POINT_SPACING) {
      points.push({ x, y: this.getTerrainY(x) });
    }

    const first = points[0];
    const last = points[points.length - 1];

    const ground = this.add.graphics().setDepth(1);

    // Clean snow fill — just white, all the way down
    ground.fillStyle(0xF0F4F8, 1);
    ground.beginPath();
    ground.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i++) ground.lineTo(points[i].x, points[i].y);
    ground.lineTo(last.x, FILL_BOTTOM);
    ground.lineTo(first.x, FILL_BOTTOM);
    ground.closePath();
    ground.fillPath();

    // Subtle depth shadow — very soft blue tint just below surface
    ground.fillStyle(0xDAE3ED, 0.35);
    ground.beginPath();
    ground.moveTo(first.x, first.y + 40);
    for (let i = 1; i < points.length; i++) ground.lineTo(points[i].x, points[i].y + 40);
    ground.lineTo(last.x, FILL_BOTTOM);
    ground.lineTo(first.x, FILL_BOTTOM);
    ground.closePath();
    ground.fillPath();

    // Deeper shadow — slightly more blue further down
    ground.fillStyle(0xC4D0DE, 0.3);
    ground.beginPath();
    ground.moveTo(first.x, first.y + 150);
    for (let i = 1; i < points.length; i++) ground.lineTo(points[i].x, points[i].y + 150);
    ground.lineTo(last.x, FILL_BOTTOM);
    ground.lineTo(first.x, FILL_BOTTOM);
    ground.closePath();
    ground.fillPath();

    this.chunks.set(index, { ground });
  }

  destroyChunk(index) {
    const chunk = this.chunks.get(index);
    if (chunk) {
      chunk.ground.destroy();
      this.chunks.delete(index);
    }
  }

  updateChunks() {
    const cam = this.cameras.main;
    const camLeft = cam.scrollX;
    const camRight = camLeft + this.gameWidth;

    const minChunk = this.getChunkIndex(camLeft) - CHUNKS_BEHIND;
    const maxChunk = this.getChunkIndex(camRight) + CHUNKS_AHEAD;

    // Create needed chunks
    for (let i = minChunk; i <= maxChunk; i++) {
      if (!this.chunks.has(i)) {
        this.createChunk(i);
      }
    }

    // Destroy far-away chunks
    for (const [index] of this.chunks) {
      if (index < minChunk - 1 || index > maxChunk + 1) {
        this.destroyChunk(index);
      }
    }
  }

  // ── Sky ─────────────────────────────────────────────────────────

  createSkyBackground() {
    const sky = this.add.graphics().setScrollFactor(0).setDepth(-10);
    const h = this.gameHeight;
    const w = this.gameWidth;

    const bands = [
      { y: 0,        h: h * 0.25, top: 0x2B4970, bot: 0x3A6B8F },
      { y: h * 0.25, h: h * 0.25, top: 0x3A6B8F, bot: 0x5B9BBF },
      { y: h * 0.50, h: h * 0.25, top: 0x5B9BBF, bot: 0x89BDD6 },
      { y: h * 0.75, h: h * 0.25, top: 0x89BDD6, bot: 0xB8D8E8 },
    ];

    for (const band of bands) {
      sky.fillGradientStyle(band.top, band.top, band.bot, band.bot, 1);
      sky.fillRect(0, band.y, w, band.h);
    }
  }

  // ── Player ──────────────────────────────────────────────────────

  updatePlayer() {
    const slope = this.getTerrainSlope(this.px);

    if (this.grounded) {
      const slopeForce = slope * 0.06;
      this.vx += slopeForce;
      this.vx = Phaser.Math.Clamp(this.vx, MIN_SPEED, MAX_SPEED);

      this.px += this.vx;

      const newTerrainY = this.getTerrainY(this.px);
      this.py = newTerrainY;

      // Launch off crests
      const nextTerrainY = this.getTerrainY(this.px + this.vx);
      if (nextTerrainY - newTerrainY > 2) {
        this.grounded = false;
        this.vy = slope * this.vx;
      }
    } else {
      this.vy += GRAVITY;
      this.px += this.vx;
      this.py += this.vy;

      const groundY = this.getTerrainY(this.px);
      if (this.py >= groundY) {
        this.py = groundY;
        this.vy = 0;
        this.grounded = true;
      }
    }
  }

  drawPlayer() {
    const px = this.px;
    const py = this.py;
    this.playerGraphics.clear();

    const slope = this.getTerrainSlope(px);
    const angle = this.grounded ? Math.atan(slope) : Math.atan2(this.vy, this.vx) * 0.3;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Snowboard
    const boardLen = 18;
    const boardY = py - 2;
    this.playerGraphics.lineStyle(3.5, 0x1ABC9C, 1);
    this.playerGraphics.beginPath();
    this.playerGraphics.moveTo(px - boardLen * cos, boardY + boardLen * sin);
    this.playerGraphics.lineTo(px + boardLen * cos, boardY - boardLen * sin);
    this.playerGraphics.strokePath();

    // Legs
    this.playerGraphics.lineStyle(2, 0x2C3E50, 1);
    this.playerGraphics.beginPath();
    this.playerGraphics.moveTo(px - 3, boardY);
    this.playerGraphics.lineTo(px - 1, py - 12);
    this.playerGraphics.moveTo(px + 4, boardY);
    this.playerGraphics.lineTo(px + 1, py - 12);
    this.playerGraphics.strokePath();

    // Torso
    this.playerGraphics.fillStyle(0x34495E, 1);
    this.playerGraphics.fillRect(px - 3, py - 22, 6, 11);

    // Head
    this.playerGraphics.fillStyle(0x2C3E50, 1);
    this.playerGraphics.fillCircle(px, py - 27, 5);

    // Scarf
    this.playerGraphics.lineStyle(2.5, 0xE74C3C, 0.9);
    this.playerGraphics.beginPath();
    this.playerGraphics.moveTo(px, py - 22);
    this.playerGraphics.lineTo(px - 12, py - 25);
    this.playerGraphics.lineTo(px - 22, py - 22);
    this.playerGraphics.strokePath();
  }

  // ── Game loop ───────────────────────────────────────────────────

  update() {
    if (!this.alive) return;

    this.updatePlayer();

    // Smooth camera
    const cam = this.cameras.main;
    const targetX = this.px - this.gameWidth * 0.3;
    const targetY = this.py - this.gameHeight * 0.55;
    cam.scrollX += (targetX - cam.scrollX) * 0.08;
    cam.scrollY += (targetY - cam.scrollY) * 0.04;

    this.updateChunks();
    this.drawPlayer();

    this.score = Math.floor(this.px / 10);
    this.scoreText.setText(`Score: ${this.score}`);

    if (this.py > this.getTerrainY(this.px) + 600) {
      this.die();
    }
  }

  die() {
    this.alive = false;

    this.add.text(this.gameWidth / 2, this.gameHeight / 2 - 30, 'GAME OVER', {
      fontFamily: 'monospace',
      fontSize: '48px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 5,
    }).setScrollFactor(0).setOrigin(0.5).setDepth(100);

    this.add.text(this.gameWidth / 2, this.gameHeight / 2 + 30, `Score: ${this.score}\nClick or press R to restart`, {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#ddeeff',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
    }).setScrollFactor(0).setOrigin(0.5).setDepth(100);
  }
}
