// SVG Logo 模式（替代 TTF 模式渲染三段路径）
// 用法：需要 sketch_boost.js 在 preload/setup 里调用 loadLogoSvg()，并在 setRenderMode 时切换 coreBase。

var renderMode = 0; // 0 = TTF, 1 = SVG Logo
var logoKerning = 0; // 相邻字符额外 x 间距（渲染后像素单位）
var logoFillColors = ["#FD0000", "#0061DF", "#F5BC37"]; // 三个 logo 各自填充色（默认取 SVG 原色）
var logoC1FrontOffset = 20; // C1 额外朝向观众的 Z 偏移（避免与两侧穿插）

var logoPathDs = [];
var logoPathParsed = []; // 每个字符：{ commands, bbox: {minX,maxX,minY,maxY,centerX,centerY,width,height} }

var SvgTumbleLet;
var SvgTumbleBase;

function parseSvgPathD(d) {
  // 输出类似 opentype Path 的 commands：M/L/Q/C/Z
  // 仅支持绝对命令（大写），会尽量对相对命令做转换。
  const tokens = d.match(/[AaCcHhLlMmQqSsTtVvZz]|[-+]?(?:\d*\.?\d+)(?:[eE][-+]?\d+)?/g) || [];
  let i = 0;

  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;

  const commands = [];

  function nextNumber() {
    const v = parseFloat(tokens[i++]);
    return v;
  }

  while (i < tokens.length) {
    const cmd = tokens[i++];
    const cmdUpper = cmd.toUpperCase();
    const isRel = cmd !== cmdUpper;

    if (cmdUpper === "M") {
      const x1 = nextNumber();
      const y1 = nextNumber();
      const x = isRel ? cx + x1 : x1;
      const y = isRel ? cy + y1 : y1;
      cx = x;
      cy = y;
      sx = x;
      sy = y;
      commands.push({ type: "M", x: cx, y: cy });

      // SVG 规范允许 M 后面跟多个坐标对：后续坐标对等价于 L
      while (i < tokens.length && !/^[AaCcHhLlMmQqSsTtVvZz]$/.test(tokens[i])) {
        const xL = nextNumber();
        const yL = nextNumber();
        const x2 = isRel ? cx + xL : xL;
        const y2 = isRel ? cy + yL : yL;
        cx = x2;
        cy = y2;
        commands.push({ type: "L", x: cx, y: cy });
      }
    } else if (cmdUpper === "L") {
      while (i < tokens.length && !/^[AaCcHhLlMmQqSsTtVvZz]$/.test(tokens[i])) {
        const x1 = nextNumber();
        const y1 = nextNumber();
        const x = isRel ? cx + x1 : x1;
        const y = isRel ? cy + y1 : y1;
        cx = x;
        cy = y;
        commands.push({ type: "L", x: cx, y: cy });
      }
    } else if (cmdUpper === "Q") {
      while (i < tokens.length && !/^[AaCcHhLlMmQqSsTtVvZz]$/.test(tokens[i])) {
        const x1 = nextNumber();
        const y1 = nextNumber();
        const x2 = nextNumber();
        const y2 = nextNumber();
        const xCtl = isRel ? cx + x1 : x1;
        const yCtl = isRel ? cy + y1 : y1;
        const x = isRel ? cx + x2 : x2;
        const y = isRel ? cy + y2 : y2;
        cx = x;
        cy = y;
        commands.push({ type: "Q", x1: xCtl, y1: yCtl, x: cx, y: cy });
      }
    } else if (cmdUpper === "C") {
      while (i < tokens.length && !/^[AaCcHhLlMmQqSsTtVvZz]$/.test(tokens[i])) {
        const x1 = nextNumber();
        const y1 = nextNumber();
        const x2 = nextNumber();
        const y2 = nextNumber();
        const x3 = nextNumber();
        const y3 = nextNumber();
        const xCtl1 = isRel ? cx + x1 : x1;
        const yCtl1 = isRel ? cy + y1 : y1;
        const xCtl2 = isRel ? cx + x2 : x2;
        const yCtl2 = isRel ? cy + y2 : y2;
        const x = isRel ? cx + x3 : x3;
        const y = isRel ? cy + y3 : y3;
        cx = x;
        cy = y;
        commands.push({
          type: "C",
          x1: xCtl1,
          y1: yCtl1,
          x2: xCtl2,
          y2: yCtl2,
          x: cx,
          y: cy,
        });
      }
    } else if (cmdUpper === "Z") {
      // 关闭路径：回到起点
      cx = sx;
      cy = sy;
      commands.push({ type: "Z" });
    } else {
      // 其它命令暂不支持（本 logo 文件只包含 M/C/Z）
      // 若你未来 SVG 里出现 A/H/V 等，告知我我再补。
      throw new Error("Unsupported SVG path command: " + cmdUpper);
    }
  }

  return commands;
}

