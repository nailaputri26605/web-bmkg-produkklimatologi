// ============================================================
// PENGATURAN: tambah bulan inisial baru di sini (terbaru di depan)
// Folder gambarnya: img/inarcm/<YYYYMM>/
// ============================================================
var INIT_MONTHS = ["202611", "202610", "202609", "202608"];

var BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
             "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

// status animasi InaRCM (dideklarasikan di awal supaya showTab bisa menghentikannya)
var rcmTimer = null, rcmRun = 0, rcmPlaying = false, rcmPlay = null;

// ---------- Tab ----------
function showTab(name) {
  var found = false;
  document.querySelectorAll("nav button").forEach(function (b) {
    var on = b.dataset.tab === name;
    b.setAttribute("aria-selected", on ? "true" : "false");
    if (on) found = true;
  });
  if (!found) { name = "bmkg"; document.querySelector('nav button[data-tab="bmkg"]').setAttribute("aria-selected", "true"); }
  document.querySelectorAll(".panel").forEach(function (p) {
    p.classList.toggle("active", p.id === name);
  });
  history.replaceState(null, "", "#" + name);
  if (name !== "inarcm") stopRcm();
  if (document.body.classList.contains("peta-besar")) petaBesarSet(false);
  if (typeof tampilkanAwms === "function") tampilkanAwms(name);
}
document.querySelectorAll("nav button").forEach(function (b) {
  b.addEventListener("click", function () { showTab(b.dataset.tab); });
});
showTab(location.hash.replace("#", "") || "bmkg");

// ---------- mode peta besar (dari iframe Peta Gelombang) ----------
function petaBesarSet(on) {
  document.body.classList.toggle("peta-besar", on);
  var fr = document.querySelector("#r-awms iframe.peta-frame");
  if (fr && fr.contentWindow) fr.contentWindow.postMessage({ tipe: "petaBesar", aktif: on }, location.origin);
}
window.addEventListener("message", function (e) {
  if (e.origin !== location.origin || !e.data || e.data.tipe !== "petaBesar") return;
  petaBesarSet(!!e.data.aktif);
});
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && document.body.classList.contains("peta-besar")) petaBesarSet(false);
});

// tombol pintasan ke tab lain (data-goto); data-awms-jenis juga mengganti jenis inaWMS
document.querySelectorAll("[data-goto]").forEach(function (b) {
  b.addEventListener("click", function () {
    showTab(b.dataset.goto);
    if (b.dataset.awmsJenis && awmsJenis) {
      awmsJenis.value = b.dataset.awmsJenis;
      awmsJenisBerubah();
      renderAwms();
    }
    window.scrollTo(0, 0);
  });
});

// ---------- Sub-tab (Info BMKG) ----------
document.querySelectorAll(".subtab").forEach(function (b) {
  b.addEventListener("click", function () {
    var panel = b.closest(".panel");
    panel.querySelectorAll(".subtab").forEach(function (x) {
      x.setAttribute("aria-selected", x === b ? "true" : "false");
    });
    panel.querySelectorAll(".subpanel").forEach(function (p) {
      p.classList.toggle("active", p.id === "sub-" + b.dataset.sub);
    });
  });
});

// ---------- Tampilkan gambar (dipakai inaWMS dan InaRCM) ----------
// Gambar lama tetap tampil sampai gambar baru selesai dimuat (animasi tidak berkedip).
function showImage(box, path, altText) {
  var token = (box._tok = (box._tok || 0) + 1);
  if (!box.querySelector("img")) box.textContent = "Memuat gambar...";
  var img = new Image();
  img.alt = altText;
  img.onload = function () {
    if (box._tok !== token) return;
    box.textContent = "";
    box.appendChild(makeZoomable(img, altText));
  };
  img.onerror = function () {
    if (box._tok !== token) return;
    box.textContent = "";
    var p = document.createElement("p");
    p.className = "missing";
    p.textContent = "Gambar belum tersedia: " + path;
    box.appendChild(p);
  };
  img.src = encodeURI(path);
}

// Bungkus gambar: klik gambar atau tombol "Perbesar" membuka tampilan zoom / layar penuh.
function makeZoomable(img, title) {
  var wrap = document.createElement("div");
  wrap.className = "imgwrap";
  img.classList.add("zoomable");
  img.tabIndex = 0;
  img.setAttribute("role", "button");
  img.title = "Klik untuk memperbesar";
  var buka = function () { openLightbox(img.currentSrc || img.src, title); };
  img.addEventListener("click", buka);
  img.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); buka(); }
  });
  var b = document.createElement("button");
  b.type = "button"; b.className = "zoom-btn"; b.textContent = "⤢ Perbesar gambar";
  b.addEventListener("click", buka);
  wrap.appendChild(b); wrap.appendChild(img);
  return wrap;
}

// ---------- Zoom dan layar penuh ----------
var lbEl = document.getElementById("lightbox"), lbView = document.getElementById("lb-view");
var lbImg = document.getElementById("lb-img"), lbPct = document.getElementById("lb-pct");
var lbTitle = document.getElementById("lb-title"), lbFullBtn = document.getElementById("lb-full");
var lbS = 1, lbX = 0, lbY = 0, lbFit = 1, lbTouched = false, lbPtrs = {}, lbLastDist = 0, lbFocus = null;

