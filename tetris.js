(() => {
  const panel = document.getElementById("tetris-panel");
  const toggle = document.getElementById("tetris-toggle");
  const closeBtn = document.getElementById("tetris-close");
  const canvas = document.getElementById("tetris-canvas");
  const hint = document.getElementById("tetris-hint");
  if (!panel || !toggle || !canvas) return;

  const ctx = canvas.getContext("2d");
  const COLS = 10;
  const ROWS = 20;
  const CELL = 20;
  const W = COLS * CELL;
  const H = ROWS * CELL;

  const COLORS = {
    I: "#3dd6c3",
    O: "#f0a35e",
    T: "#7eb6ff",
    S: "#6fd39a",
    Z: "#ff7a7a",
    J: "#8aa8ff",
    L: "#e8c56b",
  };

  const SHAPES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
  };

  const BAG = Object.keys(SHAPES);

  let open = false;
  let raf = 0;
  let lastTs = 0;
  let dropAcc = 0;
  let board = createBoard();
  let piece = null;
  let nextType = randomType();
  let score = 0;
  let lines = 0;
  let level = 1;
  let over = false;
  let started = false;
  let paused = false;

  const keys = Object.create(null);
  let dasDir = 0;
  let dasTimer = 0;
  let softDrop = false;

  function createBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function randomType() {
    return BAG[(Math.random() * BAG.length) | 0];
  }

  function rotateMatrix(matrix) {
    const n = matrix.length;
    const out = Array.from({ length: n }, () => Array(n).fill(0));
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        out[x][n - 1 - y] = matrix[y][x];
      }
    }
    return out;
  }

  function spawnPiece() {
    const type = nextType;
    nextType = randomType();
    const matrix = SHAPES[type].map((row) => row.slice());
    const x = ((COLS - matrix[0].length) / 2) | 0;
    const y = type === "I" ? -1 : 0;
    piece = { type, matrix, x, y };
    if (collides(piece, 0, 0)) {
      over = true;
      started = true;
    }
  }

  function collides(p, dx, dy, matrix = p.matrix) {
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        if (!matrix[y][x]) continue;
        const nx = p.x + x + dx;
        const ny = p.y + y + dy;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  function mergePiece() {
    for (let y = 0; y < piece.matrix.length; y++) {
      for (let x = 0; x < piece.matrix[y].length; x++) {
        if (!piece.matrix[y][x]) continue;
        const by = piece.y + y;
        const bx = piece.x + x;
        if (by >= 0 && by < ROWS && bx >= 0 && bx < COLS) {
          board[by][bx] = piece.type;
        }
      }
    }
  }

  function clearLines() {
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (board[y].every((cell) => cell)) {
        board.splice(y, 1);
        board.unshift(Array(COLS).fill(null));
        cleared++;
        y++;
      }
    }
    if (!cleared) return;
    lines += cleared;
    const points = [0, 100, 300, 500, 800][cleared] || 800;
    score += points * level;
    level = 1 + ((lines / 10) | 0);
  }

  function hardDrop() {
    if (!piece || over || paused) return;
    let dist = 0;
    while (!collides(piece, 0, 1)) {
      piece.y++;
      dist++;
    }
    score += dist * 2;
    lockPiece();
  }

  function lockPiece() {
    mergePiece();
    clearLines();
    spawnPiece();
    dropAcc = 0;
  }

  function tryMove(dx, dy) {
    if (!piece || over || paused) return false;
    if (collides(piece, dx, dy)) return false;
    piece.x += dx;
    piece.y += dy;
    if (dy > 0) score += 1;
    return true;
  }

  function tryRotate() {
    if (!piece || over || paused || piece.type === "O") return;
    const rotated = rotateMatrix(piece.matrix);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!collides(piece, kick, 0, rotated)) {
        piece.matrix = rotated;
        piece.x += kick;
        return;
      }
    }
  }

  function resetGame() {
    board = createBoard();
    score = 0;
    lines = 0;
    level = 1;
    over = false;
    started = true;
    paused = false;
    nextType = randomType();
    spawnPiece();
    dropAcc = 0;
    dasDir = 0;
    dasTimer = 0;
    softDrop = false;
  }

  function dropInterval() {
    return Math.max(80, 800 - (level - 1) * 70);
  }

  function ghostY() {
    if (!piece) return 0;
    let gy = 0;
    while (!collides(piece, 0, gy + 1)) gy++;
    return piece.y + gy;
  }

  function drawCell(x, y, color, alpha = 1) {
    const px = x * CELL;
    const py = y * CELL;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(px + 1, py + 1, CELL - 2, 3);
    ctx.globalAlpha = 1;
  }

  function drawBoard() {
    ctx.fillStyle = "#071410";
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(61,214,195,0.06)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL + 0.5, 0);
      ctx.lineTo(x * CELL + 0.5, H);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL + 0.5);
      ctx.lineTo(W, y * CELL + 0.5);
      ctx.stroke();
    }

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const t = board[y][x];
        if (t) drawCell(x, y, COLORS[t]);
      }
    }

    if (piece && !over) {
      const gy = ghostY();
      for (let y = 0; y < piece.matrix.length; y++) {
        for (let x = 0; x < piece.matrix[y].length; x++) {
          if (!piece.matrix[y][x]) continue;
          const px = piece.x + x;
          const py = gy + y;
          if (py >= 0) drawCell(px, py, COLORS[piece.type], 0.22);
        }
      }

      for (let y = 0; y < piece.matrix.length; y++) {
        for (let x = 0; x < piece.matrix[y].length; x++) {
          if (!piece.matrix[y][x]) continue;
          const px = piece.x + x;
          const py = piece.y + y;
          if (py >= 0) drawCell(px, py, COLORS[piece.type]);
        }
      }
    }

    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, W, 22);
    ctx.fillStyle = "#d7e8dc";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`分 ${score}`, 6, 14);
    ctx.textAlign = "right";
    ctx.fillText(`Lv${level} · ${lines}行`, W - 6, 14);

    if (!started) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#3dd6c3";
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "center";
      ctx.fillText("TETRIS", W / 2, H / 2 - 8);
      ctx.fillStyle = "#d7e8dc";
      ctx.font = "10px monospace";
      ctx.fillText("按任意方向键开始", W / 2, H / 2 + 12);
    }

    if (paused && !over) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#f0a35e";
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "center";
      ctx.fillText("暂停", W / 2, H / 2);
    }

    if (over) {
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

  function handleDas(dtMs) {
    const left = keys.ArrowLeft || keys.a || keys.A;
    const right = keys.ArrowRight || keys.d || keys.D;
    let dir = 0;
    if (left && !right) dir = -1;
    else if (right && !left) dir = 1;

    if (dir === 0) {
      dasDir = 0;
      dasTimer = 0;
      return;
    }

    if (dir !== dasDir) {
      dasDir = dir;
      dasTimer = 0;
      tryMove(dir, 0);
      return;
    }

    dasTimer += dtMs;
    if (dasTimer >= 160) {
      const steps = 1 + (((dasTimer - 160) / 45) | 0);
      dasTimer = 160 + ((dasTimer - 160) % 45);
      for (let i = 0; i < steps; i++) tryMove(dir, 0);
    }
  }

  function update(dtMs) {
    if (!started || over || paused || !piece) return;

    softDrop = !!(keys.ArrowDown || keys.s || keys.S);
    handleDas(dtMs);

    const interval = softDrop ? Math.min(50, dropInterval() / 8) : dropInterval();
    dropAcc += dtMs;
    while (dropAcc >= interval) {
      dropAcc -= interval;
      if (!tryMove(0, 1)) {
        lockPiece();
        break;
      }
    }
  }

  function loop(ts) {
    if (!open) return;
    if (!lastTs) lastTs = ts;
    const dt = Math.min(50, ts - lastTs);
    lastTs = ts;

    if (!started) {
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
        keys[" "]
      ) {
        resetGame();
      }
    } else {
      update(dt);
    }

    drawBoard();
    raf = requestAnimationFrame(loop);
  }

  function closeContraIfOpen() {
    if (window.__contraIsOpen?.()) window.__contraClose?.();
  }

  function openPanel() {
    closeContraIfOpen();
    open = true;
    panel.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
    if (!started || over) {
      board = createBoard();
      piece = null;
      score = 0;
      lines = 0;
      level = 1;
      over = false;
      started = false;
      paused = false;
      nextType = randomType();
    }
    lastTs = 0;
    dropAcc = 0;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
    canvas.focus({ preventScroll: true });
    drawBoard();
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

  window.__tetrisClose = closePanel;
  window.__tetrisIsOpen = () => open;

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
      k === "x" ||
      k === "X" ||
      k === "z" ||
      k === "Z" ||
      k === "p" ||
      k === "P" ||
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

    if ((event.key === "Enter" || event.key === "r" || event.key === "R") && over) {
      resetGame();
      keys[event.key] = true;
      return;
    }

    if ((event.key === "p" || event.key === "P") && started && !over) {
      paused = !paused;
      return;
    }

    if (event.repeat) {
      if (event.key === "ArrowUp" || event.key === "w" || event.key === "W" || event.key === "x" || event.key === "X" || event.key === " ") {
        return;
      }
    }

    keys[event.key] = true;

    if (event.key === "ArrowUp" || event.key === "w" || event.key === "W" || event.key === "x" || event.key === "X") {
      tryRotate();
    }
    if (event.key === " ") {
      hardDrop();
    }
  });

  window.addEventListener("keyup", (event) => {
    if (!open) return;
    keys[event.key] = false;
  });

  drawBoard();
  if (hint) {
    hint.textContent = "←→移动  ↑旋转  ↓加速  空格落定";
  }
})();