function computeCommandsBBox(commands) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const c of commands) {
    if (c.type === "M" || c.type === "L") {
      minX = Math.min(minX, c.x);
      minY = Math.min(minY, c.y);
      maxX = Math.max(maxX, c.x);
      maxY = Math.max(maxY, c.y);
    } else if (c.type === "Q") {
      minX = Math.min(minX, c.x1, c.x);
      minY = Math.min(minY, c.y1, c.y);
      maxX = Math.max(maxX, c.x1, c.x);
      maxY = Math.max(maxY, c.y1, c.y);
    } else if (c.type === "C") {
      minX = Math.min(minX, c.x1, c.x2, c.x);
      minY = Math.min(minY, c.y1, c.y2, c.y);
      maxX = Math.max(maxX, c.x1, c.x2, c.x);
      maxY = Math.max(maxY, c.y1, c.y2, c.y);
    }
  }

  const width = maxX - minX;
  const height = maxY - minY;
  return {
    minX,
    maxX,
    minY,
    maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    width,
    height,
  };
}

function loadLogoSvg(svgText) {
  // 用 DOMParser 稳定解析出 <path d="...">（比正则更稳）
  logoPathDs = [];
  try {
    if (typeof DOMParser === "function") {
      const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
      const paths = Array.from(doc.querySelectorAll("path"));
      logoPathDs = paths.map((p) => p.getAttribute("d") || "").filter(Boolean);
    } else {
      // 兜底：极端情况下再用正则
      const dMatches = svgText.match(/<path[^>]*\sd="([^"]+)"/g) || [];
      logoPathDs = dMatches
        .map((s) => {
          const m = s.match(/\sd="([^"]+)"/);
          return m ? m[1] : "";
        })
        .filter(Boolean);
    }
  } catch (e) {
    console.warn("DOMParser parse failed, fallback regex:", e);
    const dMatches = svgText.match(/<path[^>]*\sd="([^"]+)"/g) || [];
    logoPathDs = dMatches
      .map((s) => {
        const m = s.match(/\sd="([^"]+)"/);
        return m ? m[1] : "";
      })
      .filter(Boolean);
  }

  logoPathParsed = logoPathDs.map((d) => {
    const commands = parseSvgPathD(d);
    const bbox = computeCommandsBBox(commands);
    return { commands, bbox };
  });
}

function ensureLogoParsed() {
  // preload 可能在某些托管场景下没成功（比如资源返回内容类型/路径问题）
  // 这里在切到 Logo 模式时做一次 fetch 容错兜底。
  if (logoPathParsed && logoPathParsed.length >= 3) return Promise.resolve(true);

  if (typeof fetch !== "function") return Promise.resolve(false);

  return fetch("boost_resources/Logo")
    .then((r) => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    })
    .then((txt) => {
      loadLogoSvg(txt);
      return logoPathParsed && logoPathParsed.length >= 3;
    })
    .catch((e) => {
      console.warn("Failed to fetch/parse boost_resources/Logo:", e);
      return false;
    });
}

