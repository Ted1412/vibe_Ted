(() => {
  const panel = document.getElementById("plane-panel");
  const toggle = document.getElementById("plane-toggle");
  const closeBtn = document.getElementById("plane-close");
  const canvas = document.getElementById("plane-canvas");
  const hint = document.getElementById("plane-hint");
  if (!panel || !toggle || !canvas) return;

  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  let open = false;
  let raf = 0;
  let lastTs = 0;

  const keys = Object.create(null);
  const state = {
    score: 0,
    lives: 3,
    wave: 1,
    over: false,
    started: false,
  };

  const player = {
    x: W / 2,
    y: H - 48,
    w: 18,
    h: 22,
    speed: 2.6,
    shootCd: 0,
    invuln: 0,
  };

  /** @type {{x:number,y:number,vy:number,from:string,w:number,h:number}[]} */
  let bullets = [];
  /** @type {{x:number,y:number,w:number,h:number,vx:number,vy:number,hp:number,type:string,shootCd:number}[]} */
  let enemies = [];
  /** @type {{x:number,y:number,vx:number,vy:number,life:number,color:string}[]} */
  let particles = [];
  /** @type {{x:number,y:number,s:number,sp:number}[]} */
  let stars = [];

  let spawnTimer = 0;
  let flash = 0;

  function initStars() {
    stars = Array.from({ length: 36 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      s: 0.6 + Math.random() * 1.6,
      sp: 0.4 + Math.random() * 1.4,
    }));
  }

  function resetGame() {
    state.score = 0;
    state.lives = 3;
    state.wave = 1;
    state.over = false;
    state.started = true;
    Object.assign(player, {
      x: W / 2,
      y: H - 48,
      shootCd: 0,
      invuln: 90,
    });
    bullets = [];
    enemies = [];
    particles = [];
    spawnTimer = 30;
    flash = 0;
    if (!stars.length) initStars();
  }

  function burst(x, y, color, n = 10) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.6 + Math.random() * 2.2;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 18 + Math.random() * 16,
        color,
      });
    }
  }

  function spawnEnemy() {
    const roll = Math.random();
    const type = roll > 0.82 ? "heavy" : roll > 0.55 ? "zig" : "scout";
    const w = type === "heavy" ? 22 : type === "zig" ? 16 : 14;
    const h = type === "heavy" ? 18 : 14;
    enemies.push({
      x: 16 + Math.random() * (W - 32),
      y: -h - 4,
      w,
      h,
      vx: type === "zig" ? (Math.random() > 0.5 ? 1.1 : -1.1) : (Math.random() - 0.5) * 0.6,
      vy: type === "heavy" ? 0.55 + state.wave * 0.04 : 0.9 + state.wave * 0.06 + Math.random() * 0.35,
      hp: type === "heavy" ? 3 : 1,
      type,
      shootCd: type === "heavy" ? 40 + Math.random() * 40 : 9999,
    });
  }

  function shootPlayer() {
    if (player.shootCd > 0) return;
    bullets.push({
      x: player.x,
      y: player.y - player.h / 2,
      vy: -6.2,
      from: "player",
      w: 3,
      h: 8,
    });
    player.shootCd = 11;
  }

  function rectHit(a, b) {
    return (
      a.x - a.w / 2 < b.x + b.w / 2 &&
      a.x + a.w / 2 > b.x - b.w / 2 &&
      a.y - a.h / 2 < b.y + b.h / 2 &&
      a.y + a.h / 2 > b.y - b.h / 2
    );
  }

  function hurtPlayer() {
    if (player.invuln > 0 || state.over) return;
    state.lives -= 1;
    flash = 12;
    player.invuln = 90;
    burst(player.x, player.y, "#3dd6c3", 14);
    if (state.lives <= 0) {
      state.over = true;
      burst(player.x, player.y, "#ff6b6b", 22);
    }
  }

  function update(dt) {
    for (const s of stars) {
      s.y += s.sp * dt;
      if (s.y > H) {
        s.y = -2;
        s.x = Math.random() * W;
      }
    }

    if (player.shootCd > 0) player.shootCd -= dt;
    if (player.invuln > 0) player.invuln -= dt;
    if (flash > 0) flash -= dt;

    let mx = 0;
    let my = 0;
    if (keys.ArrowLeft || keys.a || keys.A) mx -= 1;
    if (keys.ArrowRight || keys.d || keys.D) mx += 1;
    if (keys.ArrowUp || keys.w || keys.W) my -= 1;
    if (keys.ArrowDown || keys.s || keys.S) my += 1;
    if (mx || my) {
      const len = Math.hypot(mx, my) || 1;
      player.x += (mx / len) * player.speed * dt;
      player.y += (my / len) * player.speed * dt;
    }
    player.x = Math.max(player.w / 2 + 2, Math.min(W - player.w / 2 - 2, player.x));
    player.y = Math.max(player.h / 2 + 18, Math.min(H - player.h / 2 - 4, player.y));

    if (keys[" "] || keys.j || keys.J) shootPlayer();

    spawnTimer -= dt;
    const spawnEvery = Math.max(18, 48 - state.wave * 2.2);
    if (spawnTimer <= 0) {
      spawnEnemy();
      if (Math.random() > 0.65) spawnEnemy();
      spawnTimer = spawnEvery;
    }

    state.wave = 1 + ((state.score / 400) | 0);

    for (const e of enemies) {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.type === "zig") {
        if (e.x < e.w / 2 + 4 || e.x > W - e.w / 2 - 4) e.vx *= -1;
      }
      e.shootCd -= dt;
      if (e.type === "heavy" && e.shootCd <= 0 && e.y > 20 && e.y < H * 0.7) {
        bullets.push({
          x: e.x,
          y: e.y + e.h / 2,
          vy: 2.8 + Math.min(state.wave, 8) * 0.12,
          from: "enemy",
          w: 3,
          h: 7,
        });
        e.shootCd = 55 + Math.random() * 35;
      }
    }
    enemies = enemies.filter((e) => e.y < H + 30 && e.hp > 0);

    for (const b of bullets) {
      b.y += b.vy * dt;
    }
    bullets = bullets.filter((b) => b.y > -20 && b.y < H + 20);

    for (const b of bullets) {
      if (b.from !== "player") continue;
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        if (!rectHit(b, e)) continue;
        b.y = -999;
        e.hp -= 1;
        burst(e.x, e.y, e.type === "heavy" ? "#f0a35e" : "#ff7a7a", 6);
        if (e.hp <= 0) {
          const pts = e.type === "heavy" ? 80 : e.type === "zig" ? 40 : 20;
          state.score += pts;
          burst(e.x, e.y, "#ffe566", 12);
        }
      }
    }
    bullets = bullets.filter((b) => b.y > -20);

    if (player.invuln <= 0) {
      for (const b of bullets) {
        if (b.from !== "enemy") continue;
        if (rectHit(b, { x: player.x, y: player.y, w: player.w * 0.7, h: player.h * 0.7 })) {
          b.y = H + 99;
          hurtPlayer();
        }
      }
      for (const e of enemies) {
        if (rectHit(e, { x: player.x, y: player.y, w: player.w * 0.75, h: player.h * 0.75 })) {
          e.hp = 0;
          burst(e.x, e.y, "#ff7a7a", 10);
          hurtPlayer();
        }
      }
    }

    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);
  }

  function drawPlane(x, y, color, enemy = false) {
    ctx.save();
    ctx.translate(x, y);
    if (enemy) ctx.scale(1, -1);

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(7, 8);
    ctx.lineTo(0, 5);
    ctx.lineTo(-7, 8);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(-1.5, -6, 3, 8);

    ctx.fillStyle = color;
    ctx.fillRect(-11, 0, 8, 3);
    ctx.fillRect(3, 0, 8, 3);
    ctx.fillRect(-3, 7, 6, 3);

    ctx.restore();
  }

  function drawHeavy(x, y) {
    ctx.fillStyle = "#c44b2f";
    ctx.beginPath();
    ctx.moveTo(x, y - 9);
    ctx.lineTo(x + 10, y + 6);
    ctx.lineTo(x + 4, y + 8);
    ctx.lineTo(x - 4, y + 8);
    ctx.lineTo(x - 10, y + 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f0a35e";
    ctx.fillRect(x - 2, y - 2, 4, 6);
    ctx.fillRect(x - 12, y, 7, 3);
    ctx.fillRect(x + 5, y, 7, 3);
  }

  function drawHud() {
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(0, 0, W, 20);
    ctx.fillStyle = "#d7e8dc";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`分 ${state.score}`, 6, 13);
    ctx.textAlign = "right";
    ctx.fillText(`♥ ${Math.max(0, state.lives)}  W${state.wave}`, W - 6, 13);
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#07141f");
    g.addColorStop(1, "#0a1810");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    for (const s of stars) {
      ctx.fillStyle = `rgba(232,242,239,${0.25 + s.s * 0.2})`;
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }

    if (flash > 0) {
      ctx.fillStyle = "rgba(255,80,60,0.16)";
      ctx.fillRect(0, 0, W, H);
    }

    for (const b of bullets) {
      ctx.fillStyle = b.from === "player" ? "#ffe566" : "#ff7a7a";
      ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
    }

    for (const e of enemies) {
      if (e.type === "heavy") drawHeavy(e.x, e.y);
      else drawPlane(e.x, e.y, e.type === "zig" ? "#ff8f6b" : "#d9693d", true);
    }

    if (!state.over) {
      const blink = player.invuln > 0 && ((player.invuln / 4) | 0) % 2 === 0;
      if (!blink) drawPlane(player.x, player.y, "#3dd6c3");
    }

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / 30);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      ctx.globalAlpha = 1;
    }

    drawHud();

    if (!state.started) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#3dd6c3";
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "center";
      ctx.fillText("飞机大战", W / 2, H / 2 - 8);
      ctx.fillStyle = "#d7e8dc";
      ctx.font = "10px monospace";
      ctx.fillText("按方向键或空格开始", W / 2, H / 2 + 12);
    }

    if (state.over) {
      ctx.fillStyle = "rgba(0,0,0,0.62)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ff6b6b";
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "center";
      ctx.fillText("GAME OVER", W / 2, H / 2 - 8);
      ctx.fillStyle = "#d7e8dc";
      ctx.font = "10px monospace";
      ctx.fillText("Enter / R 重开", W / 2, H / 2 + 12);
    }
  }

  function loop(ts) {
    if (!open) return;
    if (!lastTs) lastTs = ts;
    let dt = (ts - lastTs) / 16.67;
    lastTs = ts;
    if (dt > 2.5) dt = 2.5;

    if (!state.started) {
      if (
        keys.ArrowLeft ||
        keys.ArrowRight ||
        keys.ArrowUp ||
        keys.ArrowDown ||
        keys.a ||
        keys.A ||
        keys.d ||
        keys.D ||
        keys.w ||
        keys.W ||
        keys.s ||
        keys.S ||
        keys[" "] ||
        keys.j ||
        keys.J
      ) {
        resetGame();
      }
    } else if (!state.over) {
      update(dt);
    } else {
      for (const p of particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
      }
      particles = particles.filter((p) => p.life > 0);
      for (const s of stars) {
        s.y += s.sp * dt * 0.5;
        if (s.y > H) {
          s.y = -2;
          s.x = Math.random() * W;
        }
      }
    }

    draw();
    raf = requestAnimationFrame(loop);
  }

  function closeOthers() {
    if (window.__contraIsOpen?.()) window.__contraClose?.();
    if (window.__tetrisIsOpen?.()) window.__tetrisClose?.();
  }

  function openPanel() {
    closeOthers();
    open = true;
    panel.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
    if (!state.started || state.over) {
      state.started = false;
      state.over = false;
      bullets = [];
      enemies = [];
      particles = [];
      initStars();
    }
    lastTs = 0;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
    canvas.focus({ preventScroll: true });
    draw();
  }

  function closePanel() {
    open = false;
    panel.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    cancelAnimationFrame(raf);
    Object.keys(keys).forEach((k) => {
      keys[k] = false;
    });
  }

  window.__planeClose = closePanel;
  window.__planeIsOpen = () => open;

  toggle.addEventListener("click", () => {
    if (open) closePanel();
    else openPanel();
  });

  closeBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    closePanel();
  });

  function isGameKey(event) {
    const k = event.key;
    return (
      k === "ArrowLeft" ||
      k === "ArrowRight" ||
      k === "ArrowUp" ||
      k === "ArrowDown" ||
      k === " " ||
      k === "a" ||
      k === "A" ||
      k === "d" ||
      k === "D" ||
      k === "w" ||
      k === "W" ||
      k === "s" ||
      k === "S" ||
      k === "j" ||
      k === "J" ||
      k === "Enter" ||
      k === "r" ||
      k === "R" ||
      k === "Escape"
    );
  }

  window.addEventListener("keydown", (event) => {
    if (!open) return;
    if (!isGameKey(event)) return;
    event.preventDefault();

    if (event.key === "Escape") {
      closePanel();
      return;
    }

    if ((event.key === "Enter" || event.key === "r" || event.key === "R") && state.over) {
      resetGame();
    }

    keys[event.key] = true;
  });

  window.addEventListener("keyup", (event) => {
    if (!open) return;
    keys[event.key] = false;
  });

  initStars();
  draw();
  if (hint) {
    hint.textContent = "←→↑↓移动  空格 / J 射击";
  }
})();
