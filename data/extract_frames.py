"""
Extraction de frames depuis les vidéos FaceForensics++.

Pour chaque vidéo, extrait N frames espacées uniformément
et les sauvegarde sous :
  data/frames/real/<video_id>/<frame>.jpg
  data/frames/fake/<video_id>/<frame>.jpg

Usage :
  python data/extract_frames.py --ff-dir data/faceforensics/ --out data/frames/ --n-frames 10
"""

import argparse
import json
from pathlib import Path
import cv2
from tqdm import tqdm


def extract_frames(video_path: Path, out_dir: Path, n_frames: int = 10) -> int:
    cap = cv2.VideoCapture(str(video_path))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total == 0:
        cap.release()
        return 0

    indices = [int(i * total / n_frames) for i in range(n_frames)]
    out_dir.mkdir(parents=True, exist_ok=True)
    saved = 0

    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ret, frame = cap.read()
        if ret:
            cv2.imwrite(str(out_dir / f"frame_{idx:05d}.jpg"), frame)
            saved += 1

    cap.release()
    return saved


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ff-dir",   default="data/faceforensics")
    parser.add_argument("--out",      default="data/frames")
    parser.add_argument("--n-frames", type=int, default=10)
    args = parser.parse_args()

    ff_dir  = Path(args.ff_dir)
    out_dir = Path(args.out)

    # Vidéos réelles
    real_vids = sorted((ff_dir / "original_sequences/youtube/c0/videos").glob("*.mp4"))
    print(f"Vidéos réelles : {len(real_vids)}")
    for vid in tqdm(real_vids, desc="real"):
        extract_frames(vid, out_dir / "real" / vid.stem, args.n_frames)

    # Vidéos fake (Deepfakes)
    fake_vids = sorted((ff_dir / "manipulated_sequences/Deepfakes/c0/videos").glob("*.mp4"))
    print(f"Vidéos fake : {len(fake_vids)}")
    for vid in tqdm(fake_vids, desc="fake"):
        extract_frames(vid, out_dir / "fake" / vid.stem, args.n_frames)

    # Génère le manifest
    manifest = {
        "real": [str(p) for p in (out_dir / "real").rglob("*.jpg")],
        "fake": [str(p) for p in (out_dir / "fake").rglob("*.jpg")],
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(f"\nFrames extraites — real: {len(manifest['real'])}, fake: {len(manifest['fake'])}")
    print(f"Manifest : {out_dir / 'manifest.json'}")


if __name__ == "__main__":
    main()