function buildLogoBase() {
  if (!logoPathParsed || logoPathParsed.length < 3) {
    console.warn("SVG Logo 未解析到 3 条 path，请检查 boost_resources/Logo 是否存在且格式正确。");
    // 兜底回到 TTF
    if (typeof setText === "function") {
      renderMode = 0;
      setText();
    }
    return;
  }

  // 组包围盒（3 字符合体）
  const groupMinX = Math.min(logoPathParsed[0].bbox.minX, logoPathParsed[1].bbox.minX, logoPathParsed[2].bbox.minX);
  const groupMaxX = Math.max(logoPathParsed[0].bbox.maxX, logoPathParsed[1].bbox.maxX, logoPathParsed[2].bbox.maxX);
  const groupMinY = Math.min(logoPathParsed[0].bbox.minY, logoPathParsed[1].bbox.minY, logoPathParsed[2].bbox.minY);
  const groupMaxY = Math.max(logoPathParsed[0].bbox.maxY, logoPathParsed[1].bbox.maxY, logoPathParsed[2].bbox.maxY);
  const groupWidth = groupMaxX - groupMinX;
  const groupHeight = groupMaxY - groupMinY;
  const groupCenterX = (groupMinX + groupMaxX) / 2;
  const groupCenterY = (groupMinY + groupMaxY) / 2;

  // 与原版文本相同：scale 尽量适配 wWindow 和画面高度
  const widthTarget = wWindow;
  let scale = widthTarget / groupWidth;

  const heightTest = height - 100; // 单行
  const scaledH = groupHeight * scale;
  if (scaledH > heightTest) {
    scale = heightTest / groupHeight;
  }

  // 在 p5 里让 logo 组居中：groupCenter -> (0,0)
  // Kerning：以第一个图形（C1）为锚点不动，后两个相对它调整间距
  // k > 0：2 向右、3 向左（以 1 为中心拉开）；k < 0 反向靠拢
  const k = logoKerning;
  const letPositions = [
    { x: (logoPathParsed[0].bbox.centerX - groupCenterX) * scale + 0 * k, y: (logoPathParsed[0].bbox.centerY - groupCenterY) * scale },
    { x: (logoPathParsed[1].bbox.centerX - groupCenterX) * scale + 1 * k, y: (logoPathParsed[1].bbox.centerY - groupCenterY) * scale },
    { x: (logoPathParsed[2].bbox.centerX - groupCenterX) * scale + -1 * k, y: (logoPathParsed[2].bbox.centerY - groupCenterY) * scale },
  ];

  coreBase = new SvgTumbleBase(scale, letPositions);
  coreBase.liveReset();
  coreBase.tickerReset();
}

function setRenderMode(val) {
  renderMode = parseInt(val, 10) || 0;

  const textArea = document.getElementById("textArea");
  const fontChange = document.getElementById("fontChange");
  const alignModeEl = document.getElementById("alignMode");
  const logoUI = document.getElementById("logoKerningUI");
  const logoStatus = document.getElementById("logoStatus");

  if (renderMode === 0) {
    if (textArea) textArea.disabled = false;
    if (fontChange) fontChange.disabled = false;
    if (alignModeEl) alignModeEl.disabled = false;
    if (logoUI) logoUI.style.display = "none";
    if (logoStatus) logoStatus.style.display = "none";
    // 交给 sketch_boost.js 的 setText() 重建文字
    setText();
  } else {
    if (textArea) textArea.disabled = true;
    if (fontChange) fontChange.disabled = true;
    if (alignModeEl) alignModeEl.disabled = true;
    if (logoUI) logoUI.style.display = "block";
    // 重新构建 SVG base（允许 fetch 容错）
    ensureLogoParsed().then((ok) => {
      if (!ok) {
        // buildLogoBase 内也会回退，但这里提前给出原因
        console.warn("Logo SVG parsed failed, fallback to TTF.");
      }
      if (logoStatus) {
        logoStatus.textContent = ok ? "Logo SVG 状态：OK" : "Logo SVG 解析失败，回退 TTF";
        logoStatus.style.display = "block";
      }
      buildLogoBase();
    });
  }
}

function setLogoKerning(val) {
  if (renderMode !== 1) return;
  // 反转滑条方向：UI 数值越大，效果与之前相反
  logoKerning = -(parseFloat(val) || 0);
  buildLogoBase();
}

function setLogoFillColor(index, val) {
  const i = parseInt(index, 10);
  if (Number.isNaN(i) || i < 0 || i > 2) return;
  logoFillColors[i] = val;
}

