#!/usr/bin/env python
"""
Ubah daftar kode wilayah (kode + nama) menjadi file JSON untuk pencarian di web.

Masukan : CSV (kolom kode dan nama) atau file .sql dari cahyadsn/wilayah
          Kode berbentuk 11 / 11.01 / 11.01.01 / 11.01.01.2001
Keluaran: <out>/provinsi.json      daftar provinsi
          <out>/<kode prov>.json   kab/kota -> kecamatan -> kelurahan/desa per provinsi
          <out>/cari.json          indeks pencarian (hanya dengan --dengan-cari)

Pemakaian: python buat_wilayah.py wilayah.csv --out web-bmkg/data/wilayah
"""
import argparse, csv, json, os, re

KODE = re.compile(r"^\d{2}(\.\d{2}){0,2}(\.\d{4})?$")
PASANGAN_SQL = re.compile(r"\('(\d{2}(?:\.\d{2}){0,2}(?:\.\d{4})?)'\s*,\s*'((?:[^'\\]|\\.|'')*)'")


def baca(path):
    rows = {}
    if path.lower().endswith(".sql"):
        teks = open(path, encoding="utf-8", errors="replace").read()
        for k, n in PASANGAN_SQL.findall(teks):
            rows[k] = n.replace("''", "'").replace("\\'", "'")
        return rows
    with open(path, encoding="utf-8-sig", newline="") as f:
        for r in csv.reader(f):
            r = [c.strip() for c in r]
            for i, c in enumerate(r):
                if KODE.match(c):
                    nama = next((x for x in r[i + 1:] if x and not KODE.match(x)), "")
                    if nama:
                        rows[c] = nama
                    break
    return rows


def rapikan(nama):
    # Data resmi sering huruf besar semua; ubah jadi huruf awal besar
    return nama.title() if nama.isupper() else nama


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sumber")
    ap.add_argument("--out", default="data/wilayah")
    ap.add_argument("--dengan-cari", action="store_true", help="buat juga cari.json (indeks pencarian, ukuran besar)")
    ap.add_argument("--tanpa-rapikan", action="store_true", help="biarkan huruf besar apa adanya")
    a = ap.parse_args()

    rows = baca(a.sumber)
    if not rows:
        raise SystemExit("Tidak ada baris kode wilayah yang terbaca. Cek format berkas.")
    if not a.tanpa_rapikan:
        rows = {k: rapikan(v) for k, v in rows.items()}

    os.makedirs(a.out, exist_ok=True)
    level = lambda k: k.count(".")
    prov = sorted([k for k in rows if level(k) == 0])
    nama_kab = lambda k: rows.get(k[:5], "")
    nama_kec = lambda k: rows.get(k[:8], "")

    per_prov, cari = {}, []
    for k in sorted(rows):
        lv = level(k)
        p = k[:2]
        d = per_prov.setdefault(p, {"kab": [], "kec": {}, "kel": {}})
        if lv == 1:
            d["kab"].append([k, rows[k]])
        elif lv == 2:
            d["kec"].setdefault(k[:5], []).append([k, rows[k]])
        elif lv == 3:
            d["kel"].setdefault(k[:8], []).append([k, rows[k]])
            cari.append("%s|%s, %s, %s, %s" % (k, rows[k], nama_kec(k), nama_kab(k), rows.get(p, "")))

    json.dump([[p, rows[p]] for p in prov], open(os.path.join(a.out, "provinsi.json"), "w", encoding="utf-8"),
              ensure_ascii=False, separators=(",", ":"))
    for p, d in per_prov.items():
        json.dump(d, open(os.path.join(a.out, p + ".json"), "w", encoding="utf-8"),
                  ensure_ascii=False, separators=(",", ":"))
    if a.dengan_cari:
        json.dump(cari, open(os.path.join(a.out, "cari.json"), "w", encoding="utf-8"),
                  ensure_ascii=False, separators=(",", ":"))
    print("Provinsi: %d | Kelurahan/desa: %d | tulis ke %s" % (len(prov), len(cari), a.out))


if __name__ == "__main__":
    main()
