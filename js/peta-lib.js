// Fungsi murni untuk peta-gelombang.html (tanpa DOM, bisa dites di Node).
(function (g) {
  var NODATA = -32768;
  var STOPS = ["#004c45", "#0b7a72", "#4aa59b", "#8fd1c4", "#c9ece6", "#f5f5f5", "#f6e8c3", "#dfc27d", "#bf812d", "#8c510a", "#5c3306"].map(function (h) {
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  });

  function dekode(buf, skala) {
    var a = new Int16Array(buf), f = new Float32Array(a.length);
    for (var i = 0; i < a.length; i++) f[i] = a[i] === NODATA ? NaN : a[i] / skala;
    return f;
  }
  // Interpolasi bilinear; lon melingkar; lat naik. NaN bila di luar grid.
  function sampel(f, M, t, lat, lon) {
    var ny = M.lat.length, nx = M.lon.length, dy = M.lat[1] - M.lat[0], dx = M.lon[1] - M.lon[0];
    var y = (lat - M.lat[0]) / dy; if (!(y >= 0 && y <= ny - 1)) return NaN;
    var x = ((((lon - M.lon[0]) % 360) + 360) % 360) / dx, i0 = Math.floor(x), fx = x - i0, i1 = (i0 + 1) % nx; i0 %= nx;
    var j0 = Math.min(Math.floor(y), ny - 2), fy = y - j0, b = t * ny * nx;
    var a = f[b + j0 * nx + i0], c = f[b + j0 * nx + i1], d = f[b + (j0 + 1) * nx + i0], e = f[b + (j0 + 1) * nx + i1];
    return (a * (1 - fx) + c * fx) * (1 - fy) + (d * (1 - fx) + e * fx) * fy;
  }
  function terdekat(f, M, t, lat, lon) {
    var ny = M.lat.length, nx = M.lon.length, dy = M.lat[1] - M.lat[0], dx = M.lon[1] - M.lon[0];
    var j = Math.round((lat - M.lat[0]) / dy), i = Math.round(((((lon - M.lon[0]) % 360) + 360) % 360) / dx) % nx;
    if (j < 0 || j > ny - 1) return null;
    return { v: f[(t * ny + j) * nx + i], lat: M.lat[j], lon: M.lon[i] };
  }
  function warna(v, r) { // r = batas simetris; hasil [r,g,b] atau null
    if (isNaN(v)) return null;
    var p = Math.max(0, Math.min(1, (v / r + 1) / 2)) * (STOPS.length - 1), k = Math.min(Math.floor(p), STOPS.length - 2), u = p - k;
    return [0, 1, 2].map(function (c) { return Math.round(STOPS[k][c] * (1 - u) + STOPS[k + 1][c] * u); });
  }
  // Marching squares pada ambang th. Hasil: [[lat1,lon1,lat2,lon2], ...] dengan lon 0..360.
  function kontur(f, M, t, th) {
    var ny = M.lat.length, nx = M.lon.length, dy = M.lat[1] - M.lat[0], dx = M.lon[1] - M.lon[0], b = t * ny * nx, out = [];
    var TAB = { 1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 5: [[3, 0], [1, 2]], 6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]], 9: [[0, 2]], 10: [[0, 1], [2, 3]], 11: [[1, 2]], 12: [[1, 3]], 13: [[0, 1]], 14: [[3, 0]] };
    for (var j = 0; j < ny - 1; j++) for (var i = 0; i < nx; i++) {
      var i1 = (i + 1) % nx, v = [f[b + j * nx + i], f[b + j * nx + i1], f[b + (j + 1) * nx + i1], f[b + (j + 1) * nx + i]];
      if (v.some(isNaN)) continue;
      var c = (v[0] >= th ? 1 : 0) | (v[1] >= th ? 2 : 0) | (v[2] >= th ? 4 : 0) | (v[3] >= th ? 8 : 0);
      if (!TAB[c]) continue;
      var la = M.lat[j], lo = M.lon[0] + i * dx;
      var pt = function (e) {
        if (e === 0) return [la, lo + (th - v[0]) / (v[1] - v[0]) * dx];
        if (e === 1) return [la + (th - v[1]) / (v[2] - v[1]) * dy, lo + dx];
        if (e === 2) return [la + dy, lo + (th - v[3]) / (v[2] - v[3]) * dx];
        return [la + (th - v[0]) / (v[3] - v[0]) * dy, lo];
      };
      TAB[c].forEach(function (s) { var p = pt(s[0]), q = pt(s[1]); out.push([p[0], p[1], q[0], q[1]]); });
    }
    return out;
  }
  var api = { dekode: dekode, sampel: sampel, terdekat: terdekat, warna: warna, kontur: kontur, STOPS: STOPS };
  if (typeof module !== "undefined") module.exports = api; else g.PetaLib = api;
})(this);
