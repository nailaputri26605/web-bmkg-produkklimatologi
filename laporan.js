// Fitur cetak halaman dan unduh Excel untuk sub-tab Info BMKG.
// Dimuat SETELAH script.js (memakai variabel global cuacaData dari script.js).
(function () {
  var SUMBER = "Sumber data: BMKG (data.bmkg.go.id dan bmkg.go.id)";

  function sekarang() { return new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" }); }
  function bersih(t) { return (t == null ? "" : String(t)).replace(/\s+/g, " ").trim(); }
  function angka(v) { return /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v; }
  function teks(x) { return x == null ? "" : String(x); }

  // ---------- Ambil data menjadi baris-baris (baris pertama = judul kolom) ----------
  function tabelKeBaris(box) {
    var t = box && box.querySelector("table");
    if (!t) return null;
    return Array.prototype.map.call(t.rows, function (r, i) {
      return Array.prototype.map.call(r.cells, function (c) { var s = bersih(c.textContent); return i ? angka(s) : s; });
    });
  }

  function terkiniKeBaris() {
    var box = document.getElementById("gempa-terkini");
    if (!box) return null;
    var rows = [["Parameter", "Nilai"]], mag = box.querySelector(".gempa-mag");
    if (mag) rows.push(["Magnitude", angka(bersih(mag.textContent).replace(/^M\s*/, ""))]);
    Array.prototype.forEach.call(box.querySelectorAll("p"), function (p) {
      var s = p.querySelector("strong"), isi = bersih(p.textContent);
      if (s) {
        rows.push([bersih(s.textContent).replace(/:$/, ""), bersih(p.textContent.replace(s.textContent, ""))]);
      } else {
        var i = isi.indexOf(":");
        if (i > 0) rows.push([isi.slice(0, i).replace(/^[^A-Za-z]+/, ""), bersih(isi.slice(i + 1))]);
      }
    });
    return rows.length > 1 ? rows : null;
  }

  function cuacaKeBaris() {
    if (typeof cuacaData === "undefined" || !cuacaData) return null;
    var lok = bersih(document.getElementById("cuaca-judul").textContent);
    var rows = [["Lokasi", "Tanggal", "Waktu (lokal)", "Cuaca", "Suhu (°C)", "Kelembapan (%)",
                 "Kecepatan angin (km/jam)", "Arah angin", "Curah hujan (mm)"]];
    cuacaData.hari.forEach(function (h) {
      h.items.forEach(function (p) {
        rows.push([lok, h.tgl, teks(p.waktu).slice(11, 16), teks(p.cuaca), angka(teks(p.t)), angka(teks(p.hu)),
                   angka(teks(p.ws)), teks(p.wd), angka(teks(p.tp))]);
      });
    });
    return rows.length > 1 ? rows : null;
  }

  function peringatanKeBaris() {
    var items = document.querySelectorAll("#peringatan .warn-item");
    if (!items.length) return null;
    var rows = [["Judul", "Keterangan", "Dipublikasikan", "Tautan"]];
    Array.prototype.forEach.call(items, function (it) {
      var st = it.querySelector("strong"), ps = it.querySelectorAll("p:not(.note)");
      var nt = it.querySelector("p.note"), a = it.querySelector("a");
      rows.push([st ? bersih(st.textContent) : "", ps.length ? bersih(ps[0].textContent) : "",
                 nt ? bersih(nt.textContent).replace(/^Dipublikasikan:\s*/, "") : "", a ? a.href : ""]);
    });
    return rows;
  }

  // ---------- Tulis file ----------
  function lembar(judul, rows) {
    var ws = XLSX.utils.aoa_to_sheet([[judul], [SUMBER], ["Diunduh: " + sekarang()], []].concat(rows));
    ws["!cols"] = rows[0].map(function (_, c) {
      var m = 10;
      rows.forEach(function (r) { var l = teks(r[c]).length; if (l > m) m = l; });
      return { wch: Math.min(m + 2, 60) };
    });
    return ws;
  }

  function simpanBerkas(nama, isi, tipe) {
    var url = URL.createObjectURL(new Blob([isi], { type: tipe }));
    var a = document.createElement("a");
    a.href = url; a.download = nama;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  // sheets: [[namaSheet, judul, baris], ...]
  function unduh(nama, sheets) {
    sheets = sheets.filter(function (s) { return s[2] && s[2].length > 1; });
    if (!sheets.length) { alert("Belum ada data yang bisa diunduh. Tunggu data selesai dimuat, atau pilih lokasi dulu."); return; }
    var d = new Date(), pad = function (n) { return (n < 10 ? "0" : "") + n; };
    var cap = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "-" + pad(d.getHours()) + pad(d.getMinutes());
    if (typeof XLSX !== "undefined") {
      var wb = XLSX.utils.book_new();
      sheets.forEach(function (s) { XLSX.utils.book_append_sheet(wb, lembar(s[1], s[2]), s[0]); });
      XLSX.writeFile(wb, nama + "-" + cap + ".xlsx");
      return;
    }
    // Cadangan bila pustaka Excel gagal dimuat (perlu internet): CSV, pemisah titik koma
    // supaya terbuka rapi di Excel berbahasa Indonesia.
    var q = function (c) { return '"' + teks(c).replace(/"/g, '""') + '"'; };
    var csv = sheets.map(function (s) {
      return [[s[1]], [SUMBER], ["Diunduh: " + sekarang()], []].concat(s[2]).map(function (r) { return r.map(q).join(";"); }).join("\r\n");
    }).join("\r\n\r\n");
    simpanBerkas(nama + "-" + cap + ".csv", "\ufeff" + csv, "text/csv;charset=utf-8");
    alert("Pustaka Excel tidak termuat (butuh internet), jadi file diunduh sebagai CSV. File ini tetap bisa dibuka di Excel.");
  }

  // ---------- Halaman Laporan gabungan ----------
  function el(tag, cls, t) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (t != null) e.textContent = t;
    return e;
  }
  function bulat1(x) { return Math.round(x * 10) / 10; }

  function ringkasCuaca(rows) {
    var data = rows.slice(1), out = [];
    function kol(i) { return data.map(function (r) { return r[i]; }).filter(function (x) { return typeof x === "number"; }); }
    function jumlah(a) { return a.reduce(function (x, y) { return x + y; }, 0); }
    var suhu = kol(4), hu = kol(5), ws = kol(6), tp = kol(8);
    if (suhu.length) out.push(["Suhu terendah - tertinggi", Math.min.apply(null, suhu) + " - " + Math.max.apply(null, suhu) + " °C"]);
    if (hu.length) out.push(["Rata-rata kelembapan", bulat1(jumlah(hu) / hu.length) + " %"]);
    if (ws.length) out.push(["Angin maksimum", Math.max.apply(null, ws) + " km/jam"]);
    if (tp.length) out.push(["Total curah hujan", bulat1(jumlah(tp)) + " mm"]);
    return out;
  }

  function ambilSemua() {
    var j = document.getElementById("cuaca-judul");
    return {
      lokasi: bersih(j && j.textContent),
      cuaca: cuacaKeBaris(),
      peringatan: peringatanKeBaris(),
      terkini: terkiniKeBaris(),
      m5: tabelKeBaris(document.getElementById("gempa-list")),
      dirasakan: tabelKeBaris(document.getElementById("gempa-dirasakan"))
    };
  }

  function tabelDOM(rows) {
    var wrap = el("div", "lap-tabel"), t = el("table"), hr = t.createTHead().insertRow();
    rows[0].forEach(function (h) { hr.appendChild(el("th", null, h)); });
    var tb = t.createTBody();
    rows.slice(1).forEach(function (r) {
      var tr = tb.insertRow();
      r.forEach(function (c) { tr.insertCell().textContent = teks(c); });
    });
    wrap.appendChild(t);
    return wrap;
  }

  function bagian(box, judul, rows, kosong) {
    box.appendChild(el("h3", null, judul));
    if (rows && rows.length > 1) box.appendChild(tabelDOM(rows));
    else box.appendChild(el("p", "note", kosong));
  }

  function bangunLaporan() {
    var box = document.getElementById("lap-isi");
    if (!box) return;
    var d = ambilSemua();
    box.textContent = "";
    box.appendChild(el("h2", "lap-judul", "Laporan Informasi BMKG"));
    box.appendChild(el("p", "note lap-meta", "Dibuat: " + sekarang() + ". " + SUMBER + ". Klik Perbarui data bila ada pilihan lokasi atau data yang baru."));

    box.appendChild(el("h3", null, "1. Prakiraan cuaca" + (d.lokasi ? " - " + d.lokasi : "")));
    if (d.cuaca) {
      box.appendChild(tabelDOM([["Ringkasan", "Nilai"]].concat(ringkasCuaca(d.cuaca))));
      box.appendChild(tabelDOM(d.cuaca.map(function (r) { return r.slice(1); })));
    } else {
      box.appendChild(el("p", "note", "Belum ada data cuaca. Pilih lokasi di sub-tab Meteorologi, lalu klik Perbarui data."));
    }

    bagian(box, "2. Peringatan dini cuaca",
      d.peringatan && d.peringatan.map(function (r) { return r.slice(0, 3); }),
      "Tidak ada peringatan dini yang tercatat, atau data belum termuat.");
    bagian(box, "3. Gempa terkini dan potensi tsunami", d.terkini, "Data gempa terkini belum termuat.");
    bagian(box, "4. Gempa M 5.0+ terbaru", d.m5, "Data gempa M 5.0+ belum termuat.");
    bagian(box, "5. Gempa dirasakan", d.dirasakan, "Data gempa dirasakan belum termuat.");
    box.appendChild(el("p", "note", "Data dapat berubah sewaktu-waktu. Sumber: BMKG."));
  }

  function unduhLaporan() {
    var d = ambilSemua();
    var n = function (r) { return r ? r.length - 1 : 0; };
    var ringkas = [["Keterangan", "Nilai"], ["Laporan", "Informasi BMKG"], ["Dibuat", sekarang()],
                   ["Lokasi cuaca", d.lokasi || "(belum dipilih)"]];
    if (d.cuaca) ringkas = ringkas.concat(ringkasCuaca(d.cuaca));
    ringkas.push(["Jumlah peringatan dini", n(d.peringatan)], ["Jumlah gempa M 5.0+", n(d.m5)], ["Jumlah gempa dirasakan", n(d.dirasakan)]);
    unduh("BMKG-laporan", [
      ["Ringkasan", "Ringkasan laporan", ringkas],
      ["Cuaca", "Prakiraan cuaca" + (d.lokasi ? " - " + d.lokasi : ""), d.cuaca],
      ["Peringatan dini", "Peringatan dini cuaca BMKG", d.peringatan],
      ["Gempa terkini", "Gempa terkini dan potensi tsunami", d.terkini],
      ["Gempa M5+", "Gempa M 5.0+ terbaru", d.m5],
      ["Gempa dirasakan", "Gempa dirasakan", d.dirasakan]
    ]);
  }

  var EXPORT = {
    lap: unduhLaporan,
    met: function () {
      var lok = bersih((document.getElementById("cuaca-judul") || {}).textContent);
      unduh("BMKG-meteorologi", [
        ["Cuaca", "Prakiraan cuaca" + (lok ? " - " + lok : ""), cuacaKeBaris()],
        ["Peringatan dini", "Peringatan dini cuaca BMKG", peringatanKeBaris()]
      ]);
    },
    geo: function () {
      unduh("BMKG-gempa", [
        ["Gempa terkini", "Gempa terkini dan potensi tsunami", terkiniKeBaris()],
        ["Gempa M5+", "Gempa M 5.0+ terbaru", tabelKeBaris(document.getElementById("gempa-list"))],
        ["Gempa dirasakan", "Gempa dirasakan", tabelKeBaris(document.getElementById("gempa-dirasakan"))]
      ]);
    }
  };

  // ---------- Tombol & judul cetak ----------
  function tombol(label, fn) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "btn-act"; b.textContent = label;
    b.addEventListener("click", fn);
    return b;
  }

  function pasang() {
    var sec = document.getElementById("bmkg");
    if (!sec) return;
    Array.prototype.forEach.call(sec.querySelectorAll(".subpanel"), function (panel) {
      var kunci = panel.id.replace("sub-", ""), bar = document.createElement("div");
      bar.className = "toolbar";
      if (kunci === "lap") bar.appendChild(tombol("🔄 Perbarui data", bangunLaporan));
      if (EXPORT[kunci]) bar.appendChild(tombol("📊 Unduh Excel", EXPORT[kunci]));
      bar.appendChild(tombol("🖨️ Cetak halaman", function () { window.print(); }));
      panel.insertBefore(bar, panel.firstChild);
    });
    // Laporan dibangun ulang saat tab dibuka, dan otomatis bila data baru masuk saat tab terbuka
    var tabLap = sec.querySelector('.subtab[data-sub="lap"]');
    if (tabLap) tabLap.addEventListener("click", bangunLaporan);
    var tunggu = null;
    function segarkan() {
      if (!document.getElementById("sub-lap").classList.contains("active")) return;
      clearTimeout(tunggu); tunggu = setTimeout(bangunLaporan, 300);
    }
    if (typeof MutationObserver !== "undefined") {
      ["cuaca-slot", "peringatan", "gempa-terkini", "gempa-list", "gempa-dirasakan"].forEach(function (id) {
        var n = document.getElementById(id);
        if (n) new MutationObserver(segarkan).observe(n, { childList: true, subtree: true });
      });
    }
    bangunLaporan();

    var head = document.createElement("div");
    head.className = "print-head";
    sec.insertBefore(head, sec.firstChild);

    // Diisi tepat sebelum mencetak, jadi Ctrl+P juga menghasilkan judul yang benar
    window.addEventListener("beforeprint", function () {
      var aktif = sec.querySelector(".subpanel.active"), tb = aktif && sec.querySelector('.subtab[data-sub="' + aktif.id.replace("sub-", "") + '"]');
      if (aktif && aktif.id === "sub-lap") bangunLaporan();
      head.textContent = "";
      var h = document.createElement("h2");
      h.textContent = "Laporan Informasi BMKG" + (tb && aktif.id !== "sub-lap" ? " - " + bersih(tb.textContent).replace(/^[^A-Za-z]+/, "") : "");
      var p = document.createElement("p");
      p.textContent = "Dicetak: " + sekarang() + ". " + SUMBER;
      head.appendChild(h); head.appendChild(p);
    });
  }

  if (typeof document !== "undefined" && document.getElementById) pasang();
  if (typeof window !== "undefined") window.Laporan = { angka: angka, cuacaKeBaris: cuacaKeBaris, tabelKeBaris: tabelKeBaris, ringkasCuaca: ringkasCuaca };
})();
