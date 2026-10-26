#!/usr/bin/env bash
# Builds a synthetic 34 s "walkthrough" for testing the frame sampler:
# 5 distinct shots (scene changes), one blurry shot, one static shot
# (near-duplicates), and a tone track. Output: tools/frames/test/synthetic.mp4
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p test
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "testsrc2=size=1280x720:rate=30:duration=8" \
  -f lavfi -i "mandelbrot=size=1280x720:rate=30" \
  -f lavfi -i "smptehdbars=size=1280x720:rate=30:duration=6" \
  -f lavfi -i "testsrc=size=1280x720:rate=30:duration=6" \
  -f lavfi -i "life=size=1280x720:rate=30:ratio=0.5:mold=10:life_color=#e8590c:death_color=#203040" \
  -f lavfi -i "sine=frequency=440:sample_rate=48000:duration=34" \
  -filter_complex "\
[0:v]setpts=PTS-STARTPTS,format=yuv420p[a];\
[1:v]trim=duration=8,setpts=PTS-STARTPTS,format=yuv420p[b];\
[2:v]setpts=PTS-STARTPTS,format=yuv420p[c];\
[3:v]setpts=PTS-STARTPTS,gblur=sigma=25,format=yuv420p[d];\
[4:v]trim=duration=6,setpts=PTS-STARTPTS,format=yuv420p[e];\
[a][b][c][d][e]concat=n=5:v=1:a=0[v]" \
  -map "[v]" -map 5:a -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest test/synthetic.mp4
echo "wrote $(pwd)/test/synthetic.mp4"
