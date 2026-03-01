import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  preload() {
    const bgPath = '/game_background_1/layers/';
    this.load.image('clouds_1', bgPath + 'clouds_1.png');
    this.load.image('clouds_2', bgPath + 'clouds_2.png');
    this.load.image('clouds_3', bgPath + 'clouds_3.png');
    this.load.image('clouds_4', bgPath + 'clouds_4.png');
    this.load.image('rocks_1', bgPath + 'rocks_1.png');
    this.load.image('character', '/character.png');
  }

  create() {
    this.gameWidth = this.scale.width;
    this.gameHeight = this.scale.height;

    this.createSkyBackground();
    this.createParallaxLayers();
    this.createDecorativeSlope();

    // Character sitting on the slope
    const slopeY = this.gameHeight * 0.78 + (0.5 * (this.gameHeight * 0.1)) + Math.sin(0.5 * Math.PI * 1.5) * 15;
    this.characterSprite = this.add.image(this.gameWidth * 0.5, slopeY - 5, 'character');
    this.characterSprite.setScale(0.22);
    this.characterSprite.setOrigin(0.5, 0.9);
    this.characterSprite.setDepth(10);
    this.characterSprite.setScrollFactor(0);

    // Snowfall
    this.snowfallGraphics = this.add.graphics().setScrollFactor(0).setDepth(-5);
    this.snowflakes = [];
    this.initSnowfall();

    this.titleLetters = [];
    this.driftOffset = 0;
    this.startBtn = null;
    this.subtitle = null;
    this.promptText = null;

    // Wait for Google Font to load before creating text
    document.fonts.load('72px "Jersey 20"').then(() => {
      this.createTitle();
      this.createStartButton();
    });
  }

  // ── Sky ─────────────────────────────────────────────────────────

  createSkyBackground() {
    const sky = this.add.graphics().setScrollFactor(0).setDepth(-10);
    const w = this.gameWidth;
    const h = this.gameHeight;

    const bands = [
      { y: 0, h: h * 0.25, top: 0x2B4970, bot: 0x3A6B8F },
      { y: h * 0.25, h: h * 0.25, top: 0x3A6B8F, bot: 0x5B9BBF },
      { y: h * 0.50, h: h * 0.25, top: 0x5B9BBF, bot: 0x89BDD6 },
      { y: h * 0.75, h: h * 0.25, top: 0x89BDD6, bot: 0xB8D8E8 },
    ];

    for (const band of bands) {
      sky.fillGradientStyle(band.top, band.top, band.bot, band.bot, 1);
      sky.fillRect(0, band.y, w, band.h);
    }
  }

  // ── Parallax ────────────────────────────────────────────────────

  createParallaxLayers() {
    const w = this.gameWidth;
    const h = this.gameHeight;

    const terrainLine = 0.78;
    const rocksBaseFrac = 0.80;
    const rocksShift = (rocksBaseFrac - terrainLine) * h;

    const layerConfigs = [
      { key: 'clouds_1', depth: -9, speed: 0.02, alpha: 0.3, tint: 0x8AB8D0, shiftY: 0 },
      { key: 'clouds_2', depth: -8.5, speed: 0.03, alpha: 0.25, tint: 0x9AC4D8, shiftY: 0 },
      { key: 'rocks_1', depth: -8, speed: 0.06, alpha: 0.45, tint: 0x7AAEC8, shiftY: rocksShift },
      { key: 'clouds_3', depth: -7.5, speed: 0.04, alpha: 0.2, tint: 0xA0CCE0, shiftY: 0 },
      { key: 'clouds_4', depth: -7.2, speed: 0.05, alpha: 0.2, tint: 0xA0CCE0, shiftY: 0 },
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

    // Cover the bottom of rocks_1 image (in front of rocks at -8, behind clouds at -7.5)
    const fill = this.add.graphics().setScrollFactor(0).setDepth(-7.9);
    fill.fillStyle(0x4A78A0, 1);
    fill.fillRect(0, h * 0.63, w, h * 0.4);
  }

  // ── Decorative slope ────────────────────────────────────────────

  createDecorativeSlope() {
    const w = this.gameWidth;
    const h = this.gameHeight;
    const gfx = this.add.graphics().setScrollFactor(0).setDepth(1);

    const startY = h * 0.78;
    const endY = h * 0.88;
    const steps = 80;

    const points = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = t * w;
      const baseY = startY + (endY - startY) * t;
      const wave = Math.sin(t * Math.PI * 1.5) * 15;
      points.push({ x, y: baseY + wave });
    }

    // Snow fill
    gfx.fillStyle(0xF0F4F8, 1);
    gfx.beginPath();
    gfx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) gfx.lineTo(points[i].x, points[i].y);
    gfx.lineTo(w, h);
    gfx.lineTo(0, h);
    gfx.closePath();
    gfx.fillPath();

    // Subtle depth shadow
    gfx.fillStyle(0xDAE3ED, 0.35);
    gfx.beginPath();
    gfx.moveTo(points[0].x, points[0].y + 40);
    for (let i = 1; i < points.length; i++) gfx.lineTo(points[i].x, points[i].y + 40);
    gfx.lineTo(w, h);
    gfx.lineTo(0, h);
    gfx.closePath();
    gfx.fillPath();

    // Deeper shadow
    gfx.fillStyle(0xC4D0DE, 0.25);
    gfx.beginPath();
    gfx.moveTo(points[0].x, points[0].y + 120);
    for (let i = 1; i < points.length; i++) gfx.lineTo(points[i].x, points[i].y + 120);
    gfx.lineTo(w, h);
    gfx.lineTo(0, h);
    gfx.closePath();
    gfx.fillPath();

    // Surface texture marks
    for (let i = 0; i < points.length - 1; i += 3) {
      const p = points[i];
      const hash = Math.sin(i * 131) * 43758.5453;
      const r = hash - Math.floor(hash);
      if (r > 0.5) continue;
      const len = 12 + r * 30;
      const yOff = 3 + r * 8;
      gfx.lineStyle(1.5, 0xB0C4D4, 0.25 + r * 0.15);
      gfx.beginPath();
      gfx.moveTo(p.x, p.y + yOff);
      gfx.lineTo(p.x + len, p.y + yOff);
      gfx.strokePath();
    }
  }

  // ── Title ───────────────────────────────────────────────────────

  createTitle() {
    const title = 'FROST GLIDER';
    const fontSize = Math.min(90, this.gameWidth * 0.08);

    const baseY = this.gameHeight * 0.22;
    const style = {
      fontFamily: '"Jersey 20", sans-serif',
      fontSize: `${fontSize}px`,
      color: '#FFFFFF',
      stroke: '#1A3550',
      strokeThickness: 6,
    };

    // Measure individual letter widths first
    const letterWidths = [];
    let totalWidth = 0;
    for (let i = 0; i < title.length; i++) {
      const temp = this.add.text(0, -200, title[i], style);
      letterWidths.push(temp.width);
      totalWidth += temp.width;
      temp.destroy();
    }

    this.titleLetters = [];
    let cursorX = (this.gameWidth - totalWidth) / 2;

    for (let i = 0; i < title.length; i++) {
      const ch = title[i];
      const letter = this.add.text(cursorX, baseY, ch, style);
      letter.setDepth(100);
      letter.setScrollFactor(0);
      letter.setAlpha(0);

      cursorX += letterWidths[i];

      this.titleLetters.push({
        textObj: letter,
        baseY,
        phaseOffset: i * 0.35,
      });

      // Staggered fade-in
      this.tweens.add({
        targets: letter,
        alpha: 1,
        y: baseY,
        duration: 400,
        delay: i * 60,
        ease: 'Back.easeOut',
      });
    }

    // Subtitle
    this.subtitle = this.add.text((this.gameWidth / 2), baseY + fontSize + 10, 'survive the chaos', {
      fontFamily: '"Jersey 20", sans-serif',
      fontSize: `${Math.floor(fontSize * 0.3)}px`,
      color: '#B8D8E8',
      letterSpacing: 6,
    });
    this.subtitle.setOrigin(0.5, 0);
    this.subtitle.setDepth(100);
    this.subtitle.setScrollFactor(0);
    this.subtitle.setAlpha(0);

    this.tweens.add({
      targets: this.subtitle,
      alpha: 0.7,
      duration: 800,
      delay: title.length * 60 + 200,
      ease: 'Sine.easeIn',
    });
  }

  // ── Start button ────────────────────────────────────────────────

  createStartButton() {
    const btnY = this.gameHeight * 0.52;
    const btnW = 180;
    const btnH = 52;

    // Button background
    this.btnBg = this.add.graphics().setScrollFactor(0).setDepth(99);
    this.btnBg.fillStyle(0x1A3550, 0.6);
    this.btnBg.fillRect(this.gameWidth / 2 - btnW / 2, btnY - btnH / 2, btnW, btnH);
    this.btnBg.setAlpha(0);

    // Button text
    this.startBtn = this.add.text(this.gameWidth / 2, btnY, 'PLAY', {
      fontFamily: '"Jersey 20", sans-serif',
      fontSize: '40px',
      color: '#FFFFFF',
      padding: { x: 30, y: 8 },
    });
    this.startBtn.setOrigin(0.5);
    this.startBtn.setDepth(100);
    this.startBtn.setScrollFactor(0);
    this.startBtn.setAlpha(0);
    this.startBtn.setInteractive({ useHandCursor: true });

    // Fade in after title
    this.tweens.add({
      targets: [this.startBtn, this.btnBg],
      alpha: 1,
      duration: 600,
      delay: 1000,
      ease: 'Sine.easeIn',
    });

    this.startBtn.on('pointerover', () => {
      this.btnBg.clear();
      this.btnBg.fillStyle(0x1A3550, 0.8);
      this.btnBg.fillRect(this.gameWidth / 2 - btnW / 2, btnY - btnH / 2, btnW, btnH);
    });
    this.startBtn.on('pointerout', () => {
      this.btnBg.clear();
      this.btnBg.fillStyle(0x1A3550, 0.6);
      this.btnBg.fillRect(this.gameWidth / 2 - btnW / 2, btnY - btnH / 2, btnW, btnH);
    });
    this.startBtn.on('pointerdown', () => {
      this.scene.start('GameScene');
    });

    // "Press SPACE to play" prompt
    this.promptText = this.add.text(this.gameWidth / 2, btnY + 50, 'press SPACE to play', {
      fontFamily: '"Jersey 20", sans-serif',
      fontSize: '18px',
      color: '#B8D8E8',
    });
    this.promptText.setOrigin(0.5);
    this.promptText.setDepth(100);
    this.promptText.setScrollFactor(0);
    this.promptText.setAlpha(0);

    this.tweens.add({
      targets: this.promptText,
      alpha: 0.5,
      duration: 600,
      delay: 1200,
      ease: 'Sine.easeIn',
    });

    // Space key also starts the game
    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).on('down', () => {
      this.scene.start('GameScene');
    });
  }

  // ── Snowfall ────────────────────────────────────────────────────

  initSnowfall() {
    this.snowTime = 0;
    this.windPhase1 = Math.random() * Math.PI * 2;
    this.windPhase2 = Math.random() * Math.PI * 2;

    for (let i = 0; i < 80; i++) {
      this.snowflakes.push(this.createSnowflake(true));
    }
  }

  createSnowflake(randomY) {
    const layer = Math.random();
    return {
      x: Math.random() * (this.gameWidth + 100) - 50,
      y: randomY ? Math.random() * this.gameHeight : -(Math.random() * 60),
      size: 1 + layer * 2.5,
      alpha: 0.1 + layer * 0.15,
      baseSpeedY: 0.12 + layer * 0.3,
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

  update(time) {
    // Auto-drift parallax
    this.driftOffset += 0.5;
    for (const layer of this.parallaxLayers) {
      layer.tile.tilePositionX = this.driftOffset * layer.speed;
    }

    // Snowfall
    this.updateSnowfall();

    // Title wave animation
    for (const letter of this.titleLetters) {
      letter.textObj.y = letter.baseY + Math.sin(time * 0.003 + letter.phaseOffset) * 8;
    }

    // Pulsing prompt text
    if (this.promptText && this.promptText.alpha > 0) {
      this.promptText.setAlpha(0.3 + Math.sin(time * 0.004) * 0.2);
    }
  }
}
