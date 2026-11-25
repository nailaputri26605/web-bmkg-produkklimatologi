#!/usr/bin/env python3
"""Ubah NetCDF inaWMS (grid lat/lon x waktu) menjadi berkas ringan untuk peta-gelombang.html.

Pemakaian:
  python buat_peta_gelombang.py olr=olr_klasik.nc pwat=pwat_klasik.nc --out data/peta [--akhir 100]

Keluaran per produk: <out>/<produk>/meta.json dan <out>/<produk>/hari/YYYYMMDD.bin.
Tiap berkas harian berisi semua variabel (urutan di meta "urutan") sebagai int16
little-endian, tiap variabel [lat][lon]. Peta mengunduh satu berkas per tanggal.
"""
import argparse, json, os, re
from datetime import datetime, timedelta
import numpy as np

GELOMBANG = ["mjo", "kelvin", "er", "low", "mrgtd"]
NODATA = -32768


def buka(path):
    try:
        import netCDF4
        return netCDF4.Dataset(path), True
    except ImportError:
        from scipy.io import netcdf_file
        return netcdf_file(path, mmap=False), False


def ambil(ds, nc4, n):
    """Satu variabel -> (array float64 dengan NaN, atribut, dimensi)."""
    v = ds.variables[n]
    if nc4:
        a = np.ma.filled(np.ma.asarray(v[:]).astype("float64"), np.nan)
        at = {k: v.getncattr(k) for k in v.ncattrs()}
    else:
        at = {k: (x.decode() if isinstance(x, bytes) else x) for k, x in v.__dict__.items() if not k.startswith("_") or k == "_FillValue"}
        a = np.array(v.data, dtype="float64")
        for k in ("_FillValue", "missing_value"):
            if k in at:
                a[a == float(np.ravel(at[k])[0])] = np.nan
        a = a * float(np.ravel(at.get("scale_factor", 1))[0]) + float(np.ravel(at.get("add_offset", 0))[0])
    return a, at, v.dimensions


def tanggal(arr, atr):
    m = re.match(r"(\w+) since (\d{4})-(\d{2})-(\d{2})", str(atr.get("units", "")))
    if not m:
        raise SystemExit("Satuan waktu tidak dikenali: %s" % atr.get("units"))
    satuan, y, mo, d = m.group(1).lower(), int(m.group(2)), int(m.group(3)), int(m.group(4))
    kw = {"day": "days", "days": "days", "hour": "hours", "hours": "hours"}[satuan]
    return [(datetime(y, mo, d) + timedelta(**{kw: float(x)})).strftime("%Y-%m-%d") for x in arr]


def cari_nama(ds, *nama):
    for n in nama:
        if n in ds.variables:
            return n
    raise SystemExit("Variabel %s tidak ada. Isi berkas: %s" % ("/".join(nama), list(ds.variables)))


def proses(nama, path, out, akhir):
    ds, nc4 = buka(path)
    nlat = cari_nama(ds, "lat", "latitude")
    nlon = cari_nama(ds, "lon", "longitude")
    ntm = cari_nama(ds, "time")

    lat, _, _ = ambil(ds, nc4, nlat)
    lon, _, _ = ambil(ds, nc4, nlon)
    tm, tmat, _ = ambil(ds, nc4, ntm)
    la, lo = np.ravel(lat).copy(), np.ravel(lon).copy()
    waktu = tanggal(np.ravel(tm), tmat)

    ola, ol = np.argsort(la), np.argsort(lo)
    la, lo = la[ola], lo[ol]
    sel = slice(max(0, len(waktu) - akhir), None) if akhir else slice(None)
    waktu = waktu[sel]

    folder = os.path.join(out, nama)
    hari = os.path.join(folder, "hari")
    os.makedirs(hari, exist_ok=True)
    for f in os.listdir(hari):
        if f.endswith(".bin"):
            os.remove(os.path.join(hari, f))
    for f in os.listdir(folder):
        if f.endswith(".bin"):
            os.remove(os.path.join(folder, f))

    asli = list(ds.variables)
    vars_, urutan, siap, dasar = {}, [], {}, None
    for n in asli:
        a, at, dims = ambil(ds, nc4, n)
        a = np.squeeze(a)
        if a.ndim != 3 or a.shape[1:] != (len(la), len(lo)):
            continue
        a = a[:, ola][:, :, ol][sel]
        if np.isnan(a).all():
            continue
        mx = float(np.nanmax(np.abs(a)))
        skala = min(100.0, 32000.0 / mx) if mx > 0 else 100.0
        q = np.where(np.isnan(a), NODATA, np.clip(np.round(a * skala), -32767, 32767)).astype("<i2")
        info = {"skala": skala, "satuan": str(at.get("units", "")) or ("kg m-2" if n == "pr_wtr" else ""), "nama": str(at.get("long_name", n))}
        if n in GELOMBANG:
            info["ambang"] = round(float(np.nanstd(a)), 1)
        else:
            r = float(np.nanpercentile(np.abs(a), 99))
            info["rentang"] = [-round(r), round(r)]
            dasar = dasar or n
        vars_[n] = info
        urutan.append(n)
        siap[n] = q
        print("  %-8s %s  skala %.1f" % (n, a.shape, skala))
        del a

    lebar = len(la) * len(lo) * 2
    for t, tgl in enumerate(waktu):
        buf = bytearray(lebar * len(urutan))
        for i, n in enumerate(urutan):
            b = siap[n][t].astype("<i2", copy=False).tobytes()
            buf[i * lebar:(i + 1) * lebar] = b
        with open(os.path.join(hari, tgl.replace("-", "") + ".bin"), "wb") as f:
            f.write(buf)

    meta = {"produk": nama, "format": "hari", "dasar": dasar, "urutan": urutan,
            "gelombang": [g for g in GELOMBANG if g in vars_],
            "lat": [round(float(x), 4) for x in la], "lon": [round(float(x), 4) for x in lo],
            "waktu": waktu, "vars": vars_}
    json.dump(meta, open(os.path.join(folder, "meta.json"), "w", encoding="utf-8"), ensure_ascii=False)
    print("%s: %d waktu (%s .. %s), grid %dx%d, %d berkas harian" % (nama, len(waktu), waktu[0], waktu[-1], len(la), len(lo), len(waktu)))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("produk", nargs="+", help="nama=berkas.nc, contoh olr=olr.nc")
    ap.add_argument("--out", default="data/peta")
    ap.add_argument("--akhir", type=int, default=0, help="hanya N langkah waktu terakhir (0 = semua)")
    a = ap.parse_args()
    nama = []
    for p in a.produk:
        n, f = p.split("=", 1)
        proses(n, f, a.out, a.akhir); nama.append(n)
    idx = os.path.join(a.out, "index.json")
    lama = []
    if os.path.exists(idx):
        lama = json.load(open(idx)).get("produk", [])
    gabung = lama + [n for n in nama if n not in lama]
    json.dump({"produk": gabung}, open(idx, "w"))


if __name__ == "__main__":
    main()
