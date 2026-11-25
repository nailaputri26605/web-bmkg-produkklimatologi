import os
import sys
import subprocess
import gdown

DATA_DIR = r"C:\laragon\www\web-bmkg\data"
os.makedirs(DATA_DIR, exist_ok=True)

OLR_NC = os.path.join(DATA_DIR, "olr.waves.cfs.nc")
PWAT_NC = os.path.join(DATA_DIR, "pwat.waves.cfs.nc")

print("=== 1. Mengunduh pwat.waves.cfs.nc (~130 MB) ===")
gdown.download(
    id="1j8x6hqKCEa-hjiyE8D2pl_Q3LmM3wHXX",
    output=PWAT_NC,
    quiet=False,
    resume=True
)

print("\n=== 2. Mengunduh olr.waves.cfs.nc (~812 MB) ===")
gdown.download(
    id="1fjSGyEhB6kc5bDnIgp5oEDqn-UDfVvEa",
    output=OLR_NC,
    quiet=False,
    resume=True
)

print("\n=== 3. Memverifikasi ukuran berkas ===")
if os.path.exists(PWAT_NC):
    print(f"PWAT: {os.path.getsize(PWAT_NC):,} bytes")
if os.path.exists(OLR_NC):
    print(f"OLR:  {os.path.getsize(OLR_NC):,} bytes")

print("\n=== 4. Memproses peta gelombang (buat_peta_gelombang.py) ===")
cmd = [
    sys.executable,
    r"C:\laragon\www\web-bmkg\buat_peta_gelombang.py",
    f"olr={OLR_NC}",
    f"pwat={PWAT_NC}",
    "--out",
    r"C:\laragon\www\web-bmkg\data\peta"
]
res = subprocess.run(cmd, capture_output=True, text=True)
print(res.stdout)
if res.stderr:
    print("Stderr:", res.stderr)
print("Selesai dengan return code:", res.returncode)
