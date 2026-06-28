# Human Protocol Image2 Floor Import

Put the five source images here before running the ingest script:

- `level01.png` or `level01_*.png`
- `level02.png` or `level02_*.png`
- `level03.png` or `level03_*.png`
- `level04.png` or `level04_*.png`
- `level05.png` or `level05_*.png`

Then run:

```bash
node games/human-protocol/scripts/asset-build/ingest-hero-floor-image2-sources.mjs
```

The script preserves originals, center-crops room-fit source PNGs without stretching, and creates runtime WebP previews.
