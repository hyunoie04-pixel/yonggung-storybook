/* 물 효과: 밤의 못. 퍼지는 파문, 떠오르는 빛 알갱이, 천천히 흔들리는 물빛.
   canvas 2D만 쓴다. 모션 감소 설정이면 정지 화면 한 장만 그린다. */
window.FX = (function () {
  'use strict';
  var cv = document.getElementById('water'); if (!cv) return { ripple: function () {}, burst: function () {}, tint: function () {} };
  var cx = cv.getContext('2d'), W = cv.width, H = cv.height;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var rings = [], motes = [], t0 = performance.now(), last = t0, nextAuto = 0;
  var tint = [111, 195, 179], target = [111, 195, 179];
  var TINTS = { pond: [111, 195, 179], scroll: [150, 190, 235], banquet: [236, 178, 110], box: [205, 170, 235], mountain: [170, 190, 200], gold: [217, 180, 106] };

  for (var i = 0; i < 70; i++) motes.push(newMote(true));
  function newMote(anywhere) {
    return { x: Math.random() * W, y: anywhere ? Math.random() * H : H + 10, r: .6 + Math.random() * 1.8, v: 6 + Math.random() * 16, ph: Math.random() * 6.28, sw: 8 + Math.random() * 22 };
  }
  function ripple(x, y, strength) { if (rings.length < 40) rings.push({ x: x, y: y, age: 0, life: 3.2 + Math.random() * 1.4, s: strength || 1 }); }
  function burst(x, y) { for (var k = 0; k < 4; k++) (function (k) { setTimeout(function () { ripple(x, y, 1.6 - k * .25); }, k * 170); })(k); }

  function frame(now) {
    var dt = Math.min(.05, (now - last) / 1000); last = now; var t = (now - t0) / 1000;
    for (var c = 0; c < 3; c++) tint[c] += (target[c] - tint[c]) * Math.min(1, dt * 1.6);
    var col = Math.round(tint[0]) + ',' + Math.round(tint[1]) + ',' + Math.round(tint[2]);
    cx.clearRect(0, 0, W, H);

    /* 물빛: 느리게 움직이는 큰 빛 두 덩이 */
    for (var g = 0; g < 2; g++) {
      var gx = W * (.3 + .4 * g) + Math.sin(t * .13 + g * 2.1) * 180, gy = H * (.35 + .25 * g) + Math.cos(t * .11 + g) * 90;
      var gr = cx.createRadialGradient(gx, gy, 0, gx, gy, 520);
      gr.addColorStop(0, 'rgba(' + col + ',.13)'); gr.addColorStop(1, 'rgba(' + col + ',0)');
      cx.fillStyle = gr; cx.fillRect(0, 0, W, H);
    }

    /* 파문 */
    if (!reduced && now > nextAuto) { ripple(120 + Math.random() * (W - 240), H * .45 + Math.random() * H * .5, .8); nextAuto = now + 1400 + Math.random() * 1800; }
    cx.lineCap = 'round';
    for (var i = rings.length - 1; i >= 0; i--) {
      var r = rings[i]; r.age += dt; var p = r.age / r.life;
      if (p >= 1) { rings.splice(i, 1); continue; }
      for (var k = 0; k < 3; k++) {
        var pp = p - k * .12; if (pp <= 0) continue;
        var rad = 14 + pp * 330 * r.s, a = (1 - p) * (1 - p) * .42 * (1 - k * .28);
        cx.strokeStyle = 'rgba(' + col + ',' + a.toFixed(3) + ')'; cx.lineWidth = 1.6 - k * .4;
        cx.beginPath(); cx.ellipse(r.x, r.y, rad, rad * .32, 0, 0, 6.2832); cx.stroke();
      }
    }

    /* 빛 알갱이 */
    for (var m = 0; m < motes.length; m++) {
      var o = motes[m]; o.y -= o.v * dt; if (o.y < -10) motes[m] = o = newMote(false);
      var x = o.x + Math.sin(t * .6 + o.ph) * o.sw, tw = .35 + .65 * Math.abs(Math.sin(t * 1.3 + o.ph));
      cx.fillStyle = 'rgba(233,241,238,' + (tw * .55).toFixed(3) + ')';
      cx.beginPath(); cx.arc(x, o.y, o.r, 0, 6.2832); cx.fill();
      if (o.r > 1.7) { cx.fillStyle = 'rgba(' + col + ',' + (tw * .12).toFixed(3) + ')'; cx.beginPath(); cx.arc(x, o.y, o.r * 5, 0, 6.2832); cx.fill(); }
    }
    if (!reduced) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* 마우스가 지나가면 물이 일렁인다 */
  var lastMove = 0;
  cv.parentNode.addEventListener('pointermove', function (e) {
    var now = performance.now(); if (reduced || now - lastMove < 260) return; lastMove = now;
    var b = cv.getBoundingClientRect(); ripple((e.clientX - b.left) / b.width * W, (e.clientY - b.top) / b.height * H, .45);
  });
  cv.parentNode.addEventListener('pointerdown', function (e) {
    if (reduced) return; var b = cv.getBoundingClientRect(); burst((e.clientX - b.left) / b.width * W, (e.clientY - b.top) / b.height * H);
  });

  return { ripple: ripple, burst: burst, tint: function (name) { target = TINTS[name] || TINTS.pond; } };
})();