SvgTumbleLet = class SvgTumbleLet {
  constructor(commands, x, y, index) {
    this.rawCommands = commands;
    this.x = x;
    this.y = y;

    this.index = index;
    this.zBias = this.index === 0 ? logoC1FrontOffset : 0;

    this.xAct = 0;
    this.yAct = 0;
    this.zAct = 0;

    this.xRotAct = 0;
    this.yRotAct = 0;
    this.zRotAct = 0;

    this.xRotBase = 0;
    this.yRotBase = 0;
    this.zRotBase = 0;

    this.yRotTar = 0;
    this.yRotReturn = 0;

    this.dAct = 0;
    this.dTar = 0;
    this.zTar = 0;
    this.zRotTar = 0;

    this.ticker = 0;
    this.coreTicker = 0;

    this.commands = commands; // 这里直接用“已经在 buildLogoBase 里 scale/center 后”的 commands

    this.cols = [];
    this.runReset();
  }

  runReset() {
    this.tickerReset();

    this.xRotBase = random(-PI / 8, PI / 8);
    this.yRotBase = random(-PI / 6, PI / 6);
    this.zRotBase = random(-PI / 6, PI / 6);

    this.liveReset();

    const n = this.commands.length;
    for (let p = 0; p < n; p++) {
      this.cols[p] = round(random(colorSet.length - 1));
    }
  }

  tickerReset() {
    const tkDist = dist(mouseCenter.x, mouseCenter.y, this.x, this.y);
    this.ticker = map(tkDist, 0, maxDist, 0, maxDelay);
    this.coreTicker = 0;
  }

  liveReset() {
    this.xTar = 0;
    this.yTar = 0;
    this.zTar = 0;
    this.xRotTar = 0;
    this.yRotTar = 0;
    this.yRotReturn = 0;
    this.zRotTar = 0;

    if (extrudeType == 0) {
      // TUMBLE
      this.xRotTar = tumbleAmount * this.xRotBase;
      this.yRotTar = tumbleAmount * this.yRotBase;
      this.zRotTar = tumbleAmount * this.zRotBase;

      this.dTar = tumbleDepthLength;
      this.zTar = -this.dTar / 2 + (this.index % 2) * this.dTar;
    } else if (extrudeType == 1) {
      // ZOOM
      this.dTar = zoomDepthLength;
      this.zTar = -this.dTar / 2;
    } else {
      // PUNCH
      const blastAng = atan2(this.y - mouseCenter.y, this.x - mouseCenter.x);
      const blastDist = dist(mouseCenter.x, mouseCenter.y, this.x, this.y);
      let blastMag0 = map(blastDist, 0, maxDist, 0, 1);
      if (punchInvert) blastMag0 = map(blastDist, 0, maxDist, 1, 0);
      const blastMag = map(easeInOutExpo(blastMag0), 0, 1, 0, punchDistance);

      this.xTar = cos(blastAng) * blastMag;
      this.yTar = sin(blastAng) * blastMag;

      this.yRotTar = map(easeInOutExpo(blastMag0), 0, 1, 0, -PI / 3);
      this.zRotTar = blastAng / 3;
      this.yRotReturn = 0;

      this.dTar = punchDepthLength;
      this.zTar = -this.dTar / 2 + (this.index % 2) * this.dTar;
    }
  }

  update() {
    this.coreTicker++;
    this.ticker++;

    if (this.ticker < 0) {
      this.xAct = 0;
      this.yAct = 0;
      this.zAct = 0;
      this.xRotAct = 0;
      this.yRotAct = 0;
      this.zRotAct = 0;
      this.dAct = 0;
    } else if (this.ticker < animA) {
      const tk0 = map(this.ticker, 0, animA, 0, 1);
      const tk1 = stageAaccel(tk0);

      this.xAct = map(tk1, 0, 1, 0, this.xTar);
      this.yAct = map(tk1, 0, 1, 0, this.yTar);
      this.zAct = map(tk1, 0, 1, 0, this.zTar);

      this.xRotAct = map(tk1, 0, 1, 0, this.xRotTar);
      this.yRotAct = map(tk1, 0, 1, 0, this.yRotTar);
      this.zRotAct = map(tk1, 0, 1, 0, this.zRotTar);

      this.dAct = map(tk1, 0, 1, 0, this.dTar);
    } else if (this.ticker < animB) {
      this.xAct = this.xTar;
      this.yAct = this.yTar;
      this.zAct = this.zTar;
      this.xRotAct = this.xRotTar;
      this.yRotAct = this.yRotTar;
      this.zRotAct = this.zRotTar;
      this.dAct = this.dTar;
    } else if (this.ticker < animC) {
      const tk0 = map(this.ticker, animB, animC, 0, 1);
      const tk1 = stageBaccel(tk0);

      this.xAct = map(tk1, 0, 1, this.xTar, 0);
      this.yAct = map(tk1, 0, 1, this.yTar, 0);
      this.zAct = map(tk1, 0, 1, this.zTar, 0);

      this.xRotAct = map(tk1, 0, 1, this.xRotTar, 0);
      this.yRotAct = map(tk1, 0, 1, this.yRotTar, this.yRotReturn);
      this.zRotAct = map(tk1, 0, 1, this.zRotTar, 0);

      this.dAct = map(tk1, 0, 1, this.dTar, 0);
    } else {
      this.xAct = 0;
      this.yAct = 0;
      this.zAct = 0;
      this.xRotAct = 0;
      this.yRotAct = this.yRotReturn;
      this.zRotAct = 0;
      this.dAct = 0;
    }

    if (this.coreTicker >= animC + abs(maxDelay * 2)) {
      this.runReset();
    }
  }

  run() {
    this.update();

    push();
    translate(this.x, this.y);
    translate(this.xAct, this.yAct, this.zAct);
    // 让 C1 稍微更靠近观众，降低与两侧的深度穿插
    if (this.zBias) translate(0, 0, this.zBias);

    // 围绕“深度中心”旋转：local z 从 0 -> dAct
    translate(0, 0, this.dAct / 2);
    rotateX(this.xRotAct);
    rotateY(this.yRotAct);
    rotateZ(this.zRotAct);
    translate(0, 0, -this.dAct / 2);

    this.displayShape();
    if (strokeOnToggle) this.displaySkel();
    if (sidesType != 0) this.displayExtrudePatch();
    pop();
  }

  displayShape() {
    const strokeRepeats = 2; // 模拟前/后面
    const cmds = this.commands;

    for (let m = 0; m < strokeRepeats; m++) {
      push();
      translate(0, 0, m * this.dAct);

      for (let r = 0; r < strokeRepeats; r++) {
        if (strokeOnToggle) {
          if (r == 0) {
            strokeWeight(strokeW);
            stroke(strokeColor);
            noFill();
          } else {
            translate(0, 0, -0.5);
            noStroke();
            if (capsOnToggle) fill(logoFillColors[this.index] || textColor);
            else noFill();
          }
        } else {
          noStroke();
          if (capsOnToggle) fill(logoFillColors[this.index] || textColor);
          else noFill();
        }

        let closePoint = 0;
        var openContour = false;
        for (let i = 0; i < cmds.length; i++) {
          if (cmds[i].type == "M") {
            if (i > 0) {
              beginContour();
              openContour = true;
            } else {
              beginShape(TESS);
            }
            vertex(cmds[i].x, cmds[i].y);
          }

          if (cmds[i].type == "Z") {
            if (openContour) endContour();
            if (cmds.length - 1 === i) endShape(CLOSE);
            point(cmds[closePoint].x, cmds[closePoint].y);
            closePoint = i + 1;
          }

          if (cmds[i].type == "L") vertex(cmds[i].x, cmds[i].y);

          if (cmds[i].type == "Q") {
            quadraticVertex(cmds[i].x1, cmds[i].y1, cmds[i].x, cmds[i].y);
          }

          if (cmds[i].type == "C") {
            bezierVertex(cmds[i].x1, cmds[i].y1, cmds[i].x2, cmds[i].y2, cmds[i].x, cmds[i].y);
            vertex(cmds[i].x, cmds[i].y);
          }
        }
      }
      pop();
    }
  }

  displayExtrudePatch() {
    if (sidesType == 1) {
      fill(sideSolidColor);
    }
    noStroke();

    const cmds = this.commands;
    let closePoint = 0;

    for (let i = 0; i < cmds.length; i++) {
      if (sidesType == 2) fill(colorSet[this.cols[i]]);

      if (cmds[i].type == "Z") {
        beginShape(TRIANGLE_STRIP);
        vertex(cmds[i - 1].x, cmds[i - 1].y, 0);
        vertex(cmds[i - 1].x, cmds[i - 1].y, this.dAct);

        vertex(cmds[closePoint].x, cmds[closePoint].y, 0);
        vertex(cmds[closePoint].x, cmds[closePoint].y, this.dAct);
        endShape();

        closePoint = i + 1;
      }

      if (cmds[i].type == "L") {
        beginShape(TRIANGLE_STRIP);
        vertex(cmds[i - 1].x, cmds[i - 1].y, 0);
        vertex(cmds[i - 1].x, cmds[i - 1].y, this.dAct);

        vertex(cmds[i].x, cmds[i].y, 0);
        vertex(cmds[i].x, cmds[i].y, this.dAct);
        endShape();
      }

      if (cmds[i].type == "Q") {
        beginShape(TRIANGLE_STRIP);
        for (let r = 0; r < res; r++) {
          const thisT = r / (res - 1);
          const thisX = quadLerp(cmds[i - 1].x, cmds[i].x1, cmds[i].x, thisT);
          const thisY = quadLerp(cmds[i - 1].y, cmds[i].y1, cmds[i].y, thisT);
          vertex(thisX, thisY, 0);
          vertex(thisX, thisY, this.dAct);
        }
        endShape();
      }

      if (cmds[i].type == "C") {
        beginShape(TRIANGLE_STRIP);
        for (let r = 0; r < res; r++) {
          const thisT = r / (res - 1);
          const thisX = bezierPoint(cmds[i - 1].x, cmds[i].x1, cmds[i].x2, cmds[i].x, thisT);
          const thisY = bezierPoint(cmds[i - 1].y, cmds[i].y1, cmds[i].y2, cmds[i].y, thisT);
          vertex(thisX, thisY, 0);
          vertex(thisX, thisY, this.dAct);
        }
        endShape();
      }
    }
  }

  displaySkel() {
    const cmds = this.commands;
    push();
    translate(0, 0, -1);
    noFill();
    stroke(strokeColor);
    strokeWeight(strokeW);

    for (let i = 0; i < cmds.length; i++) {
      if (cmds[i].type != "Z") {
        line(cmds[i].x, cmds[i].y, 0, cmds[i].x, cmds[i].y, this.dAct);
      }
    }
    pop();
  }
};

