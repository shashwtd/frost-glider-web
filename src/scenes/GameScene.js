import Phaser from 'phaser';

// Terrain chunks
const CHUNK_WIDTH = 600;
const POINT_SPACING = 10;
const CHUNKS_AHEAD = 4;
const CHUNKS_BEHIND = 2;
const HILL_AMPLITUDE = 130;
const FILL_BOTTOM = 2000;

// Player
const GRAVITY = 0.18;
const MIN_SPEED = 1.8;
const MAX_SPEED = 5;
const START_SPEED = 3;
const JUMP_FORCE = -6;
const PLAYER_SCALE = 0.22;
const PLAYER_JUMP_SCALE = 0.18;

// Trail
const TRAIL_LENGTH = 45;
const TRAIL_FADE_SPEED = 0.012;

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    this.load.image('character', '/character.png');
    this.load.image('character-jump', '/character-jump.png');

    // Parallax background layers
    const bgPath = '/game_background_1/layers/';
    this.load.image('clouds_1', bgPath + 'clouds_1.png');
    this.load.image('clouds_2', bgPath + 'clouds_2.png');
    this.load.image('clouds_3', bgPath + 'clouds_3.png');
    this.load.image('clouds_4', bgPath + 'clouds_4.png');
    this.load.image('rocks_1', bgPath + 'rocks_1.png');
    this.load.image('rocks_2', bgPath + 'rocks_2.png');
  }

  create() {
    this.gameWidth = this.scale.width;
    this.gameHeight = this.scale.height;
    this.baseY = this.gameHeight * 0.5;

    this.terrainSeed = Math.random() * 10000;
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
    this.createParallaxLayers();

    // Generate initial chunks
    this.updateChunks();

    // Snowfall (fixed to camera, behind everything gameplay)
    this.snowfallGraphics = this.add.graphics().setScrollFactor(0).setDepth(-5);
    this.snowflakes = [];
    this.initSnowfall();

    // Trail (drawn behind player)
    this.trailGraphics = this.add.graphics().setDepth(5);
    this.trailPoints = [];

    // Snow puff particles
    this.snowPuffs = [];
    this.puffGraphics = this.add.graphics().setDepth(6);

    // Player sprite
    this.playerSprite = this.add.image(this.px, this.py, 'character');
    this.playerSprite.setScale(PLAYER_SCALE);
    this.playerSprite.setOrigin(0.5, 0.90);
    this.playerSprite.setDepth(10);

    // HUD
    this.scoreText = this.add.text(20, 20, 'Score: 0', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setScrollFactor(0).setDepth(100);

    // Input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Restart
    this.input.on('pointerdown', () => {
      if (!this.alive) this.scene.restart();
    });
    this.input.keyboard.on('keydown-R', () => {
      if (!this.alive) this.scene.restart();
    });
  }

  // ── Terrain math ──────────────────────────────────────────────

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

    // Clean snow fill
    ground.fillStyle(0xF0F4F8, 1);
    ground.beginPath();
    ground.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i++) ground.lineTo(points[i].x, points[i].y);
    ground.lineTo(last.x, FILL_BOTTOM);
    ground.lineTo(first.x, FILL_BOTTOM);
    ground.closePath();
    ground.fillPath();

    // Subtle depth shadow
    ground.fillStyle(0xDAE3ED, 0.35);
    ground.beginPath();
    ground.moveTo(first.x, first.y + 40);
    for (let i = 1; i < points.length; i++) ground.lineTo(points[i].x, points[i].y + 40);
    ground.lineTo(last.x, FILL_BOTTOM);
    ground.lineTo(first.x, FILL_BOTTOM);
    ground.closePath();
    ground.fillPath();

    // Deeper shadow
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

    for (let i = minChunk; i <= maxChunk; i++) {
      if (!this.chunks.has(i)) this.createChunk(i);
    }

    for (const [index] of this.chunks) {
      if (index < minChunk - 1 || index > maxChunk + 1) this.destroyChunk(index);
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

  // ── Parallax background ────────────────────────────────────────

  createParallaxLayers() {
    const h = this.gameHeight;
    const w = this.gameWidth;

    // Camera places terrain at ~55% from screen top (see update: py - h*0.55)
    // Position mountain base to align with terrain line so snow covers the overlap
    const terrainLine = 0.55;
    // In rocks_1 source (1080px), mountain base/dark area ends at ~80% of image
    const rocksBaseFrac = 0.80;
    const rocksShift = (rocksBaseFrac - terrainLine) * h;

    const layerConfigs = [
      { key: 'clouds_1', depth: -9,   speed: 0.02, alpha: 0.3,  tint: 0x8AB8D0, shiftY: 0 },
      { key: 'clouds_2', depth: -8.5, speed: 0.03, alpha: 0.25, tint: 0x9AC4D8, shiftY: 0 },
      { key: 'rocks_1',  depth: -8,   speed: 0.06, alpha: 0.45, tint: 0x7AAEC8, shiftY: rocksShift },
      { key: 'clouds_3', depth: -7.5, speed: 0.04, alpha: 0.2,  tint: 0xA0CCE0, shiftY: 0 },
      { key: 'clouds_4', depth: -7.2, speed: 0.05, alpha: 0.2,  tint: 0xA0CCE0, shiftY: 0 },
    ];

    this.parallaxLayers = [];
    const scale = h / 1080;

    for (const cfg of layerConfigs) {
      const tile = this.add.tileSprite(0, -cfg.shiftY, w, h + cfg.shiftY, cfg.key);
      tile.setOrigin(0, 0);
      tile.setScrollFactor(0);
      tile.setDepth(cfg.depth);
      tile.setAlpha(cfg.alpha);
      tile.setTint(cfg.tint);

      tile.tileScaleY = scale;
      tile.tileScaleX = scale;

      this.parallaxLayers.push({ tile, speed: cfg.speed });
    }
  }

  updateParallax() {
    const cam = this.cameras.main;
    for (const layer of this.parallaxLayers) {
      // Shift tile position based on camera scroll — creates parallax
      layer.tile.tilePositionX = cam.scrollX * layer.speed;
    }
  }

  // ── Player ──────────────────────────────────────────────────────

  updatePlayer() {
    const slope = this.getTerrainSlope(this.px);

    // Jump
    if (this.grounded && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.grounded = false;
      this.vy = JUMP_FORCE;
    }

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
      // Reduced gravity near the peak of a jump for hang time
      const hangFactor = Math.abs(this.vy) < 2 ? 0.4 : 1.0;
      this.vy += GRAVITY * hangFactor;
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

  updatePlayerSprite() {
    this.playerSprite.x = this.px;
    this.playerSprite.y = this.py;

    // Swap texture and scale based on state
    const wantedTexture = this.grounded ? 'character' : 'character-jump';
    const wantedScale = this.grounded ? PLAYER_SCALE : PLAYER_JUMP_SCALE;
    if (this.playerSprite.texture.key !== wantedTexture) {
      this.playerSprite.setTexture(wantedTexture);
      this.playerSprite.setScale(wantedScale);
    }

    // Tilt with terrain when grounded, stay level when airborne
    const slope = this.getTerrainSlope(this.px);
    let targetAngle;
    if (this.grounded) {
      targetAngle = Phaser.Math.RadToDeg(Math.atan(slope));
    } else {
      targetAngle = 0;
    }

    // Smooth rotation
    const currentAngle = this.playerSprite.angle;
    this.playerSprite.angle = currentAngle + (targetAngle - currentAngle) * 0.15;
  }

  // ── Trail & particles ─────────────────────────────────────────

  updateTrail() {
    if (this.grounded) {
      this.trailPoints.push({ x: this.px, y: this.py, alpha: 0.6 });
    }

    for (let i = this.trailPoints.length - 1; i >= 0; i--) {
      this.trailPoints[i].alpha -= TRAIL_FADE_SPEED;
      if (this.trailPoints[i].alpha <= 0) {
        this.trailPoints.splice(i, 1);
      }
    }

    while (this.trailPoints.length > TRAIL_LENGTH) {
      this.trailPoints.shift();
    }

    this.trailGraphics.clear();
    if (this.trailPoints.length < 2) return;

    for (let i = 1; i < this.trailPoints.length; i++) {
      const p = this.trailPoints[i];
      const prev = this.trailPoints[i - 1];
      const t = i / this.trailPoints.length;
      this.trailGraphics.lineStyle(t * 3, 0xB0D4E8, p.alpha * 0.7);
      this.trailGraphics.beginPath();
      this.trailGraphics.moveTo(prev.x, prev.y);
      this.trailGraphics.lineTo(p.x, p.y);
      this.trailGraphics.strokePath();
    }
  }

  spawnSnowPuffs() {
    if (!this.grounded) return;
    if (Math.random() < Math.abs(this.vx) * 0.15) {
      this.snowPuffs.push({
        x: this.px - 8 - Math.random() * 10,
        y: this.py - 2,
        vx: -0.3 - Math.random() * 0.8,
        vy: -0.5 - Math.random() * 1.5,
        size: 2 + Math.random() * 4,
        alpha: 0.6 + Math.random() * 0.3,
      });
    }
  }

  updateSnowPuffs() {
    this.puffGraphics.clear();
    for (let i = this.snowPuffs.length - 1; i >= 0; i--) {
      const p = this.snowPuffs[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.02;
      p.alpha -= 0.015;
      p.size *= 0.99;

      if (p.alpha <= 0) {
        this.snowPuffs.splice(i, 1);
        continue;
      }
      this.puffGraphics.fillStyle(0xFFFFFF, p.alpha);
      this.puffGraphics.fillCircle(p.x, p.y, p.size);
    }
  }

  // ── Snowfall ─────────────────────────────────────────────────────

  initSnowfall() {
    this.snowTime = 0;
    // Global wind that shifts over time — two overlapping waves
    this.windPhase1 = Math.random() * Math.PI * 2;
    this.windPhase2 = Math.random() * Math.PI * 2;

    const COUNT = 80;
    for (let i = 0; i < COUNT; i++) {
      this.snowflakes.push(this.createSnowflake(true));
    }
  }

  createSnowflake(randomY) {
    const layer = Math.random();
    return {
      x: Math.random() * (this.gameWidth + 100) - 50,
      y: randomY ? Math.random() * this.gameHeight : -(Math.random() * 60),
      size: 1 + layer * 2.5,                        // 1-3.5px
      alpha: 0.1 + layer * 0.15,                    // visible but soft: 0.10-0.25
      baseSpeedY: 0.12 + layer * 0.3,               // gentle fall
      driftSensitivity: 0.2 + Math.random() * 0.5,
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.002 + Math.random() * 0.006,
      wobbleAmp: 0.1 + Math.random() * 0.3,
      wobblePhase2: Math.random() * Math.PI * 2,
      wobbleSpeed2: 0.001 + Math.random() * 0.003,
      wobbleAmp2: 0.05 + Math.random() * 0.2,
      round: Math.random() > 0.5,
    };
  }

  updateSnowfall() {
    this.snowfallGraphics.clear();
    this.snowTime += 1;

    // Global wind: slow-shifting breeze
    const globalWind = Math.sin(this.snowTime * 0.0015 + this.windPhase1) * 0.1
                     + Math.sin(this.snowTime * 0.0005 + this.windPhase2) * 0.06;

    for (let i = 0; i < this.snowflakes.length; i++) {
      const s = this.snowflakes[i];

      s.wobblePhase += s.wobbleSpeed;
      s.wobblePhase2 += s.wobbleSpeed2;

      const drift = globalWind * s.driftSensitivity
                   + Math.sin(s.wobblePhase) * s.wobbleAmp
                   + Math.sin(s.wobblePhase2) * s.wobbleAmp2;

      s.x += drift;
      s.y += s.baseSpeedY;

      // Wrap around
      if (s.y > this.gameHeight + 10) {
        s.y = -(Math.random() * 50);
        s.x = Math.random() * (this.gameWidth + 100) - 50;
      }
      if (s.x > this.gameWidth + 30) s.x = -20;
      if (s.x < -30) s.x = this.gameWidth + 20;

      this.snowfallGraphics.fillStyle(0xFFFFFF, s.alpha);
      const rx = Math.round(s.x);
      const ry = Math.round(s.y);
      if (s.round) {
        this.snowfallGraphics.fillCircle(rx, ry, s.size * 0.5);
      } else {
        this.snowfallGraphics.fillRect(rx, ry, Math.round(s.size), Math.round(s.size));
      }
    }
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
    this.updateParallax();
    this.updatePlayerSprite();
    this.updateTrail();
    this.spawnSnowPuffs();
    this.updateSnowPuffs();
    this.updateSnowfall();

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
