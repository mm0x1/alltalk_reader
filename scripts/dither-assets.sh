#!/bin/sh
# Regenerates Readhouse's dithered assets with Ditherhouse (Motherhouse).
# The outputs in static/dither/ are committed; rerun this after changing a theme's ink or paper
# in src/lib/design/tokens.css, and keep the colours below in step with the tokens.
#
# Usage: DITHERHOUSE_CLI=/path/to/ditherhouse-cli scripts/dither-assets.sh
set -eu

CLI="${DITHERHOUSE_CLI:-../ditherhouse/target/release/ditherhouse-cli}"
[ -x "$CLI" ] || CLI="../ditherhouse/target/debug/ditherhouse-cli"
OUT="static/dither"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"

# Chapter-opening band: ink fading into paper in a fine Bayer crosshatch, like an engraving.
band() { # name ink paper
	printf '%s\n%s\n' "$2" "$3" > "$TMP/$1.hex"
	"$CLI" gradient --palette "$TMP/$1.hex" --shape linear --angle 90 \
		--stops "$2@0,$3@1" --width 800 --height 64 \
		--algorithm ordered-bayer-8x8 --pixel-scale 1 --indexed \
		-o "$OUT/band-$1.png"
}

band light '#22355a' '#e7eef0'
band dark '#e6dfcf' '#1b2232'
band sepia '#4a2f1b' '#efe5d0'

# Cover for a book without one: ink rising from the foot. Only the lowest 40% of the cover;
# the page shows plain paper above it, where the title sits (see ContinuePlate.svelte).
cover() { # name ink paper
	printf '%s\n%s\n' "$2" "$3" > "$TMP/cover-$1.hex"
	"$CLI" gradient --palette "$TMP/cover-$1.hex" --shape linear --angle 90 \
		--stops "$2@0,$3@1" --width 80 --height 48 \
		--algorithm ordered-bayer-8x8 --pixel-scale 1 --indexed \
		-o "$OUT/cover-$1.png"
}

cover light '#22355a' '#e7eef0'
cover dark '#e6dfcf' '#1b2232'
cover sepia '#4a2f1b' '#efe5d0'

ls -l "$OUT"
