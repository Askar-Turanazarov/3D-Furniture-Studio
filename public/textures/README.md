# Photo textures (Quality: Photo)

Folders: `floor`, `wall`, `wood`, `fabric`. Each folder has `color.jpg`, `normal.jpg` (OpenGL) and `roughness.jpg` (~1K).
Source: ambientCG.com, CC0 license. If files are missing, the 3D scene falls back to procedural textures.

## Library (`library.json`)

`sets/<id>/` holds the bundled library sets (floors, walls, rough/pre-finish finishes, leather): `color.jpg`, `normal.jpg` (OpenGL), `roughness.jpg`, 1K, re-compressed JPEG. Each entry of `library.json` gives the ambientCG asset, the tile size in metres and the style value it sets. Sets marked `bundled: false` are downloaded on demand into `lib/<id>/` (not in git).