SvgTumbleBase = class SvgTumbleBase {
  constructor(scale, letPositions) {
    this.lets = [];

    // 把每个路径的原始 commands 缩放并平移到“组中心=0,0”
    // 这里要求：loadLogoSvg() 已经把 bbox 解析好了。
    const groupMinX = Math.min(logoPathParsed[0].bbox.minX, logoPathParsed[1].bbox.minX, logoPathParsed[2].bbox.minX);
    const groupMinY = Math.min(logoPathParsed[0].bbox.minY, logoPathParsed[1].bbox.minY, logoPathParsed[2].bbox.minY);
    const groupMaxX = Math.max(logoPathParsed[0].bbox.maxX, logoPathParsed[1].bbox.maxX, logoPathParsed[2].bbox.maxX);
    const groupMaxY = Math.max(logoPathParsed[0].bbox.maxY, logoPathParsed[1].bbox.maxY, logoPathParsed[2].bbox.maxY);
    const groupCenterX = (groupMinX + groupMaxX) / 2;
    const groupCenterY = (groupMinY + groupMaxY) / 2;

    // 更新全局 maxDist：给 tickerReset 使用
    // 这里不能先置 0，避免 map() 在极端情况下产生 NaN
    maxDist = 100;

    for (let gi = 0; gi < 3; gi++) {
      const { commands } = logoPathParsed[gi];

      // 将 commands 映射到局部坐标：以 group center 为原点，再加上缩放
      const localCommands = commands.map((c) => {
        if (c.type === "M" || c.type === "L") {
          return { ...c, x: (c.x - groupCenterX) * scale, y: (c.y - groupCenterY) * scale };
        }
        if (c.type === "Q") {
          return {
            ...c,
            x1: (c.x1 - groupCenterX) * scale,
            y1: (c.y1 - groupCenterY) * scale,
            x: (c.x - groupCenterX) * scale,
            y: (c.y - groupCenterY) * scale,
          };
        }
        if (c.type === "C") {
          return {
            ...c,
            x1: (c.x1 - groupCenterX) * scale,
            y1: (c.y1 - groupCenterY) * scale,
            x2: (c.x2 - groupCenterX) * scale,
            y2: (c.y2 - groupCenterY) * scale,
            x: (c.x - groupCenterX) * scale,
            y: (c.y - groupCenterY) * scale,
          };
        }
        return c; // Z
      });

      const pos = letPositions[gi];
      const letX = pos.x;
      const letY = pos.y;

      const letObj = new SvgTumbleLet(localCommands, letX, letY, gi);
      this.lets.push(letObj);

      const meas = dist(letObj.x, letObj.y, mouseCenter.x, mouseCenter.y);
      if (meas > maxDist) maxDist = meas;
    }
  }

  run() {
    for (let m = 0; m < this.lets.length; m++) {
      this.lets[m].run();
    }
  }

  liveReset() {
    for (let m = 0; m < this.lets.length; m++) {
      this.lets[m].liveReset();
    }
  }

  tickerReset() {
    for (let m = 0; m < this.lets.length; m++) {
      this.lets[m].tickerReset();
    }
  }
};