function lbApply() {
  lbImg.style.transform = "translate(" + lbX + "px," + lbY + "px) scale(" + lbS + ")";
  lbPct.textContent = Math.round(lbS / lbFit * 100) + "%";
}
function lbFitNow() {
  var vw = lbView.clientWidth, vh = lbView.clientHeight, nw = lbImg.naturalWidth, nh = lbImg.naturalHeight;
  if (!nw || !vw) return;
  lbFit = Math.min(vw / nw, vh / nh);
  lbS = lbFit; lbX = (vw - nw * lbS) / 2; lbY = (vh - nh * lbS) / 2;
  lbTouched = false; lbApply();
}
function lbZoom(f, cx, cy) {
  if (cx == null) { cx = lbView.clientWidth / 2; cy = lbView.clientHeight / 2; }
  var ns = Math.min(Math.max(lbS * f, lbFit * 0.5), lbFit * 12), k = ns / lbS;
  lbX = cx - (cx - lbX) * k; lbY = cy - (cy - lbY) * k; lbS = ns;
  lbTouched = true; lbApply();
}
function inFullscreen() { return document.fullscreenElement || document.webkitFullscreenElement; }
function openLightbox(src, title) {
  lbFocus = document.activeElement;
  lbTitle.textContent = title || ""; lbImg.alt = title || "";
  lbEl.hidden = false; document.body.style.overflow = "hidden";
  lbImg.onload = lbFitNow;
  lbImg.src = src;
  if (lbImg.complete && lbImg.naturalWidth) lbFitNow();
  document.getElementById("lb-close").focus();
}
function closeLightbox() {
  if (inFullscreen()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); }
  lbEl.hidden = true; document.body.style.overflow = "";
  if (lbFocus && lbFocus.focus) lbFocus.focus();
}
document.getElementById("lb-close").addEventListener("click", closeLightbox);
document.getElementById("lb-in").addEventListener("click", function () { lbZoom(1.3); });
document.getElementById("lb-out").addEventListener("click", function () { lbZoom(1 / 1.3); });
document.getElementById("lb-fit").addEventListener("click", lbFitNow);
if (!(lbEl.requestFullscreen || lbEl.webkitRequestFullscreen)) lbFullBtn.hidden = true;
lbFullBtn.addEventListener("click", function () {
  if (inFullscreen()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  else (lbEl.requestFullscreen || lbEl.webkitRequestFullscreen).call(lbEl);
});
function lbAfterResize() {
  lbFullBtn.textContent = inFullscreen() ? "Keluar layar penuh" : "Layar penuh";
  if (!lbEl.hidden && !lbTouched) lbFitNow();
}
document.addEventListener("fullscreenchange", lbAfterResize);
document.addEventListener("webkitfullscreenchange", lbAfterResize);
window.addEventListener("resize", lbAfterResize);

lbView.addEventListener("wheel", function (e) {
  e.preventDefault();
  var r = lbView.getBoundingClientRect();
  lbZoom(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX - r.left, e.clientY - r.top);
}, { passive: false });
lbView.addEventListener("dblclick", function (e) {
  var r = lbView.getBoundingClientRect();
  if (lbS > lbFit * 1.05) lbFitNow(); else lbZoom(2.5, e.clientX - r.left, e.clientY - r.top);
});
lbView.addEventListener("pointerdown", function (e) {
  lbView.setPointerCapture(e.pointerId);
  lbPtrs[e.pointerId] = { x: e.clientX, y: e.clientY };
  lbView.classList.add("grab"); lbLastDist = 0;
});
lbView.addEventListener("pointermove", function (e) {
  var p = lbPtrs[e.pointerId]; if (!p) return;
  var ids = Object.keys(lbPtrs);
  if (ids.length === 1) {
    lbX += e.clientX - p.x; lbY += e.clientY - p.y; lbTouched = true; lbApply();
    p.x = e.clientX; p.y = e.clientY;
  } else if (ids.length === 2) {
    p.x = e.clientX; p.y = e.clientY;
    var a = lbPtrs[ids[0]], b = lbPtrs[ids[1]], r = lbView.getBoundingClientRect();
    var d = Math.hypot(a.x - b.x, a.y - b.y);
    if (lbLastDist) lbZoom(d / lbLastDist, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
    lbLastDist = d;
  }
});
function lbPtrEnd(e) {
  delete lbPtrs[e.pointerId]; lbLastDist = 0;
  if (!Object.keys(lbPtrs).length) lbView.classList.remove("grab");
}
lbView.addEventListener("pointerup", lbPtrEnd);
lbView.addEventListener("pointercancel", lbPtrEnd);
document.addEventListener("keydown", function (e) {
  if (lbEl.hidden) return;
  if (e.key === "Escape") closeLightbox();
  else if (e.key === "+" || e.key === "=") lbZoom(1.3);
  else if (e.key === "-") lbZoom(1 / 1.3);
  else if (e.key === "0") lbFitNow();
});

// ---------- InaRCM ----------
var rcmForm = document.getElementById("f-rcm");
var rcmInit = document.getElementById("rcm-init");
var rcmLead = document.getElementById("rcm-lead");

function labelBulan(yyyymm, tambah) {
  var y = parseInt(yyyymm.slice(0, 4), 10);
  var m = parseInt(yyyymm.slice(4, 6), 10) - 1 + tambah;
  return BULAN[m % 12] + " " + (y + Math.floor(m / 12));
}

INIT_MONTHS.forEach(function (ym) {
  var o = document.createElement("option");
  o.value = ym;
  o.textContent = labelBulan(ym, 0);
  rcmInit.appendChild(o);
});

function fillLead() {
  var keep = rcmLead.value || "0";
  rcmLead.textContent = "";
  for (var i = 0; i <= 6; i++) {
    var o = document.createElement("option");
    o.value = String(i);
    o.textContent = labelBulan(rcmInit.value, i) + (i === 0 ? " (bulan berjalan)" : "");
    rcmLead.appendChild(o);
  }
  rcmLead.value = keep;
  drawLeadButtons();
}

// garis waktu bulan prakiraan ala Windy: bubble bulan, bilah progres, dan segmen per bulan
var tlBox = document.getElementById("rcm-timeline");
var rcmAvail = [], rcmProbeRun = 0;
function drawLeadButtons() {
  var cur = parseInt(rcmLead.value, 10) || 0, n = rcmLead.options.length;
  var pos = ((cur + 0.5) / n * 100) + "%";
  tlBox.textContent = "";
  var bubble = el("div", "tl-bubble", labelBulan(rcmInit.value, cur));
  bubble.style.left = pos;
  var track = el("div", "tl-track");
  var fill = el("div", "tl-fill");
  fill.style.width = pos;
  track.appendChild(fill);
  var segs = el("div", "tl-segs");
  Array.prototype.forEach.call(rcmLead.options, function (o, i) {
    var na = rcmAvail[i] === false;
    var b = el("button", "tl-seg" + (i === cur ? " on" : "") + (na ? " na" : ""), labelBulan(rcmInit.value, i).slice(0, 3));
    b.type = "button"; b.disabled = na;
    b.title = o.textContent + (na ? " (gambar belum tersedia)" : "");
    b.addEventListener("click", function () { stopRcm(); rcmLead.value = o.value; drawLeadButtons(); renderRcm(); });
    segs.appendChild(b);
  });
  tlBox.appendChild(bubble); tlBox.appendChild(track); tlBox.appendChild(segs);
}

// cek bulan prakiraan mana yang gambarnya ada (yang tidak ada diredupkan)
function probeRcm() {
  var v = Object.fromEntries(new FormData(rcmForm).entries()), run = ++rcmProbeRun;
  rcmAvail = [];
  for (var i = 0; i < 7; i++) (function (k) {
    var im = new Image();
    im.onload = function () { if (run === rcmProbeRun) { rcmAvail[k] = true; drawLeadButtons(); } };
    im.onerror = function () { if (run === rcmProbeRun) { rcmAvail[k] = false; drawLeadButtons(); } };
    im.src = encodeURI("img/inarcm/" + v.init + "/indo20km_" + v.var + "_" + v.tipe + "_" + v.init + "(" + k + ").png");
  })(i);
}

function renderRcm() {
  var v = Object.fromEntries(new FormData(rcmForm).entries());
  // contoh: img/inarcm/202610/indo20km_prec_anomaly_202610(0).png
  var path = "img/inarcm/" + v.init + "/indo20km_" + v.var + "_" + v.tipe + "_" + v.init + "(" + v.lead + ").png";
  showImage(document.getElementById("r-rcm"), path, "InaRCM " + v.var + " " + v.tipe);
}

// ---------- Animasi bulan prakiraan InaRCM ----------
var ICON_PLAY = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
var ICON_PAUSE = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor"/></svg>';
rcmPlay = document.getElementById("rcm-play");
updatePlayBtn(false);
var rcmSpeed = document.getElementById("rcm-speed");
function rcmPath(v, lead) {
  return "img/inarcm/" + v.init + "/indo20km_" + v.var + "_" + v.tipe + "_" + v.init + "(" + lead + ").png";
}
function updatePlayBtn(memuat) {
  if (!rcmPlay) return;
  rcmPlay.disabled = !!memuat;
  rcmPlay.innerHTML = memuat ? '<span class="spin"></span>' : (rcmPlaying ? ICON_PAUSE : ICON_PLAY);
  rcmPlay.setAttribute("aria-pressed", rcmPlaying ? "true" : "false");
  rcmPlay.setAttribute("aria-label", rcmPlaying ? "Jeda animasi" : "Putar animasi");
}
function stopRcm() {
  clearTimeout(rcmTimer); rcmTimer = null;
  rcmRun++; rcmPlaying = false;
  updatePlayBtn(false);
}
function startRcm() {
  clearTimeout(rcmTimer); rcmRun++;
  var run = rcmRun, v = Object.fromEntries(new FormData(rcmForm).entries()), frames = [];
  rcmPlaying = true; updatePlayBtn(true);
  // muat semua bulan prakiraan dulu; bulan yang gambarnya tidak ada dilewati
  var loads = [0, 1, 2, 3, 4, 5, 6].map(function (i) {
    return new Promise(function (done) {
      var im = new Image();
      im.onload = function () { frames.push(i); done(); };
      im.onerror = done;
      im.src = encodeURI(rcmPath(v, i));
    });
  });
  Promise.all(loads).then(function () {
    if (run !== rcmRun) return;
    frames.sort(function (a, b) { return a - b; });
    if (frames.length < 2) { stopRcm(); return; }
    updatePlayBtn(false);
    var pos = Math.max(0, frames.indexOf(parseInt(rcmLead.value, 10)));
    (function tick() {
      if (run !== rcmRun) return;
      rcmLead.value = String(frames[pos]);
      drawLeadButtons(); renderRcm();
      pos = (pos + 1) % frames.length;
      // jeda sedikit lebih lama di akhir sebelum mengulang
      rcmTimer = setTimeout(tick, parseInt(rcmSpeed.value, 10) + (pos === 0 ? 800 : 0));
    })();
  });
}
rcmPlay.addEventListener("click", function () { if (rcmPlaying) stopRcm(); else startRcm(); });

rcmInit.addEventListener("change", fillLead);
rcmForm.addEventListener("change", function (e) {
  if (e.target === rcmSpeed) return;       // kecepatan dipakai pada langkah berikutnya
  probeRcm();
  renderRcm();
  if (rcmPlaying) startRcm();              // ganti variabel/jenis/bulan inisial: animasi dimulai ulang
});
fillLead();
probeRcm();
renderRcm();

// ---------- inaWMS ----------
// Tanggal init yang tersedia (terbaru di depan).
// Hovmöller dan Peta Indonesia: img/inawms/hov/<tanggal>/ dan img/inawms/map/<tanggal>/
var AWMS_DATES = [
  "20261002", "20261003", "20261004", "20261005", "20261006", "20261007", "20261008", "20261009", "20261010",
  "20261011", "20261012", "20261013", "20261014", "20261015", "20261016", "20261017", "20261018", "20261019", "20261020",
  "20261021", "20261022", "20261023", "20261024", "20261025", "20261026", "20261027", "20261028", "20261029", "20261030", "20261031",
  "20261101", "20261102", "20261103", "20261104", "20261105", "20261106", "20261107", "20261108", "20261109", "20261110",
  "20261111", "20261112", "20261113", "20261114", "20261115", "20261116", "20261117"
];
// Time series per kota: img/inawms/kota/<tanggal>/<var>-<Kota>-<N>days_running_mean.png
var KOTA_DATES = ["20261008", "20261009", "20261010", "20261011", "20261012", "20261013", "20261014", "20261015", "20261016", "20261017", "20261018", "20261019", "20261020", "20261021", "20261022", "20261023", "20261024", "20261025", "20261026", "20261027", "20261028", "20261029", "20261030", "20261031", "20261101", "20261102", "20261103", "20261104", "20261105", "20261106", "20261107", "20261108", "20261109", "20261110", "20261111", "20261112", "20261113","20261114", "20261115", "20261116", "20261117" ];

// Daftar kota (nama harus sama dengan nama di file gambar)
var KOTA = [
  ["Sumatera dan Kepulauan Riau", ["Banda Aceh", "Medan", "Padang", "Pekanbaru", "Jambi", "Palembang", "Bengkulu", "Bandar Lampung", "Batam", "Tanjung Pinang"]],
  ["Jawa", ["Serang", "Tangerang", "Jakarta", "Depok", "Bekasi", "Bandung", "Cirebon", "Semarang", "Solo", "Magelang", "Yogyakarta", "Surabaya", "Malang"]],
  ["Kalimantan", ["Pontianak", "Palangka Raya", "Banjarmasin", "Samarinda", "Balikpapan", "Tanjung Selor", "Tarakan"]],
  ["Sulawesi", ["Manado", "Bitung", "Gorontalo", "Palu", "Makassar", "Kendari"]],
  ["Bali dan Nusa Tenggara", ["Denpasar", "Mataram", "Kupang"]],
  ["Maluku", ["Ambon", "Ternate", "Sofifi"]],
  ["Papua", ["Sorong", "Manokwari", "Jayapura"]]
];

// Pita lintang, diurutkan dari UTARA ke SELATAN (sesuai peta bumi).
// [kode file, label, batas utara, batas selatan, hanya untuk variabel (kosong = olr dan pwat)]
var AWMS_BANDS = [
  ["north2", "10N - 20N", 20, 10],
  ["north", "5N - 15N", 15, 5],
  ["n810", "8N - 10N", 10, 8, "olr"],
  ["north1", "5N - 10N", 10, 5, "olr"],
  ["n68", "6N - 8N", 8, 6, "olr"],
  ["n46", "4N - 6N", 6, 4, "olr"],
  ["north0", "0 - 5N", 5, 0, "olr"],
  ["n24", "2N - 4N", 4, 2, "olr"],
  ["n02", "0 - 2N", 2, 0, "olr"],
  ["wide", "15S - 15N", 15, -15],
  ["eqtr", "5S - 5N", 5, -5],
  ["eqtrs2n2", "2S - 2N", 2, -2],
  ["eqtrs1n1", "1S - 1N", 1, -1],
  ["s02", "2S - 0", 0, -2, "olr"],
  ["south0", "5S - 0", 0, -5, "olr"],
  ["s24", "4S - 2S", -2, -4, "olr"],
  ["s46", "6S - 4S", -4, -6, "olr"],
  ["south1", "10S - 5S", -5, -10, "olr"],
  ["south", "15S - 5S", -5, -15],
  ["s68", "8S - 6S", -6, -8, "olr"],
  ["s810", "10S - 8S", -8, -10, "olr"]
];

var awmsForm = document.getElementById("f-awms");
var awmsJenis = document.getElementById("awms-jenis");
var awmsDate = document.getElementById("awms-date");
var awmsVar = document.getElementById("awms-var");
var awmsBand = document.getElementById("awms-band");
var awmsKota = document.getElementById("awms-kota");
var awmsKomponen = document.getElementById("awms-komponen");
var awmsDays = document.getElementById("awms-days");
var awmsWave = document.getElementById("awms-wave");

function labelTanggal(s) {
  return parseInt(s.slice(6, 8), 10) + " " + BULAN[parseInt(s.slice(4, 6), 10) - 1] + " " + s.slice(0, 4);
}

// ---------- Peta lokasi kota dan sebaran komponen ----------
// Batas proyeksi sama dengan viewBox img/peta-indonesia.svg (1000 x 375).
var PETA_BATAS = { lonMin: 94, lonMax: 142, latMax: 6.5, latMin: -11.5 };
var GELOMBANG_URL = {
  olr: "data/gelombang/olr.waves.cfs.kota.json",
  pwat: "data/gelombang/pwat-baru.kota.json"
};
var gelombangCache = {};
var KOMPONEN_NAMA = {
  mjo: "MJO", kelvin: "Gelombang Kelvin", er: "Rossby ekuator (ER)",
  mrgtd: "MRG/TD", low: "LOW", olr: "Total anomali OLR"
};

function muatGelombang(variabel) {
  if (!gelombangCache[variabel]) {
    gelombangCache[variabel] = fetch(GELOMBANG_URL[variabel]).then(function (r) {
      if (!r.ok) throw new Error("Gagal memuat data gelombang");
      return r.json();
    });
  }
  return gelombangCache[variabel];
}

function indeksTanggal(data, iso) {
  var i = data.tanggal.indexOf(iso);
  if (i >= 0) return i;
  var target = Date.parse(iso + "T00:00:00Z"), best = 0, selisih = Infinity;
  data.tanggal.forEach(function (t, j) {
    var d = Math.abs(Date.parse(t + "T00:00:00Z") - target);
    if (d < selisih) { selisih = d; best = j; }
  });
  return best;
}

function fmtNilai(n) {
  return n.toFixed(1).replace("-", "\u2212").replace(".", ",");
}

// t = -1 (kering) sampai 1 (basah)
function warnaNilai(t) {
  t = Math.max(-1, Math.min(1, t));
  var mid = [232, 238, 245], ujung = t < 0 ? [192, 96, 11] : [10, 99, 184];
  var k = Math.abs(t);
  return "rgb(" + Math.round(mid[0] + (ujung[0] - mid[0]) * k) + "," +
    Math.round(mid[1] + (ujung[1] - mid[1]) * k) + "," +
    Math.round(mid[2] + (ujung[2] - mid[2]) * k) + ")";
}

function skalaWarna(nilai) {
  var abs = nilai.map(function (n) { return Math.abs(n); }).sort(function (a, b) { return a - b; });
  var p = abs[Math.min(abs.length - 1, Math.round(abs.length * 0.85))] || 0;
  return Math.max(p, 1e-6);
}

// Total anomali OLR tidak tersedia untuk PWAT, jadi disembunyikan.
function fixKomponen() {
  if (!awmsKomponen) return;
  var o = awmsKomponen.querySelector('option[value="olr"]');
  var pwat = awmsVar.value === "pwat";
  o.hidden = pwat;
  o.disabled = pwat;
  if (pwat && awmsKomponen.value === "olr") awmsKomponen.value = "mjo";
}

function isiPetaKota(kartu, v) {
  var lapis = kartu.querySelector(".peta-titik");
  var meta = kartu.querySelector(".peta-meta");
  var unitEl = kartu.querySelector(".peta-unit");
  var info = kartu.querySelector(".peta-info");
  var komp = KOMPONEN_NAMA[v.komponen] ? v.komponen : "mjo";
  var satuan = v.var === "olr" ? "W m\u207b\u00b2" : "kg m\u207b\u00b2";
  kartu.querySelector(".peta-head b").textContent = "Lokasi kota dan sebaran " + KOMPONEN_NAMA[komp];
  meta.textContent = labelTanggal(v.date);

  muatGelombang(v.var).then(function (data) {
    if (!kartu.isConnected) return;
    var iso = v.date.slice(0, 4) + "-" + v.date.slice(4, 6) + "-" + v.date.slice(6, 8);
    var i = indeksTanggal(data, iso);
    var nama = Object.keys(data.kota);
    var nilai = {}, semua = [];
    nama.forEach(function (n) {
      var arr = data.kota[n][komp] || data.kota[n].mjo;
      var val = arr ? arr[i] : 0;
      nilai[n] = val;
      semua.push(val);
    });

    var skala = skalaWarna(semua);
    var arah = v.var === "olr" ? -1 : 1;   // anomali OLR negatif berarti lebih basah
    unitEl.textContent = "Skala warna \u00b1" + fmtNilai(skala) + " " + satuan;
    lapis.textContent = "";

    nama.forEach(function (n) {
      var c = data.kota[n];
      if (typeof c.lat !== "number" || typeof c.lon !== "number") return;
      var val = nilai[n];
      var b = document.createElement("button");
      b.type = "button";
      b.className = "peta-dot";
      b.style.left = ((c.lon - PETA_BATAS.lonMin) / (PETA_BATAS.lonMax - PETA_BATAS.lonMin) * 100) + "%";
      b.style.top = ((PETA_BATAS.latMax - c.lat) / (PETA_BATAS.latMax - PETA_BATAS.latMin) * 100) + "%";
      b.style.background = warnaNilai(val * arah / skala);
      b.title = n + ": " + fmtNilai(val) + " " + satuan;
      b.setAttribute("aria-label", b.title);
      b.setAttribute("aria-pressed", n === v.kota ? "true" : "false");
      if (n === v.kota) { b.classList.add("on"); b.style.zIndex = "3"; }
      var namaEl = document.createElement("span");
      namaEl.className = "peta-nama";
      namaEl.textContent = n;
      b.appendChild(namaEl);
      b.addEventListener("click", function () {
        awmsKota.value = n;
        renderAwms();
      });
      lapis.appendChild(b);
    });

    var c = data.kota[v.kota];
    if (c) {
      var val = nilai[v.kota];
      var rel = Math.abs(val) / skala < 0.15 ? "mendekati normal" : (val * arah > 0 ? "lebih basah" : "lebih kering");
      info.textContent = v.kota + " \u00b7 " + fmtNilai(Math.abs(c.lat)) + "\u00b0" + (c.lat >= 0 ? "N" : "S") +
        " " + fmtNilai(c.lon) + "\u00b0E \u00b7 " + KOMPONEN_NAMA[komp] + " " + fmtNilai(val) + " " + satuan + " (" + rel + ")";
    }
  }).catch(function () {
    if (kartu.isConnected) lapis.textContent = "Data peta tidak dapat dimuat. Buka halaman lewat server lokal.";
  });
}

function renderKota(v) {
  if (petaZoom.ov) petaTutupZoom();
  var stage = document.getElementById("r-awms");
  stage._tok = (stage._tok || 0) + 1;
  var wrap = document.createElement("div");
  wrap.className = "kota-wrap";

  var kartu = document.createElement("div");
  kartu.className = "peta-kartu";
  kartu.innerHTML =
    '<div class="peta-head"><b>Lokasi kota dan sebaran gelombang</b><span class="peta-meta"></span></div>' +
    '<div class="peta"><div class="peta-benua"></div><div class="peta-titik" role="group" aria-label="Titik kota, klik untuk memilih kota">Memuat peta...</div>' +
    '<button type="button" class="peta-zoom" aria-label="Perbesar peta">\u2922 Perbesar</button></div>' +
    '<div class="peta-kaki"><div class="peta-legend"><span>Kering</span><i></i><span>Basah</span></div><span class="peta-unit"></span></div>' +
    '<p class="peta-info"></p>';
  kartu.querySelector(".peta-zoom").addEventListener("click", function () { petaPerbesar(kartu); });

  var gambar = document.createElement("div");
  gambar.className = "kota-gambar";

  wrap.appendChild(kartu);
  wrap.appendChild(gambar);
  stage.textContent = "";
  stage.appendChild(wrap);

  isiPetaKota(kartu, v);
  showImage(gambar, awmsFile(v), awmsAlt(v));
}

// Peta lokasi kota bisa dibuka layar penuh: kartu pindah ke lapisan penuh,
// gambar time series di bawahnya tetap di tempat.
var petaZoom = { ov: null, kartu: null, induk: null };

function petaPerbesar(kartu) {
  if (petaZoom.ov) { petaTutupZoom(); return; }
  var ov = document.createElement("div");
  ov.className = "peta-overlay";
  ov.setAttribute("role", "dialog");
  ov.setAttribute("aria-modal", "true");
  ov.setAttribute("aria-label", "Peta lokasi kota diperbesar");
  petaZoom.kartu = kartu;
  petaZoom.induk = kartu.parentNode;
  ov.appendChild(kartu);
  document.body.appendChild(ov);
  document.body.classList.add("peta-zoom-on");
  ov.addEventListener("click", function (e) { if (e.target === ov) petaTutupZoom(); });
  document.addEventListener("keydown", petaEsc);
  document.addEventListener("fullscreenchange", petaLayarPenuh);
  document.addEventListener("webkitfullscreenchange", petaLayarPenuh);
  petaZoom.ov = ov;
  kartu.querySelector(".peta-zoom").textContent = "\u2922 Perkecil";
  var minta = ov.requestFullscreen || ov.webkitRequestFullscreen;
  if (minta) {
    var hasil = minta.call(ov);
    if (hasil && hasil.catch) hasil.catch(function () { /* izin ditolak: tetap pakai lapisan penuh */ });
  }
}

function petaTutupZoom() {
  if (!petaZoom.ov) return;
  var ov = petaZoom.ov, kartu = petaZoom.kartu, induk = petaZoom.induk;
  petaZoom.ov = null; petaZoom.kartu = null; petaZoom.induk = null;
  document.removeEventListener("keydown", petaEsc);
  document.removeEventListener("fullscreenchange", petaLayarPenuh);
  document.removeEventListener("webkitfullscreenchange", petaLayarPenuh);
  if (kartu && induk) induk.insertBefore(kartu, induk.firstChild);
  ov.remove();
  document.body.classList.remove("peta-zoom-on");
  var b = kartu && kartu.querySelector(".peta-zoom");
  if (b) b.textContent = "\u2922 Perbesar";
  keluarLayarPenuh();
}

function petaLayarPenuh() {
  if (petaZoom.ov && !(document.fullscreenElement || document.webkitFullscreenElement)) petaTutupZoom();
}

function petaEsc(e) {
  if (e.key === "Escape") petaTutupZoom();
}

function keluarLayarPenuh() {
  if (!(document.fullscreenElement || document.webkitFullscreenElement)) return;
  var keluar = document.exitFullscreen || document.webkitExitFullscreen;
  if (!keluar) return;
  var h = keluar.call(document);
  if (h && h.catch) h.catch(function () {});
}

function fillKota() {
  KOTA.forEach(function (g) {
    var og = document.createElement("optgroup");
    og.label = g[0];
    g[1].forEach(function (k) {
      var o = document.createElement("option");
      o.value = k; o.textContent = k;
      og.appendChild(o);
    });
    awmsKota.appendChild(og);
  });
  awmsKota.value = "Jakarta";
}

function fillDates() {
  var list = awmsJenis.value === "kota" ? KOTA_DATES : AWMS_DATES;
  var keep = awmsDate.value;
  awmsDate.textContent = "";
  list.forEach(function (d) {
    var o = document.createElement("option");
    o.value = d; o.textContent = labelTanggal(d);
    awmsDate.appendChild(o);
  });
  if (list.indexOf(keep) >= 0) {
    awmsDate.value = keep;
  } else if (list.length) {
    awmsDate.value = list[list.length - 1];
  }
}

// pita lintang dikelompokkan: utara, melintasi ekuator, selatan (masing-masing urut utara ke selatan)
function fillBands() {
  var keep = awmsBand.value || "eqtr";
  awmsBand.textContent = "";
  var grup = {
    utara: document.createElement("optgroup"),
    ekuator: document.createElement("optgroup"),
    selatan: document.createElement("optgroup")
  };
  grup.utara.label = "Belahan utara";
  grup.ekuator.label = "Melintasi ekuator";
  grup.selatan.label = "Belahan selatan";
  AWMS_BANDS.forEach(function (b) {
    if (b[4] && b[4] !== awmsVar.value) return;
    var o = document.createElement("option");
    o.value = b[0]; o.textContent = b[1];
    var g = b[2] <= 0 ? "selatan" : (b[3] < 0 ? "ekuator" : "utara");
    grup[g].appendChild(o);
  });
  ["utara", "ekuator", "selatan"].forEach(function (k) {
    if (grup[k].children.length) awmsBand.appendChild(grup[k]);
  });
  awmsBand.value = keep;
  if (!awmsBand.value) awmsBand.value = "eqtr";
}

// pilihan rata-rata hari: peta 5 panel tanpa 10 hari; time series kota hanya 1, 3, 7, 10 hari
function fixDays() {
  var off = {};
  if (awmsJenis.value === "kota") { off["2"] = true; off["5"] = true; }
  if (awmsJenis.value === "map" && awmsWave.value === "all1") off["10"] = true;
  Array.prototype.forEach.call(awmsDays.options, function (o) { o.disabled = !!off[o.value]; });
  if (awmsDays.options[awmsDays.selectedIndex].disabled) awmsDays.value = "7";
}

// tampilkan hanya kolom yang dipakai jenis terpilih
function toggleFields() {
  awmsForm.querySelectorAll("[data-for]").forEach(function (l) {
    l.hidden = l.dataset.for.split(" ").indexOf(awmsJenis.value) < 0;
  });
}

function awmsFile(v) {
  if (v.jenis === "hov") {
    // contoh: img/inawms/hov/20261006/olr.cfs.eqtr.png
    return "img/inawms/hov/" + v.date + "/" + v.var + ".cfs." + v.band + ".png";
  }
  if (v.jenis === "kota") {
    // contoh: img/inawms/kota/20261011/olr-Jakarta-3days_running_mean.png
    return "img/inawms/kota/" + v.date + "/" + v.var + "-" + v.kota + "-" + v.days + "days_running_mean.png";
  }
  // contoh: img/inawms/map/20261006/olr.cfs.all.indonesia.7.png
  return "img/inawms/map/" + v.date + "/" + v.var + ".cfs." + v.wave + ".indonesia." + v.days + ".png";
}

function awmsAlt(v) {
  var nama = v.var === "olr" ? "OLR" : "Precipitable water";
  if (v.jenis === "kota") return "inaWMS time series " + nama + " " + v.kota + ", rata-rata " + v.days + " hari, " + labelTanggal(v.date);
  return "inaWMS " + (v.jenis === "hov" ? "Hovmöller" : "Peta Indonesia") + " " + nama + " " + labelTanggal(v.date);
}

function renderAwms() {
  awmsForm.dataset.jenis = awmsJenis.value;
  if (awmsJenis.value === "peta") {
    // peta gelombang interaktif: halaman terpisah (peta-gelombang.html), data dari data/peta/
    var kotak = document.getElementById("r-awms");
    document.getElementById("awms-note").textContent = "Peta interaktif OLR dan PWAT harian dengan kontur MJO, Kelvin, ER, MRG/TD, dan LOW. Klik peta untuk membaca nilai, geser slider untuk berpindah tanggal, dan gunakan tombol layar penuh untuk tampilan sebesar PSIMKG.";
    if (!kotak.querySelector("iframe.peta-frame")) {
      kotak._tok = (kotak._tok || 0) + 1;   // batalkan pemuatan gambar yang masih berjalan
      kotak.textContent = "";
      var fr = document.createElement("iframe");
      fr.src = "peta-gelombang.html?v=12";
      fr.className = "peta-frame";
      fr.title = "Peta gelombang atmosfer inaWMS";
      fr.setAttribute("allow", "fullscreen");
      kotak.appendChild(fr);
    }
    return;
  }
  if (awmsJenis.value === "interaktif") {
    // grafik interaktif: halaman terpisah (grafik-kota-gelombang.html), data dari data/gelombang/
    var kotak = document.getElementById("r-awms");
    document.getElementById("awms-note").textContent = "Grafik harian OLR dan PWAT untuk 45 kota: pilih komponen gelombang, rentang waktu, dan bandingkan dua kota.";
    if (kotak.querySelector("iframe.peta-frame")) kotak.textContent = "";
    if (!kotak.querySelector("iframe")) {
      kotak._tok = (kotak._tok || 0) + 1;   // batalkan pemuatan gambar yang masih berjalan
      kotak.textContent = "";
      var fr = document.createElement("iframe");
      fr.src = "grafik-kota-gelombang.html";
      fr.title = "Grafik interaktif gelombang atmosfer per kota";
      kotak.appendChild(fr);
    }
    return;
  }
  var v = Object.fromEntries(new FormData(awmsForm).entries());
  var note = document.getElementById("awms-note");
    if (v.jenis === "kota") {
    note.textContent = "Time series per kota: panel LOW, MJO, ER, Kelvin, MRG/TD, serta anomali dan total gelombang. Pilih kota, tanggal, dan rata-rata pada kolom di atas.";
    showImage(document.getElementById("r-awms"), awmsFile(v), awmsAlt(v));
    return;
  }
  note.textContent = "";
  showImage(document.getElementById("r-awms"), awmsFile(v), awmsAlt(v));
}

function awmsJenisBerubah() {
  if (petaZoom.ov) petaTutupZoom();
  fillDates();
  fixDays();
  fixKomponen();
  toggleFields();
}

// Panel inaWMS baru dimuat saat pertama kali dibuka.
var awmsBelum = true;
function tampilkanAwms(nama) {
  if (nama !== "inawms" || !awmsForm || !awmsBelum) return;
  awmsBelum = false;
  renderAwms();
}

awmsJenis.addEventListener("change", awmsJenisBerubah);
awmsVar.addEventListener("change", function () { fillBands(); fixKomponen(); });
awmsWave.addEventListener("change", fixDays);
awmsForm.addEventListener("change", renderAwms);
fillBands();
fillKota();
awmsJenisBerubah();
if (document.getElementById("inawms").classList.contains("active")) {
  awmsBelum = false;
  renderAwms();
}

// ---------- Info BMKG: gempa ----------
var BMKG_WORKER = "https://bmkg-proxy.nailaputri26605.workers.dev";
var TEWS = BMKG_WORKER ? BMKG_WORKER + "/gempa/" : "https://data.bmkg.go.id/DataMKG/TEWS/";

function gagal(box) {
  box.textContent = "Data belum bisa dimuat. Buka langsung di ";
  var a = document.createElement("a");
  a.href = "https://www.bmkg.go.id/gempabumi/gempabumi-terkini";
  a.target = "_blank"; a.rel = "noopener";
  a.textContent = "situs BMKG";
  box.appendChild(a);
  box.appendChild(document.createTextNode("."));
}

function baris(label, nilai) {
  var p = document.createElement("p");
  p.style.margin = "2px 0";
  var b = document.createElement("strong");
  b.textContent = label + ": ";
  p.appendChild(b);
  p.appendChild(document.createTextNode(nilai));
  return p;
}

// ---------- Kumpulan gempa dengan koordinat (untuk jarak dari lokasi pengguna) ----------
// Format koordinat BMKG: "7.08 LS" / "2.90 LU" dan "130.07 BT" / "95.20 BB"
var GEOMPA = [];
function parseKoordinat(lintang, bujur) {
  var la = /^([\d.]+)\s*(LU|LS)$/i.exec(lintang || "");
  var lo = /^([\d.]+)\s*(BT|BB)$/i.exec(bujur || "");
  if (!la || !lo) return null;
  var lat = parseFloat(la[1]) * (/ls/i.test(la[2]) ? -1 : 1);
  var lon = parseFloat(lo[1]) * (/bb/i.test(lo[2]) ? -1 : 1);
  if (isNaN(lat) || isNaN(lon)) return null;
  return { lat: lat, lon: lon };
}
function tambahGempa(g, sumber) {
  var k = parseKoordinat(g.Lintang, g.Bujur);
  if (!k) return;
  GEOMPA.push({
    lat: k.lat, lon: k.lon, mag: parseFloat(g.Magnitude) || 0,
    waktu: (g.Tanggal || "") + (g.Jam ? ", " + g.Jam : ""),
    wilayah: g.Wilayah || "-", kedalaman: g.Kedalaman || "-",
    dirasakan: g.Dirasakan || "", sumber: sumber
  });
}
// jarak haversine dalam kilometer
function jarakKm(lat1, lon1, lat2, lon2) {
  var R = 6371, dLa = (lat2 - lat1) * Math.PI / 180, dLo = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLa / 2) * Math.sin(dLa / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
var ARAH = ["utara", "timur laut", "timur", "tenggara", "selatan", "barat daya", "barat", "barat laut"];
function arahDari(lat1, lon1, lat2, lon2) {
  var dLo = (lon2 - lon1) * Math.PI / 180;
  var y = Math.sin(dLo) * Math.cos(lat2 * Math.PI / 180);
  var x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
    Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLo);
  var derajat = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  return ARAH[Math.round(derajat / 45) % 8];
}

// ---------- Lokasi pengguna & peringatan gempa terdekat ----------
var lokasiAku = null;          // {lat, lon, akurasi, nama}
var RADIUS_WASPADA = 200;      // km: gempa di dalam radius ini dianggap "dekat"
var lokasiBtn = document.getElementById("lokasi-btn");
var lokasiStatus = document.getElementById("lokasi-status");
var lokasiManual = document.getElementById("lokasi-manual");
var gempaDekat = document.getElementById("gempa-dekat");

function fmtKoordinat(lat, lon) {
  return Math.abs(lat).toFixed(2) + "°" + (lat >= 0 ? "LU" : "LS") + ", " +
    Math.abs(lon).toFixed(2) + "°" + (lon >= 0 ? "BT" : "BB");
}
function setLokasi(lat, lon, akurasi, nama) {
  lokasiAku = { lat: lat, lon: lon };
  if (lokasiStatus) {
    lokasiStatus.textContent = (nama || "Lokasi Anda") + ": " + fmtKoordinat(lat, lon) +
      (akurasi ? " (akurasi ±" + Math.round(akurasi / 100) / 10 + " km)" : "");
  }
  renderGempaDekat();
}
function renderGempaDekat() {
  if (!gempaDekat || !lokasiAku) return;
  gempaDekat.textContent = "";
  if (!GEOMPA.length) {
    gempaDekat.appendChild(el("p", "note", "Data gempa belum termuat, peringatan jarak akan muncul setelah data BMKG terbaca."));
    return;
  }
  var denganJarak = GEOMPA.map(function (g) {
    return { g: g, km: jarakKm(lokasiAku.lat, lokasiAku.lon, g.lat, g.lon) };
  }).sort(function (a, b) { return a.km - b.km; });
  var dekat = denganJarak.filter(function (d) { return d.km <= RADIUS_WASPADA; });

  if (dekat.length) {
    var w = el("div", "warn-item");
    w.style.borderLeftColor = "#c0392b";
    w.appendChild(el("strong", null, "⚠️ " + dekat.length + " gempa dalam radius " + RADIUS_WASPADA + " km dari lokasi Anda"));
    dekat.slice(0, 3).forEach(function (d) {
      w.appendChild(el("p", null, "M " + d.g.mag + " · " + Math.round(d.km) + " km ke " + arahDari(lokasiAku.lat, lokasiAku.lon, d.g.lat, d.g.lon) +
        " · " + d.g.wilayah + (d.g.dirasakan ? " · dirasakan " + d.g.dirasakan : "")));
    });
    gempaDekat.appendChild(w);
  } else {
    var aman = el("div", "warn-item");
    aman.style.borderLeftColor = "#2e9a4d";
    aman.appendChild(el("p", null, "✅ Tidak ada gempa tercatat dalam radius " + RADIUS_WASPADA + " km dari lokasi Anda (data BMKG terbaru)."));
    gempaDekat.appendChild(aman);
  }
  var t = el("p", "note", "Gempa terdekat: M " + denganJarak[0].g.mag + " · " + Math.round(denganJarak[0].km) +
    " km ke " + arahDari(lokasiAku.lat, lokasiAku.lon, denganJarak[0].g.lat, denganJarak[0].g.lon) +
    " · " + denganJarak[0].g.wilayah + " (" + denganJarak[0].g.waktu + ").");
  gempaDekat.appendChild(t);
}
if (lokasiBtn) {
  lokasiBtn.addEventListener("click", function () {
    if (!navigator.geolocation) {
      lokasiStatus.textContent = "Browser tidak mendukung geolokasi. Silakan isi koordinat manual di bawah.";
      lokasiManual.hidden = false;
      return;
    }
    lokasiStatus.textContent = "Meminta izin lokasi ke browser...";
    navigator.geolocation.getCurrentPosition(
      function (pos) { setLokasi(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, "Lokasi Anda"); },
      function (err) {
        lokasiStatus.textContent = "Izin lokasi ditolak atau gagal (" + err.message + "). Silakan isi koordinat manual di bawah.";
        lokasiManual.hidden = false;
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  });
  var manualBtn = document.getElementById("lokasi-manual-btn");
  if (manualBtn) manualBtn.addEventListener("click", function () {
    var la = parseFloat(document.getElementById("lat-manual").value);
    var lo = parseFloat(document.getElementById("lon-manual").value);
    if (isNaN(la) || isNaN(lo) || la < -11 || la > 6 || lo < 94 || lo > 142) {
      lokasiStatus.textContent = "Koordinat tidak valid. Gunakan rentang lintang −11 sampai 6 dan bujur 94 sampai 142 (wilayah Indonesia).";
      return;
    }
    setLokasi(la, lo, null, "Lokasi manual");
  });
}

getJSON(TEWS + "autogempa.json", "autogempa")
  .then(function (d) {
    var g = d.Infogempa.gempa;
    tambahGempa(g, "autogempa");
    renderGempaDekat();
    var box = document.getElementById("gempa-terkini");
    box.textContent = "";
    var grid = document.createElement("div");
    grid.className = "gempa-grid" + (g.Shakemap ? " with-map" : "");
    var kiri = document.createElement("div");
    var mag = document.createElement("div");
    mag.className = "gempa-mag";
    mag.textContent = "M " + g.Magnitude;
    kiri.appendChild(mag);
    kiri.appendChild(baris("Waktu", g.Tanggal + ", " + g.Jam));
    kiri.appendChild(baris("Lokasi", g.Wilayah));
    kiri.appendChild(baris("Kedalaman", g.Kedalaman));
    kiri.appendChild(baris("Koordinat", g.Lintang + ", " + g.Bujur));
    var tsu = el("div", "warn-item");
    tsu.style.marginTop = "10px";
    if (/tidak/i.test(g.Potensi)) tsu.style.borderLeftColor = "#2e9a4d";
    tsu.appendChild(el("p", null, "🌊 Potensi tsunami: " + g.Potensi));
    kiri.appendChild(tsu);
    if (g.Dirasakan) kiri.appendChild(baris("Dirasakan", g.Dirasakan));
    grid.appendChild(kiri);
    if (g.Shakemap) {
      var img = new Image();
      img.alt = "Shakemap gempa terkini";
      img.src = "https://data.bmkg.go.id/DataMKG/TEWS/" + g.Shakemap;
      grid.appendChild(makeZoomable(img, "Shakemap gempa terkini"));
    }
    box.appendChild(grid);
  })
  .catch(function () { gagal(document.getElementById("gempa-terkini")); });

getJSON(TEWS + "gempadirasakan.json", "gempadirasakan")
  .then(function (d) {
    var box = document.getElementById("gempa-dirasakan");
    box.textContent = "";
    var t = document.createElement("table");
    var head = t.createTHead().insertRow();
    ["Waktu", "M", "Kedalaman", "Wilayah", "Dirasakan"].forEach(function (h) {
      var th = document.createElement("th"); th.textContent = h; head.appendChild(th);
    });
    var body = t.createTBody();
    d.Infogempa.gempa.forEach(function (g) {
      tambahGempa(g, "dirasakan");
      var r = body.insertRow();
      [g.Tanggal + " " + g.Jam, g.Magnitude, g.Kedalaman, g.Wilayah, g.Dirasakan || "-"].forEach(function (x) {
        r.insertCell().textContent = x;
      });
    });
    renderGempaDekat();
    box.appendChild(t);
  })
  .catch(function () { gagal(document.getElementById("gempa-dirasakan")); });

getJSON(TEWS + "gempaterkini.json", "gempaterkini")
  .then(function (d) {
    var box = document.getElementById("gempa-list");
    box.textContent = "";
    var t = document.createElement("table");
    var head = t.createTHead().insertRow();
    ["Waktu", "M", "Kedalaman", "Wilayah"].forEach(function (h) {
      var th = document.createElement("th"); th.textContent = h; head.appendChild(th);
    });
    var body = t.createTBody();
    d.Infogempa.gempa.forEach(function (g) {
      tambahGempa(g, "terkini");
      var r = body.insertRow();
      [g.Tanggal + " " + g.Jam, g.Magnitude, g.Kedalaman, g.Wilayah].forEach(function (x) {
        r.insertCell().textContent = x;
      });
    });
    renderGempaDekat();
    box.appendChild(t);
  })
  .catch(function () { gagal(document.getElementById("gempa-list")); });


// ============================================================
// Info BMKG: cuaca dan peringatan dini
// Dibaca dari data/cuaca.json dan data/peringatan.json
// (dibuat otomatis oleh skrip terjadwal dari data terbuka BMKG)
// ============================================================
function getJSON(url, key) {
  if (window.PREVIEW_DATA && window.PREVIEW_DATA[key]) return Promise.resolve(window.PREVIEW_DATA[key]);
  return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
}
function el(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function fmtUpdated(iso) { return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }); }
function jamLalu(iso) { return (Date.now() - new Date(iso).getTime()) / 36e5; }
function infoDiperbarui(iso, batasJam) {
  var p = el("p", "note", "Diperbarui: " + fmtUpdated(iso) + ". Sumber: BMKG.");
  if (jamLalu(iso) > batasJam) {
    p.appendChild(el("span", "stale", " Data sudah lama, mungkin belum diperbarui."));
  }
  return p;
}

var IKON = [["petir", "\u26C8\uFE0F"], ["hujan lebat", "\uD83C\uDF27\uFE0F"], ["hujan", "\uD83C\uDF26\uFE0F"],
  ["kabut", "\uD83C\uDF2B\uFE0F"], ["asap", "\uD83C\uDF2B\uFE0F"], ["cerah berawan", "\uD83C\uDF24\uFE0F"],
  ["berawan tebal", "\u2601\uFE0F"], ["berawan", "\u26C5"], ["cerah", "\u2600\uFE0F"]];
function ikon(desc) {
  var d = (desc || "").toLowerCase();
  for (var i = 0; i < IKON.length; i++) if (d.indexOf(IKON[i][0]) >= 0) return IKON[i][1];
  return "\uD83C\uDF21\uFE0F";
}

// ---------- Cuaca: seluruh wilayah Indonesia ----------
// Daftar kode wilayah administrasi (Kemendagri 2022) dalam CSV.
// Utamakan file lokal jika tersedia; jika belum ada, ambil dari repositori publik.
var WILAYAH_SQL_LOCAL = "data/wilayah/wilayah.sql";
var WILAYAH_CSV_LOCAL = "data/wilayah/wilayah.csv";
var WILAYAH_DATA_REMOTE = "https://raw.githubusercontent.com/stievenk/data-wilayah-indonesia/master/db/wilayah.sql";
// Jika API cuaca langsung terkena CORS, isi URL worker milikmu, misalnya:
// var CUACA_API = "https://NAMA-WORKER.NAMA-AKUN.workers.dev/cuaca?adm4=";
var CUACA_API = BMKG_WORKER ? BMKG_WORKER + "/cuaca?adm4=" : "https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=";
var WILAYAH = "data/wilayah/";

function loadJSON(url) {
  return fetch(url).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
}
var cuacaHari = 0, cuacaData = null;
var cJudul = document.getElementById("cuaca-judul"), cHari = document.getElementById("cuaca-hari");
var cSlot = document.getElementById("cuaca-slot"), cInfo = document.getElementById("cuaca-info");

function chipBtn(teks, on, fn) {
  var b = el("button", "chip" + (on ? " on" : ""), teks);
  b.type = "button"; b.addEventListener("click", fn); return b;
}
function setText(id, t) { document.getElementById(id).textContent = t; }
function rata(items, k) {
  var v = items.map(function (p) { return parseFloat(p[k]); }).filter(function (x) { return !isNaN(x); });
  return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null;
}
function fmt1(x, sat) { return x == null ? "-" : (Math.round(x * 10) / 10).toFixed(1) + sat; }
function pilihSlot(items, hariPertama) {
  var best = items[0];
  if (hariPertama) {
    var now = Date.now(), bd = Infinity;
    items.forEach(function (p) {
      var t = p.utc ? new Date(p.utc.replace(" ", "T") + "Z").getTime() : NaN;
      var d = Math.abs(t - now);
      if (d < bd) { bd = d; best = p; }
    });
  } else best = items[Math.min(4, items.length - 1)];
  return best;
}
function gambarCuaca() {
  var hs = cuacaData.hari;
  if (cuacaHari >= hs.length) cuacaHari = 0;
  cHari.textContent = ""; cSlot.textContent = "";
  hs.forEach(function (h, i) {
    var lbl = new Date(h.tgl + "T00:00:00").toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
    cHari.appendChild(chipBtn(lbl, i === cuacaHari, function () { cuacaHari = i; gambarCuaca(); }));
  });
  var items = hs[cuacaHari].items;
  items.forEach(function (p) {
    var s = el("div", "slot");
    s.appendChild(el("div", "jam", (p.waktu || "").slice(11, 16)));
    s.appendChild(el("div", "ikon", ikon(p.cuaca)));
    s.appendChild(el("div", "suhu", p.t + "°C"));
    s.appendChild(el("div", "desc", p.cuaca || "Kondisi tidak tersedia"));
    s.appendChild(el("div", "meta", "Lembap " + (p.hu || "-") + "%"));
    s.appendChild(el("div", "meta", "Angin " + (p.ws || "-") + " km/j " + (p.wd || "")));
    cSlot.appendChild(s);
  });
  var hujan = items.map(function (p) { return parseFloat(p.tp); }).filter(function (x) { return !isNaN(x); });
  setText("st-suhu", fmt1(rata(items, "t"), " °C"));
  setText("st-hu", fmt1(rata(items, "hu"), " %"));
  setText("st-angin", fmt1(rata(items, "ws"), " km/jam"));
  setText("st-hujan", hujan.length ? fmt1(hujan.reduce(function (a, b) { return a + b; }, 0), " mm") : "-");
  var p = pilihSlot(items, cuacaHari === 0), big = document.getElementById("cuaca-besar");
  big.textContent = "";
  big.appendChild(el("div", "big-ikon", ikon(p.cuaca)));
  var tx = el("div", "big-teks");
  tx.appendChild(el("h3", null, p.cuaca || "Kondisi tidak tersedia"));
  tx.appendChild(el("p", null, cJudul.textContent));
  tx.appendChild(el("p", null, "Pukul " + (p.waktu || "").slice(11, 16) + " • Lembap " + (p.hu || "-") + "% • Angin " + (p.ws || "-") + " km/j " + (p.wd || "")));
  big.appendChild(tx); big.appendChild(el("div", "big-suhu", p.t + "°"));
}
function ambilCuaca(kode, nama) {
  cJudul.textContent = nama; cHari.textContent = ""; cInfo.textContent = "";
  cSlot.textContent = "Memuat prakiraan cuaca BMKG...";
  document.getElementById("cuaca-besar").textContent = "";
  ["st-suhu", "st-hu", "st-angin", "st-hujan"].forEach(function (id) { setText(id, "-"); });
  setText("cuaca-badge", "● Memuat");
  try { localStorage.setItem("cuaca-terakhir", JSON.stringify({ kode: kode, nama: nama })); } catch (e) {}
  fetch(CUACA_API + encodeURIComponent(kode))
    .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(function (j) {
      var blok = j.data && j.data[0], arr = [].concat.apply([], (blok && blok.cuaca) || []);
      if (!arr.length) throw new Error("Data prakiraan kosong");
      var m = {}, hari = [];
      arr.forEach(function (x) {
        var w = x.local_datetime || "", t = w.slice(0, 10);
        if (!m[t]) { m[t] = { tgl: t, items: [] }; hari.push(m[t]); }
        m[t].items.push({ waktu: w, utc: x.utc_datetime, t: x.t, hu: x.hu, cuaca: x.weather_desc, ws: x.ws, wd: x.wd, tp: x.tp });
      });
      cuacaData = { hari: hari }; cuacaHari = 0; gambarCuaca();
      setText("cuaca-badge", "● Data BMKG");
      cInfo.textContent = "Prakiraan resmi BMKG. Data diperbarui berkala. Sumber: BMKG.";
    })
    .catch(function () {
      cSlot.textContent = "Prakiraan belum bisa dimuat. Periksa koneksi internet atau konfigurasi CORS API.";
      setText("cuaca-badge", "● Gagal memuat");
      cInfo.textContent = "Sumber data: BMKG. Jika error Failed to fetch, gunakan Cloudflare Worker pada alat/worker.js.";
    });
}

// Baca CSV dua kolom: kode wilayah,nama wilayah. Dibentuk menjadi pilihan bertingkat.
var sProv = document.getElementById("w-prov"), sKab = document.getElementById("w-kab");
var sKec = document.getElementById("w-kec"), sKel = document.getElementById("w-kel");
var regionChildren = {}, regionNames = {}, regionLevel = {}, regionsReady = false;
function parseWilayahCSV(text) {
  text = text.replace(/^\uFEFF/, "");
  var rows = [], sqlPattern = /\('([0-9.]+)'\s*,\s*'((?:[^'\\]|''|\\.)*)'\)/g, match;
  // Mendukung dump SQL Kemendagri 2025 dan CSV dua kolom.
  while ((match = sqlPattern.exec(text)) !== null) rows.push([match[1], match[2].replace(/''/g, "'").replace(/\\'/g, "'")]);
  if (!rows.length) text.split(/\r?\n/).forEach(function (line) {
    if (!line.trim()) return;
    var comma = line.indexOf(","); if (comma < 1) return;
    rows.push([line.slice(0, comma).trim(), line.slice(comma + 1).trim().replace(/^"|"$/g, "")]);
  });
  rows.forEach(function (row) {
    var code = row[0], name = row[1];
    if (!/^\d{2}(\.\d{2}){0,2}(\.\d{4})?$/.test(code) || !name) return;
    var level = code.split(".").length - 1;
    regionNames[code] = name; regionLevel[code] = level;
    if (level > 0) {
      var parent = code.substring(0, code.lastIndexOf("."));
      if (!regionChildren[parent]) regionChildren[parent] = [];
      regionChildren[parent].push([code, name]);
    }
  });
  Object.keys(regionChildren).forEach(function (k) {
    regionChildren[k].sort(function (a, b) { return a[1].localeCompare(b[1], "id"); });
  });
  var provinces = Object.keys(regionNames).filter(function (k) { return regionLevel[k] === 0; }).map(function (k) { return [k, regionNames[k]]; });
  provinces.sort(function (a, b) { return a[1].localeCompare(b[1], "id"); });
  if (provinces.length < 30) throw new Error("Daftar wilayah belum lengkap");
  return provinces;
}
function isiSel(sel, items, judul) {
  sel.textContent = "";
  var o = el("option", null, judul); o.value = ""; sel.appendChild(o);
  items.forEach(function (x) { var op = el("option", null, x[1]); op.value = x[0]; sel.appendChild(op); });
  sel.disabled = items.length === 0;
}
function kosongkan(sels) { sels.forEach(function (s) { isiSel(s, [], s.getAttribute("aria-label")); }); }
function pilihKelurahan() {
  if (!sKel.value) return;
  var nama = sKel.options[sKel.selectedIndex].text + ", " + sKec.options[sKec.selectedIndex].text +
    ", " + sKab.options[sKab.selectedIndex].text + ", " + sProv.options[sProv.selectedIndex].text;
  ambilCuaca(sKel.value, nama);
}
function aktifkanWilayah(provinces) {
  isiSel(sProv, provinces, "Pilih provinsi");
  kosongkan([sKab, sKec, sKel]);
  sProv.addEventListener("change", function () {
    kosongkan([sKec, sKel]);
    isiSel(sKab, regionChildren[sProv.value] || [], "Pilih kabupaten/kota");
  });
  sKab.addEventListener("change", function () {
    kosongkan([sKel]);
    isiSel(sKec, regionChildren[sKab.value] || [], "Pilih kecamatan");
  });
  sKec.addEventListener("change", function () {
    isiSel(sKel, regionChildren[sKec.value] || [], "Pilih kelurahan/desa");
  });
  sKel.addEventListener("change", pilihKelurahan);
  regionsReady = true;
  var note = document.getElementById("wilayah-info");
  if (note) note.textContent = "Daftar wilayah administrasi Indonesia berhasil dimuat.";
}
function muatWilayah() {
  fetch(WILAYAH_SQL_LOCAL).then(function (r) {
    if (!r.ok) throw new Error("SQL lokal belum ada"); return r.text();
  }).catch(function () {
    return fetch(WILAYAH_CSV_LOCAL).then(function (r) {
      if (!r.ok) throw new Error("CSV lokal belum ada"); return r.text();
    });
  }).catch(function () {
    return fetch(WILAYAH_DATA_REMOTE).then(function (r) { if (!r.ok) throw new Error("Data wilayah gagal dimuat"); return r.text(); });
  }).then(function (dataWilayah) {
    aktifkanWilayah(parseWilayahCSV(dataWilayah));
  }).catch(function () {
    // Fallback aman: wilayah contoh yang sudah ikut di ZIP, dengan keterangan jelas.
    loadJSON(WILAYAH + "provinsi.json").then(function (prov) {
      isiSel(sProv, prov, "Pilih provinsi"); kosongkan([sKab, sKec, sKel]);
      sProv.addEventListener("change", function () {
        kosongkan([sKab, sKec, sKel]);
        loadJSON(WILAYAH + sProv.value + ".json").then(function (d) {
          window._wilayahFallback = d; isiSel(sKab, d.kab || [], "Pilih kabupaten/kota");
        });
      });
      sKab.addEventListener("change", function () { kosongkan([sKec, sKel]); isiSel(sKec, (window._wilayahFallback.kec || {})[sKab.value] || [], "Pilih kecamatan"); });
      sKec.addEventListener("change", function () { isiSel(sKel, (window._wilayahFallback.kel || {})[sKec.value] || [], "Pilih kelurahan/desa"); });
      sKel.addEventListener("change", pilihKelurahan);
      var note = document.getElementById("wilayah-info");
      if (note) note.textContent = "Daftar wilayah lengkap gagal dimuat. Saat ini hanya data contoh yang tersedia. Periksa internet atau letakkan wilayah.csv di data/wilayah/.";
    }).catch(function () {
      cSlot.textContent = "Daftar wilayah tidak dapat dimuat. Periksa koneksi internet.";
    });
  });
}
muatWilayah();

// Ingat lokasi terakhir pengunjung
try {
  var terakhir = JSON.parse(localStorage.getItem("cuaca-terakhir") || "null");
  if (terakhir && terakhir.kode) ambilCuaca(terakhir.kode, terakhir.nama);
} catch (e) {}

// ---------- Peringatan dini: RSS resmi BMKG (XML) ----------
var PERINGATAN_URL = BMKG_WORKER ? BMKG_WORKER + "/peringatan" : "https://www.bmkg.go.id/alerts/nowcast/id";
function xmlText(node, tag) {
  var found = node.getElementsByTagName(tag);
  return found.length ? (found[0].textContent || "").trim() : "";
}
fetch(PERINGATAN_URL).then(function (r) {
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.text();
}).then(function (xml) {
  var doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("Format RSS tidak valid");
  var items = Array.prototype.slice.call(doc.getElementsByTagName("item"));
  var box = document.getElementById("peringatan");
  box.textContent = "";
  if (!items.length) {
    box.appendChild(el("p", null, "Tidak ada peringatan dini cuaca aktif yang tercantum di RSS BMKG saat ini."));
  }
  items.forEach(function (item) {
    var c = el("div", "warn-item");
    var title = xmlText(item, "title") || "Peringatan dini cuaca BMKG";
    var desc = xmlText(item, "description");
    var date = xmlText(item, "pubDate");
    var link = xmlText(item, "link");
    c.appendChild(el("strong", null, title));
    if (desc) c.appendChild(el("p", null, desc.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()));
    if (date) c.appendChild(el("p", "note", "Dipublikasikan: " + date));
    if (link && /^https:\/\//i.test(link)) {
      var a = el("a", null, "Lihat detail resmi BMKG"); a.href = link; a.target = "_blank"; a.rel = "noopener noreferrer";
      c.appendChild(a);
    }
    box.appendChild(c);
  });
  box.appendChild(el("p", "note", "Sumber: BMKG — Peringatan Dini Cuaca. Data dapat berubah sewaktu-waktu."));
}).catch(function () {
  var box = document.getElementById("peringatan"); box.textContent = "Peringatan dini tidak dapat dimuat langsung dari browser (kemungkinan CORS atau koneksi). ";
  var a = el("a", null, "Buka peringatan resmi BMKG"); a.href = "https://www.bmkg.go.id/alerts/nowcast/id"; a.target = "_blank"; a.rel = "noopener noreferrer"; box.appendChild(a);
  });
