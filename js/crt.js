/* Shared broken-CRT canvas animation for index.html and 404.html.
   Edit here only - both pages load this file. */

// Glitch Animation - Broken CRT TV
document.addEventListener("DOMContentLoaded", function () {
  var canvas = document.getElementById("glitch-canvas");
  var ctx = canvas.getContext("2d");
  var mouse = { x: 0.5, y: 0.5 };
  var prevMouse = { x: 0.5, y: 0.5 };
  var glitchIntensity = 0;
  var baseColor = { r: 10, g: 10, b: 18 };
  var time = 0;

  // Aperiodic drift: sum of incommensurate sines. Smooth, cheap, and
  // with no repeating period at human timescales, so nothing visibly
  // cycles. Returns roughly 0..1; each `seed` gives an unrelated curve.
  function wobble(t, seed) {
    return (
      0.5 +
      0.25 * Math.sin(t * 0.271 + seed * 1.7) +
      0.15 * Math.sin(t * 0.567 + seed * 3.1) +
      0.1 * Math.sin(t * 1.093 + seed * 5.9)
    );
  }

  // Rolling sweeps keep their own position so their speed can vary
  // without the motion accelerating over time.
  var vhsPos = 0;
  var vhs2Pos = 0;

  // Interference bands are persistent objects that re-seed on wrap,
  // so no two passes share a speed, height or opacity.
  var bands = [];
  function seedBand(bh, atTop) {
    return {
      y: atTop ? -60 : Math.random() * (bh + 100) - 50,
      speed: 35 + Math.random() * 110,
      height: 12 + Math.random() * 65,
      alpha: 0.006 + Math.random() * 0.018,
      phase: Math.random() * 100
    };
  }

  // Performance: Check for reduced motion preference
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Performance: Detect low-end devices (rough heuristic)
  var isLowEnd = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;

  // Performance: Pre-generated noise colors
  var noiseColors = [];
  for (var i = 0; i < 256; i++) {
    noiseColors.push("rgba(" + i + "," + i + "," + i + ",");
  }

  // Performance: Phosphor pattern canvas (static, drawn once)
  var phosphorCanvas = document.createElement("canvas");
  var phosphorCtx = phosphorCanvas.getContext("2d");
  var phosphorReady = false;

  function generatePhosphor(w, h) {
    phosphorCanvas.width = w;
    phosphorCanvas.height = h;
    phosphorCtx.clearRect(0, 0, w, h);
    var spacing = 3;
    for (var py = 0; py < h; py += spacing * 2) {
      for (var px = 0; px < w; px += spacing * 3) {
        phosphorCtx.fillStyle = "rgb(255,50,50)";
        phosphorCtx.fillRect(px, py, 1, 1);
        phosphorCtx.fillStyle = "rgb(50,255,50)";
        phosphorCtx.fillRect(px + spacing, py, 1, 1);
        phosphorCtx.fillStyle = "rgb(50,50,255)";
        phosphorCtx.fillRect(px + spacing * 2, py, 1, 1);
      }
    }
    phosphorReady = true;
  }

  // The bars now carry the colour, so the underlay drops back to a
  // set of near-black tints that just warm or cool the picture.
  function randomColor() {
    var colors = [
      { r: 10, g: 10, b: 18 },
      { r: 16, g: 10, b: 12 },
      { r: 8, g: 14, b: 18 },
      { r: 14, g: 12, b: 8 },
      { r: 8, g: 16, b: 13 },
      { r: 15, g: 9, b: 16 },
      { r: 8, g: 10, b: 20 },
      { r: 18, g: 9, b: 9 }
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // --- SMPTE colour bars ------------------------------------------
  // 75% bars, the reverse-blue strip, and the PLUGE row. Rendered once
  // per resize to an offscreen canvas, then composited at low alpha.
  var BARS_TOP = [
    [192, 192, 192], [192, 192, 0], [0, 192, 192], [0, 192, 0],
    [192, 0, 192], [192, 0, 0], [0, 0, 192]
  ];
  var BARS_MID = [
    [0, 0, 192], [16, 16, 16], [192, 0, 192], [16, 16, 16],
    [0, 192, 192], [16, 16, 16], [192, 192, 192]
  ];
  var barsCanvas = document.createElement("canvas");
  var barsCtx = barsCanvas.getContext("2d");
  var barsReady = false;
  var barOffset = 0;
  var barAlpha = 0.085;

  function generateBars(w, h) {
    barsCanvas.width = w;
    barsCanvas.height = h;
    barsCtx.clearRect(0, 0, w, h);

    var topH = h * 0.67;
    var midH = h * 0.08;
    var barW = w / 7;
    var i, c;

    // Main bars - rotated by barOffset, so a click re-scrambles them
    for (i = 0; i < 7; i++) {
      c = BARS_TOP[(i + barOffset) % 7];
      barsCtx.fillStyle = "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")";
      barsCtx.fillRect(i * barW, 0, barW + 1, topH);
    }

    // Reverse-blue strip
    for (i = 0; i < 7; i++) {
      c = BARS_MID[(i + barOffset) % 7];
      barsCtx.fillStyle = "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")";
      barsCtx.fillRect(i * barW, topH, barW + 1, midH);
    }

    // Bottom row: -I, 100% white, +Q, black, PLUGE, black.
    // Widths follow the real pattern: 5/28 each, then 3 x 1/21, then 1/7.
    var y = topH + midH;
    var bh = h - y;
    var x = 0;
    var bottom = [
      [[0, 33, 76], (5 / 28) * w],
      [[235, 235, 235], (5 / 28) * w],
      [[50, 0, 106], (5 / 28) * w],
      [[16, 16, 16], (5 / 28) * w],
      [[8, 8, 8], w / 21],
      [[16, 16, 16], w / 21],
      [[26, 26, 26], w / 21],
      [[16, 16, 16], w / 7]
    ];
    for (i = 0; i < bottom.length; i++) {
      c = bottom[i][0];
      barsCtx.fillStyle = "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")";
      barsCtx.fillRect(x, y, bottom[i][1] + 1, bh);
      x += bottom[i][1];
    }
    barsReady = true;
  }

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    generatePhosphor(canvas.width, canvas.height);
    generateBars(canvas.width, canvas.height);
  }
  resize();
  window.addEventListener("resize", resize);

  // Performance: Throttle on hidden tab
  var isVisible = true;
  document.addEventListener("visibilitychange", function () {
    isVisible = !document.hidden;
  });

  // Mouse movement for desktop
  document.addEventListener("mousemove", function (e) {
    prevMouse.x = mouse.x;
    prevMouse.y = mouse.y;
    mouse.x = e.clientX / window.innerWidth;
    mouse.y = e.clientY / window.innerHeight;
  });

  // Device orientation for mobile
  var motionEnabled = false;
  function handleOrientation(e) {
    if (!motionEnabled) return;
    prevMouse.x = mouse.x;
    prevMouse.y = mouse.y;
    // beta: front-to-back tilt (-180 to 180), gamma: left-to-right tilt (-90 to 90)
    var beta = e.beta || 0;
    var gamma = e.gamma || 0;
    // Normalize to 0-1 range
    mouse.x = Math.max(0, Math.min(1, (gamma + 45) / 90));
    mouse.y = Math.max(0, Math.min(1, (beta + 45) / 90));
    // Trigger subtle glitch on fast movement
    var tiltDelta = Math.abs(mouse.x - prevMouse.x) + Math.abs(mouse.y - prevMouse.y);
    if (tiltDelta > 0.05) {
      glitchIntensity = Math.min(1, glitchIntensity + tiltDelta * 2);
    }
  }

  function enableMotion() {
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      // iOS 13+ requires permission
      DeviceOrientationEvent.requestPermission()
        .then(function (response) {
          if (response === "granted") {
            motionEnabled = true;
            window.addEventListener("deviceorientation", handleOrientation);
          }
        })
        .catch(console.error);
    } else if ("DeviceOrientationEvent" in window) {
      // Android and older iOS
      motionEnabled = true;
      window.addEventListener("deviceorientation", handleOrientation);
    }
  }

  // Click/tap handler
  document.addEventListener("click", function () {
    glitchIntensity = 1;
    baseColor = randomColor();
    // Re-scramble the test pattern
    barOffset = (barOffset + 1 + Math.floor(Math.random() * 6)) % 7;
    generateBars(canvas.width, canvas.height);
    // Enable motion on first tap (needed for iOS permission)
    if (!motionEnabled) {
      enableMotion();
    }
  });

  // Try to enable motion on load for Android
  if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission !== "function") {
    enableMotion();
  }

  function drawGlitch() {
    // Skip rendering when tab is hidden
    if (!isVisible) {
      requestAnimationFrame(drawGlitch);
      return;
    }

    time += 0.016;
    glitchIntensity *= 0.96;

    var w = canvas.width;
    var h = canvas.height;

    // Slow signal-quality envelope: gives long calm stretches broken by
    // busier patches, instead of one flat level forever.
    var unrest = reducedMotion ? 0.5 : wobble(time, 0);

    // Base colour never sits perfectly still
    var cd = reducedMotion ? 0 : (wobble(time, 31.2) - 0.5) * 6;
    ctx.fillStyle =
      "rgb(" +
      Math.max(0, (baseColor.r + cd) | 0) + "," +
      Math.max(0, (baseColor.g + cd * 0.7) | 0) + "," +
      Math.max(0, (baseColor.b + cd * 1.3) | 0) + ")";
    ctx.fillRect(0, 0, w, h);

    // Test pattern, kept dim enough to tint rather than illuminate.
    // On a burst it tears sideways, like a picture losing horizontal lock.
    if (barsReady) {
      var barTear = reducedMotion ? 0 : (Math.random() - 0.5) * glitchIntensity * 50;
      ctx.globalAlpha = reducedMotion
        ? barAlpha
        : barAlpha + unrest * 0.02 + glitchIntensity * 0.14;
      ctx.drawImage(barsCanvas, barTear, 0);
      ctx.globalAlpha = 1;
    }

    // Reduced motion: static image only
    if (reducedMotion) {
      if (phosphorReady) {
        ctx.globalAlpha = 0.035;
        ctx.drawImage(phosphorCanvas, 0, 0);
        ctx.globalAlpha = 1;
      }
      requestAnimationFrame(drawGlitch);
      return;
    }

    // Horizontal glitch lines on burst
    if (glitchIntensity > 0.05) {
      var numLines = Math.floor(glitchIntensity * 20);
      for (var k = 0; k < numLines; k++) {
        var ly = Math.random() * h;
        var lh = 1 + Math.random() * 4 * glitchIntensity;
        var lOffset = (Math.random() - 0.5) * glitchIntensity * 100;
        ctx.fillStyle = "rgba(255,255,255," + (glitchIntensity * 0.3) + ")";
        ctx.fillRect(lOffset, ly, w, lh);
      }
    }

    // RGB split on burst
    if (glitchIntensity > 0.1) {
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = glitchIntensity * 0.2;
      ctx.fillStyle = "rgb(255,0,0)";
      ctx.fillRect(-glitchIntensity * 10, 0, w, h);
      ctx.fillStyle = "rgb(0,255,255)";
      ctx.fillRect(glitchIntensity * 10, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }

    // CRT static noise - density breathes, and a third of the grain
    // gathers in a slowly drifting zone. Uniform scatter reads as a
    // constant texture; clustering is what makes it look alive.
    var baseNoise = (isLowEnd ? 150 : 350) * (0.45 + unrest * 0.8);
    var noiseCount =
      Math.floor(baseNoise) + Math.floor(glitchIntensity * (isLowEnd ? 500 : 1500));
    var clumpY = wobble(time, 21.4) * h;
    var clumpH = h * 0.22;
    var noiseBase = 0.05 + unrest * 0.05;
    for (var n = 0; n < noiseCount; n++) {
      var nx = Math.random() * w;
      var ny = n % 3 === 0
        ? clumpY + (Math.random() - 0.5) * clumpH
        : Math.random() * h;
      var brightness = (Math.random() * 200) | 0;
      var noiseAlpha = noiseBase + Math.random() * 0.1 + glitchIntensity * 0.3;
      ctx.fillStyle = noiseColors[brightness] + noiseAlpha + ")";
      ctx.fillRect(nx, ny, 1 + Math.random() * 2, 1);
    }

    // RGB phosphor dots pattern (pre-rendered)
    if (phosphorReady) {
      ctx.globalAlpha = 0.028 + unrest * 0.014 + glitchIntensity * 0.1;
      ctx.drawImage(phosphorCanvas, 0, 0);
      ctx.globalAlpha = 1;
    }

    // Horizontal interference bands - each drifts at its own pace and
    // fades on its own schedule, so they never march in formation
    while (bands.length < 3) bands.push(seedBand(h, false));
    for (var b = 0; b < bands.length; b++) {
      var bd = bands[b];
      bd.y += bd.speed * 0.016;
      if (bd.y > h + 50) {
        bd = bands[b] = seedBand(h, true);
      }
      var bandA = bd.alpha * wobble(time, bd.phase) + glitchIntensity * 0.1;
      if (bandA > 0.002) {
        ctx.fillStyle = "rgba(255,255,255," + bandA + ")";
        ctx.fillRect(0, bd.y, w, bd.height);
      }
    }

    // Flicker effect - rate drifts, so there are calm and busy stretches
    if (Math.random() < 0.012 + unrest * 0.05 + glitchIntensity * 0.3) {
      ctx.fillStyle = "rgba(255,255,255," + (0.008 + Math.random() * 0.022) + ")";
      ctx.fillRect(0, 0, w, h);
    }

    // VHS tracking band - speed drifts, and it comes and goes rather
    // than sweeping forever at a fixed rate. Position accumulates so a
    // varying speed doesn't compound into runaway motion.
    vhsPos = (vhsPos + (25 + wobble(time, 2.7) * 95) * 0.016) % (h + 200);
    var vhsPresence = wobble(time, 4.2);
    if (vhsPresence > 0.32) {
      var vhsFade = Math.min(1, (vhsPresence - 0.32) / 0.22);
      var vhsY = vhsPos - 100;
      var vhsHeight = 18 + wobble(time, 6.4) * 45;
      ctx.save();
      ctx.globalAlpha =
        (0.05 + wobble(time, 8.1) * 0.045) * vhsFade + glitchIntensity * 0.2;
      // Main tracking band
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fillRect(0, vhsY, w, vhsHeight);
      // Distortion lines within band
      var vLines = 2 + Math.floor(Math.random() * 4);
      for (var v = 0; v < vLines; v++) {
        var lineY = vhsY + Math.random() * vhsHeight;
        var offset = (Math.random() - 0.5) * 20;
        ctx.fillStyle = "rgba(255,255,255," + (0.05 + Math.random() * 0.07) + ")";
        ctx.fillRect(offset, lineY, w, 1 + Math.random() * 2);
      }
      // Color bleed at band edges
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = "rgba(255,0,100,0.04)";
      ctx.fillRect(5, vhsY - 2, w, 3);
      ctx.fillStyle = "rgba(0,200,255,0.04)";
      ctx.fillRect(-5, vhsY + vhsHeight, w, 3);
      ctx.globalCompositeOperation = "source-over";
      ctx.restore();
    }

    // Secondary sweep (slower, larger) on its own unrelated schedule
    vhs2Pos = (vhs2Pos + (12 + wobble(time, 9.6) * 40) * 0.016) % (h + 400);
    if (wobble(time, 12.3) > 0.4) {
      ctx.globalAlpha = 0.02 + wobble(time, 14.7) * 0.025;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, vhs2Pos - 200, w, 40 + wobble(time, 3.3) * 55);
      ctx.globalAlpha = 1;
    }

    // Random micro-glitch - magnitude varies, most barely register
    if (Math.random() < 0.003 + unrest * 0.005) {
      glitchIntensity = Math.min(
        0.3,
        glitchIntensity + 0.03 + Math.random() * Math.random() * 0.22
      );
    }

    prevMouse.x = mouse.x;
    prevMouse.y = mouse.y;

    requestAnimationFrame(drawGlitch);
  }

  // Signal loss effect
  var signalLoss = document.getElementById("signal-loss");
  var signalLossActive = false;

  function triggerSignalLoss() {
    if (signalLossActive) return;
    signalLossActive = true;
    signalLoss.classList.add("active");

    // Flicker pattern - different shape every time
    var flickers = [];
    var flickerCount = 4 + Math.floor(Math.random() * 5);
    for (var f = 0; f < flickerCount; f++) {
      flickers.push(40 + Math.random() * Math.random() * 260);
    }
    var i = 0;

    function flicker() {
      if (i >= flickers.length) {
        signalLoss.classList.remove("active");
        signalLossActive = false;
        return;
      }
      signalLoss.classList.toggle("active");
      setTimeout(flicker, flickers[i]);
      i++;
    }
    setTimeout(flicker, flickers[0]);
  }

  // Random signal loss every 15-40 seconds
  function scheduleSignalLoss() {
    var delay = 15000 + Math.random() * 25000;
    setTimeout(function() {
      triggerSignalLoss();
      scheduleSignalLoss();
    }, delay);
  }
  setTimeout(scheduleSignalLoss, 8000);

  // Logo RGB split clones
  var logoContainer = document.getElementById("logo-glitch");
  var originalSvg = logoContainer && logoContainer.querySelector("svg");
  if (originalSvg) {
    // Red channel
    var redClone = originalSvg.cloneNode(true);
    redClone.classList.add("glitch-r");
    redClone.querySelector("path").setAttribute("fill", "#ff0000");
    logoContainer.appendChild(redClone);

    // Cyan channel
    var cyanClone = originalSvg.cloneNode(true);
    cyanClone.classList.add("glitch-b");
    cyanClone.querySelector("path").setAttribute("fill", "#00ffff");
    logoContainer.appendChild(cyanClone);
  }

  drawGlitch();
});

// Register Service Worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(function () {});
}
