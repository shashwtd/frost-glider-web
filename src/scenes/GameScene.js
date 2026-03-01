import Phaser from 'phaser';

// Terrain generation constants
const SEGMENT_WIDTH = 20;        // Width of each terrain segment in px
const TERRAIN_AHEAD = 80;        // How many segments to generate ahead of camera
const TERRAIN_BEHIND = 20;       // How many segments to keep behind camera
const BASE_Y = 0.55;             // Base terrain height as fraction of screen height
const HILL_AMPLITUDE = 120;      // Max hill height variation
const TERRAIN_THICKNESS = 600;   // How deep the terrain body extends below surface

// Player constants
const PLAYER_RADIUS = 14;
const PLAYER_START_X = 200;
const MIN_SPEED = 4;             // Minimum horizontal speed
const MAX_SPEED = 18;            // Maximum horizontal speed
const SPEED_GAIN_DOWNHILL = 0.04;
const SPEED_LOSS_UPHILL = 0.02;

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    this.gameWidth = this.scale.width;
    this.gameHeight = this.scale.height;

    // Terrain state
    this.terrainPoints = [];       // Array of {x, y} for the surface line
    this.terrainBodies = [];       // Matter.js bodies for terrain chunks
    this.terrainGraphics = null;
    this.nextTerrainX = 0;         // Next x position to generate terrain from
    this.furthestGeneratedX = 0;

    // Seed terrain params (layered sine waves for smooth hills)
    this.terrainSeed = Math.random() * 1000;

    // Generate initial terrain
    this.generateInitialTerrain();

    // Create player
    this.createPlayer();

    // Camera follows player
    this.cameras.main.startFollow(this.player, true, 0.1, 0.05);
    this.cameras.main.setFollowOffset(-this.gameWidth * 0.3, -50);

    // Speed / scoring
    this.playerSpeed = 6;
    this.score = 0;
    this.alive = true;

    // Score text (fixed to camera)
    this.scoreText = this.add.text(20, 20, 'Score: 0', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setScrollFactor(0).setDepth(100);

    this.speedText = this.add.text(20, 52, '', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ddeeff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setScrollFactor(0).setDepth(100);

    // Sky gradient background
    this.createSkyBackground();

    // Input for restart
    this.input.on('pointerdown', () => {
      if (!this.alive) this.scene.restart();
    });
    this.input.keyboard.on('keydown-R', () => {
      if (!this.alive) this.scene.restart();
    });

    // Collision detection
    this.matter.world.on('collisionstart', (event) => {
      for (const pair of event.pairs) {
        const labels = [pair.bodyA.label, pair.bodyB.label];
        if (labels.includes('player') && labels.includes('terrain')) {
          this.playerOnGround = true;
        }
      }
    });
  }

  getTerrainY(x) {
    // Layered sine waves for smooth, varied hills
    const s = this.terrainSeed;
    const baseY = this.gameHeight * BASE_Y;

    const y = baseY
      + Math.sin((x + s) * 0.002) * HILL_AMPLITUDE * 0.8
      + Math.sin((x + s) * 0.005) * HILL_AMPLITUDE * 0.5
      + Math.sin((x + s) * 0.01) * HILL_AMPLITUDE * 0.3
      + Math.sin((x + s) * 0.0007) * HILL_AMPLITUDE * 1.2;

    return y;
  }

  generateInitialTerrain() {
    // Generate terrain from behind the start to well ahead
    const startX = -SEGMENT_WIDTH * TERRAIN_BEHIND;
    const endX = this.gameWidth + SEGMENT_WIDTH * TERRAIN_AHEAD;

    for (let x = startX; x <= endX; x += SEGMENT_WIDTH) {
      this.terrainPoints.push({ x, y: this.getTerrainY(x) });
    }

    this.nextTerrainX = endX + SEGMENT_WIDTH;
    this.furthestGeneratedX = endX;

    // Build terrain bodies
    this.buildTerrainBodies();

    // Draw terrain
    this.terrainGraphics = this.add.graphics();
    this.drawTerrain();
  }

  buildTerrainBodies() {
    // Remove old bodies
    for (const body of this.terrainBodies) {
      this.matter.world.remove(body);
    }
    this.terrainBodies = [];

    // Create terrain from point pairs as trapezoid bodies
    for (let i = 0; i < this.terrainPoints.length - 1; i++) {
      const p1 = this.terrainPoints[i];
      const p2 = this.terrainPoints[i + 1];

      const cx = (p1.x + p2.x) / 2;
      const cy = (Math.max(p1.y, p2.y) + TERRAIN_THICKNESS / 2);

      const vertices = [
        { x: p1.x - cx, y: p1.y - cy },
        { x: p2.x - cx, y: p2.y - cy },
        { x: p2.x - cx, y: p2.y - cy + TERRAIN_THICKNESS },
        { x: p1.x - cx, y: p1.y - cy + TERRAIN_THICKNESS },
      ];

      const body = this.matter.add.fromVertices(cx, cy, vertices, {
        isStatic: true,
        friction: 0.002,
        restitution: 0.0,
        label: 'terrain',
      });

      if (body) {
        this.terrainBodies.push(body);
      }
    }
  }

  drawTerrain() {
    this.terrainGraphics.clear();

    // Draw filled terrain
    this.terrainGraphics.fillStyle(0xE8F0F8, 1); // Snow white-ish
    this.terrainGraphics.beginPath();

    const first = this.terrainPoints[0];
    this.terrainGraphics.moveTo(first.x, first.y);

    for (let i = 1; i < this.terrainPoints.length; i++) {
      this.terrainGraphics.lineTo(this.terrainPoints[i].x, this.terrainPoints[i].y);
    }

    // Close off the bottom
    const last = this.terrainPoints[this.terrainPoints.length - 1];
    this.terrainGraphics.lineTo(last.x, last.y + TERRAIN_THICKNESS);
    this.terrainGraphics.lineTo(first.x, first.y + TERRAIN_THICKNESS);
    this.terrainGraphics.closePath();
    this.terrainGraphics.fillPath();

    // Draw surface line (icy blue tint)
    this.terrainGraphics.lineStyle(3, 0xB0D4E8, 1);
    this.terrainGraphics.beginPath();
    this.terrainGraphics.moveTo(first.x, first.y);
    for (let i = 1; i < this.terrainPoints.length; i++) {
      this.terrainGraphics.lineTo(this.terrainPoints[i].x, this.terrainPoints[i].y);
    }
    this.terrainGraphics.strokePath();

    // Under-ice darker layer
    this.terrainGraphics.fillStyle(0xC8D8E8, 1);
    this.terrainGraphics.beginPath();
    this.terrainGraphics.moveTo(first.x, first.y + 8);
    for (let i = 1; i < this.terrainPoints.length; i++) {
      this.terrainGraphics.lineTo(this.terrainPoints[i].x, this.terrainPoints[i].y + 8);
    }
    this.terrainGraphics.lineTo(last.x, last.y + 40);
    this.terrainGraphics.lineTo(first.x, first.y + 40);
    this.terrainGraphics.closePath();
    this.terrainGraphics.fillPath();
  }

  extendTerrain() {
    const cameraRight = this.cameras.main.scrollX + this.gameWidth;
    const needed = cameraRight + SEGMENT_WIDTH * TERRAIN_AHEAD;

    let changed = false;

    // Add new points ahead
    while (this.furthestGeneratedX < needed) {
      this.furthestGeneratedX += SEGMENT_WIDTH;
      this.terrainPoints.push({
        x: this.furthestGeneratedX,
        y: this.getTerrainY(this.furthestGeneratedX),
      });
      changed = true;
    }

    // Remove points too far behind
    const cameraLeft = this.cameras.main.scrollX;
    const removeThreshold = cameraLeft - SEGMENT_WIDTH * TERRAIN_BEHIND;
    while (this.terrainPoints.length > 2 && this.terrainPoints[0].x < removeThreshold) {
      this.terrainPoints.shift();
      changed = true;
    }

    if (changed) {
      this.buildTerrainBodies();
      this.drawTerrain();
    }
  }

  createPlayer() {
    const startY = this.getTerrainY(PLAYER_START_X) - PLAYER_RADIUS - 10;

    this.player = this.matter.add.circle(PLAYER_START_X, startY, PLAYER_RADIUS, {
      friction: 0.001,
      restitution: 0.05,
      density: 0.002,
      label: 'player',
    });

    this.playerOnGround = false;

    // Visual for the player
    this.playerGraphics = this.add.graphics();
    this.playerGraphics.setDepth(10);
  }

  drawPlayer() {
    const px = this.player.position.x;
    const py = this.player.position.y;

    this.playerGraphics.clear();

    // Board (a line beneath the player)
    const angle = this.player.angle;
    const boardLen = 22;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Body (simple snowboarder silhouette)
    this.playerGraphics.fillStyle(0x2C3E50, 1);
    this.playerGraphics.fillCircle(px, py - 8, 7); // Head
    this.playerGraphics.fillRect(px - 3, py - 1, 6, 14); // Torso

    // Board
    this.playerGraphics.lineStyle(4, 0x1ABC9C, 1);
    this.playerGraphics.beginPath();
    this.playerGraphics.moveTo(px - boardLen * cos, py + 10 - boardLen * sin);
    this.playerGraphics.lineTo(px + boardLen * cos, py + 10 + boardLen * sin);
    this.playerGraphics.strokePath();

    // Scarf / trail effect
    this.playerGraphics.lineStyle(2, 0xE74C3C, 0.8);
    this.playerGraphics.beginPath();
    this.playerGraphics.moveTo(px, py - 4);
    this.playerGraphics.lineTo(px - 12 * cos - 5, py - 4 - 12 * sin + 2);
    this.playerGraphics.strokePath();
  }

  createSkyBackground() {
    // Simple gradient sky using a rectangle with gradient fill
    const sky = this.add.graphics();
    sky.setScrollFactor(0);
    sky.setDepth(-10);

    // Top of sky
    sky.fillGradientStyle(0x4A90C4, 0x4A90C4, 0x87CEEB, 0x87CEEB, 1);
    sky.fillRect(0, 0, this.gameWidth, this.gameHeight * 0.5);

    // Bottom of sky
    sky.fillGradientStyle(0x87CEEB, 0x87CEEB, 0xB8DBE8, 0xB8DBE8, 1);
    sky.fillRect(0, this.gameHeight * 0.5, this.gameWidth, this.gameHeight * 0.5);
  }

  update(time, delta) {
    if (!this.alive) return;

    // Calculate slope at player position for speed adjustment
    const px = this.player.position.x;
    const slopeAhead = this.getTerrainY(px + 20) - this.getTerrainY(px - 20);

    // Going downhill (positive slope = terrain goes down) -> speed up
    // Going uphill (negative slope) -> slow down
    if (slopeAhead > 0) {
      this.playerSpeed = Math.min(MAX_SPEED, this.playerSpeed + SPEED_GAIN_DOWNHILL * (slopeAhead / 10));
    } else {
      this.playerSpeed = Math.max(MIN_SPEED, this.playerSpeed + SPEED_LOSS_UPHILL * (slopeAhead / 10));
    }

    // Apply horizontal velocity
    this.matter.body.setVelocity(this.player, {
      x: this.playerSpeed,
      y: this.player.velocity.y,
    });

    // Extend terrain as we move
    this.extendTerrain();

    // Draw player
    this.drawPlayer();

    // Update score based on distance
    this.score = Math.floor(this.player.position.x / 10);
    this.scoreText.setText(`Score: ${this.score}`);
    this.speedText.setText(`Speed: ${this.playerSpeed.toFixed(1)}`);

    // Death check: if player falls way below terrain
    const terrainYAtPlayer = this.getTerrainY(px);
    if (this.player.position.y > terrainYAtPlayer + 300) {
      this.die();
    }
  }

  die() {
    this.alive = false;

    // Show game over
    const cx = this.cameras.main.scrollX + this.gameWidth / 2;
    const cy = this.cameras.main.scrollY + this.gameHeight / 2;

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
