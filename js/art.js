/* 코드로 그린 먹그림 모티프. 외부 이미지 없이 SVG만 쓴다.
   연못의 파문(박연), 붓자국(상량문), 등불(잔치), 상자(선물), 산 능선(부지소종), 인장. */
window.ART = (function () {
  'use strict';
  function svg(w, h, inner, cls) {
    return '<svg class="' + (cls || '') + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet">' + inner + '</svg>';
  }

  /* 박연: 파문. 먹이 마르며 퍼지듯 선 굵기와 농도가 바깥으로 갈수록 줄어든다 */
  function ripples() {
    var s = '';
    for (var i = 0; i < 9; i++) {
      var rx = 56 + i * 52, ry = rx * 0.3;
      s += '<ellipse cx="450" cy="210" rx="' + rx + '" ry="' + ry.toFixed(1) + '" fill="none" stroke="currentColor" stroke-width="' + (3.4 - i * 0.3).toFixed(2) + '" opacity="' + (0.9 - i * 0.09).toFixed(2) + '" filter="url(#ink-rough)"/>';
    }
    return svg(900, 420, s, 'art art-ripples');
  }

  /* 선물: 巾箱(작은 상자). 뚜껑이 닫힌 정면 */
  function box() {
    var s =
      '<g filter="url(#ink-rough)" fill="currentColor">' +
      '<rect x="20" y="62" width="120" height="62" rx="2"/>' +
      '<path d="M10 62 L150 62 L141 38 L19 38 Z" opacity=".9"/>' +
      '</g>' +
      '<g stroke="var(--hanji)" stroke-width="1.4" opacity=".22" fill="none">' +
      '<path d="M24 78 H136 M24 92 H136 M24 106 H136"/>' +
      '</g>' +
      '<rect x="73" y="56" width="14" height="16" rx="1" fill="var(--hanji)" opacity=".85"/>' +
      '<rect x="77" y="60" width="6" height="8" fill="currentColor"/>';
    return svg(160, 134, s, 'art art-box');
  }

  /* 상량문: 붓이 지나간 자국 */
  function strokes() {
    var s =
      '<g fill="none" stroke="currentColor" stroke-linecap="round" filter="url(#ink-rough)">' +
      '<path d="M40 70 C180 40 330 100 470 62" stroke-width="16" opacity=".85"/>' +
      '<path d="M60 128 C200 110 320 150 440 120" stroke-width="9" opacity=".6"/>' +
      '<path d="M90 176 C210 160 300 190 400 170" stroke-width="5" opacity=".45"/>' +
      '</g>';
    return svg(520, 230, s, 'art art-strokes');
  }

  /* 잔치: 등불. 한 줄로 늘어선 불빛 가운데 하나만 멀리 떨어져 있다 */
  function lanterns() {
    var s = '<g filter="url(#ink-rough)" fill="currentColor">';
    var xs = [60, 130, 200, 270, 340, 410];
    for (var i = 0; i < xs.length; i++) {
      var r = 15 + (i % 3) * 3;
      s += '<ellipse cx="' + xs[i] + '" cy="' + (62 + (i % 2) * 8) + '" rx="' + r + '" ry="' + (r * 1.25).toFixed(1) + '" opacity="' + (0.9 - i * 0.07).toFixed(2) + '"/>';
      s += '<rect x="' + (xs[i] - 1.5) + '" y="0" width="3" height="' + (46 + (i % 2) * 8) + '"/>';
    }
    s += '<ellipse cx="505" cy="190" rx="13" ry="16" opacity=".8"/></g>';
    return svg(540, 230, s, 'art art-lanterns');
  }

  /* 부지소종: 겹겹의 능선 */
  function mountains() {
    var s =
      '<g filter="url(#ink-wash)" fill="currentColor">' +
      '<path d="M0 300 L90 190 L170 250 L270 120 L380 240 L470 170 L600 270 L700 150 L820 260 L900 210 L900 420 L0 420 Z" opacity=".22"/>' +
      '<path d="M0 340 L120 250 L210 300 L330 200 L450 300 L560 230 L690 310 L800 240 L900 290 L900 420 L0 420 Z" opacity=".4"/>' +
      '<path d="M0 390 L140 330 L260 370 L400 310 L540 380 L680 330 L820 380 L900 350 L900 420 L0 420 Z" opacity=".62"/>' +
      '</g>';
    return svg(900, 420, s, 'art art-mountains');
  }

  var BY_MOOD = { pond: ripples, scroll: strokes, banquet: lanterns, box: box, mountain: mountains };
  function mood(name) { return (BY_MOOD[name] || ripples)(); }

  /* 낙관(인장) */
  function seal(ch) {
    return '<svg class="art art-seal" viewBox="0 0 100 100" aria-hidden="true" focusable="false">' +
      '<rect x="5" y="5" width="90" height="90" rx="5" fill="var(--inju)" filter="url(#ink-rough)"/>' +
      '<text x="50" y="73" text-anchor="middle" font-size="70" fill="#f4ebd6" font-family="Noto Serif KR, Batang, serif" font-weight="700">' + ch + '</text></svg>';
  }

  /* 세로로 긴 낙관: 글자 여러 개를 위에서 아래로 */
  function sealTall(chars) {
    var n = chars.length, h = 24 + n * 62, s =
      '<rect x="4" y="4" width="72" height="' + (h - 8) + '" rx="4" fill="var(--inju)" filter="url(#ink-rough)"/>';
    for (var i = 0; i < n; i++) {
      s += '<text x="40" y="' + (62 + i * 62) + '" text-anchor="middle" font-size="52" fill="#f4ebd6" font-family="Noto Serif KR, Batang, serif" font-weight="700">' + chars[i] + '</text>';
    }
    return '<svg class="art art-sealtall" viewBox="0 0 80 ' + h + '" aria-hidden="true" focusable="false">' + s + '</svg>';
  }

  /* 초상 파일이 없을 때 쓰는 먹 실루엣 (얼굴 없음). */
  function silhouette() {
    var s =
      '<g filter="url(#ink-wash)" fill="currentColor">' +
      '<ellipse cx="180" cy="150" rx="62" ry="78" opacity=".85"/>' +
      '<path d="M40 470 C40 330 100 262 180 262 C260 262 320 330 320 470 Z" opacity=".78"/>' +
      '</g>';
    return svg(360, 480, s, 'art art-silhouette');
  }

  /* 쪽 점 위 낙점 */
  function paperNoise() {
    var t = '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420">' +
      '<filter id="a"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="11"/><feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.36  0 0 0 0 0.22  0 0 0 0.22 0"/></filter>' +
      '<filter id="b"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="3" seed="5"/><feColorMatrix values="0 0 0 0 0.55  0 0 0 0 0.45  0 0 0 0 0.25  0 0 0 0.16 0"/></filter>' +
      '<rect width="420" height="420" filter="url(#b)"/><rect width="420" height="420" filter="url(#a)"/></svg>';
    return 'url("data:image/svg+xml,' + encodeURIComponent(t) + '")';
  }

  return { ripples: ripples, box: box, strokes: strokes, lanterns: lanterns, mountains: mountains, mood: mood, seal: seal, sealTall: sealTall, silhouette: silhouette, paperNoise: paperNoise };
})();
