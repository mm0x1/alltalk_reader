#!/bin/sh
# Regenerates Readhouse's dithered assets with Ditherhouse (Motherhouse Inc).
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

# Chapter-opening band: ink fading into paper, a fine blue-noise screen like an engraving.
band() { # name ink paper
	printf '%s\n%s\n' "$2" "$3" > "$TMP/$1.hex"
	"$CLI" gradient --palette "$TMP/$1.hex" --shape linear --angle 90 \
		--stops "$2@0,$3@1" --width 800 --height 64 \
		--algorithm ordered-blue-noise --pixel-scale 1 --indexed \
		-o "$OUT/band-$1.png"
}

band light '#22355a' '#e7eef0'
band dark '#e6dfcf' '#1b2232'
band sepia '#4a2f1b' '#efe5d0'

ls -l "$OUT"
