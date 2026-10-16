# Photo textures (Quality: Photo)

Folders: `floor`, `wall`, `wood`, `fabric`. Each folder has `color.jpg`, `normal.jpg` (OpenGL) and `roughness.jpg` (~1K).
Source: ambientCG.com, CC0 license. If files are missing, the 3D scene falls back to procedural textures.

## Library (`library.json`)

`sets/<id>/` holds the bundled library sets (floors, walls, rough/pre-finish finishes, leather): `color.jpg`, `normal.jpg` (OpenGL), `roughness.jpg`, 1K, re-compressed JPEG. Each entry of `library.json` gives the ambientCG asset, the tile size in metres and the style value it sets. Bundled sets include the building facade and site (`maps` lists a set's own maps, e.g. leaves: color / opacity). Sets marked `bundled: false` are downloaded on demand into `lib/<id>/` (not in git), or into Vercel Blob `textures/lib/<id>/` when `BLOB_READ_WRITE_TOKEN` is set — served at the same `/textures/lib/` address.
