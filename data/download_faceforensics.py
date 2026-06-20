"""
Téléchargement de FaceForensics++

FaceForensics++ est un dataset à accès restreint.
Étapes préalables :
  1. Remplir le formulaire : https://github.com/ondyari/FaceForensics
  2. Recevoir le script de téléchargement officiel par email
  3. Remplacer USERNAME et PASSWORD ci-dessous

Ce script télécharge uniquement ce qui est nécessaire au MVP :
  - real/     : vidéos originales (c0, 1000 vidéos)
  - Deepfakes/: manipulations DeepFake (c0, 1000 vidéos)

Usage :
  python data/download_faceforensics.py --output data/faceforensics/
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path

FF_SCRIPT_URL = "https://raw.githubusercontent.com/ondyari/FaceForensics/master/dataset/download_FaceForensics.py"

SUBSETS = [
    "original_sequences/youtube",
    "manipulated_sequences/Deepfakes",
]
COMPRESSION = "c0"    # sans compression (qualité maximale)
NUM_VIDEOS  = 200     # réduire pour MVP rapide (1000 = dataset complet)


def download_official_script(dest: Path):
    import urllib.request
    print("Téléchargement du script officiel FaceForensics++...")
    urllib.request.urlretrieve(FF_SCRIPT_URL, dest / "ff_download.py")
    print(f"Script sauvegardé dans {dest / 'ff_download.py'}")


def run_download(output_dir: Path, username: str, password: str):
    script = output_dir / "ff_download.py"
    if not script.exists():
        download_official_script(output_dir)

    for subset in SUBSETS:
        print(f"\n--- Téléchargement : {subset} ---")
        cmd = [
            sys.executable, str(script),
            str(output_dir),
            "-d", subset,
            "-c", COMPRESSION,
            "-n", str(NUM_VIDEOS),
            "--server", "EU",
        ]
        env = {**os.environ, "FF_USERNAME": username, "FF_PASSWORD": password}
        result = subprocess.run(cmd, env=env)
        if result.returncode != 0:
            print(f"ERREUR lors du téléchargement de {subset}")
            sys.exit(1)

    print("\nTéléchargement terminé.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output",   default="data/faceforensics", help="Dossier de destination")
    parser.add_argument("--username", default=os.getenv("FF_USERNAME", ""), help="Email FaceForensics++")
    parser.add_argument("--password", default=os.getenv("FF_PASSWORD", ""), help="Mot de passe FaceForensics++")
    args = parser.parse_args()

    if not args.username or not args.password:
        print("""
CREDENTIALS MANQUANTS
---------------------
FaceForensics++ est un dataset à accès restreint.

1. Demandez l'accès : https://github.com/ondyari/FaceForensics#access
2. Exportez vos credentials :
   set FF_USERNAME=votre@email.com
   set FF_PASSWORD=votre_mot_de_passe
3. Relancez ce script.
""")
        sys.exit(1)

    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    run_download(output, args.username, args.password)


if __name__ == "__main__":
    main()
