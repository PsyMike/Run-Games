# Warden assets — awaiting reference artwork

No character artwork ships with this test. The scene's position marker is a
control diagnostic, not a Warden or finished art. Supply the approved reference
before creating the final character animations. The intended character is a
small fantasy Warden with blond hair, blue-and-gold armour, a red cape and a
sword.

## Prepare the real sprites

1. Create approved walk, attack and dodge frames for all eight directions. Keep
   the sword hand and asymmetrical costume details consistent; directions are
   never silently mirrored or substituted.
2. Export RGBA PNG sprites with a fully transparent background. Use a consistent
   canvas, character scale, and foot registration point across all frames. Preserve
   clean alpha edges. Leave enough transparent padding for the sword and cape.
3. Pack the frames into a PixiJS-compatible spritesheet JSON and PNG atlas. Standard
   TexturePacker JSON Hash/PixiJS format supports trimmed/rotated frames; keep
   `sourceSize` and `spriteSourceSize` correct so the registered pivot stays stable.
   The atlas JSON's `meta.image` must point to its actual PNG, relative to the JSON.
4. Put the atlas files and `manifest.json` in this directory. In
   `src/assets/config.ts`, change `WARDEN_MANIFEST_PATH` from `null` to
   `'assets/warden/manifest.json'`. Run the build checks and inspect every direction.

The loader deliberately makes no asset requests while this setting is `null`.
An enabled but incomplete atlas reports a diagnostic instead of displaying missing
frames. All paths work with Vite's relative base; there are no runtime art services.

## Manifest format

This complete schema example names hypothetical frames; it includes no artwork.
Replace the frame lists and FPS with the approved exported animations. Every
listed frame name must exist in the spritesheet. `anchor` is the normalized foot
pivot, and `scale` is the display scale. Idle holds the first walk frame for the
current direction. Walk must use `loop: true`; attack and dodge must use
`loop: false`. Walk uses the manifest's FPS. For attack and dodge, FPS is an
authoring hint: normalized controller action progress selects frames so the
complete one-shot clip fits the action's duration.

```json
{
  "schemaVersion": 1,
  "atlas": "warden.atlas.json",
  "anchor": { "x": 0.5, "y": 0.9 },
  "scale": 1,
  "clips": {
    "walk": {
      "south": {
        "frames": ["walk/south/0", "walk/south/1"],
        "fps": 8,
        "loop": true
      },
      "south-west": {
        "frames": ["walk/south-west/0", "walk/south-west/1"],
        "fps": 8,
        "loop": true
      },
      "west": {
        "frames": ["walk/west/0", "walk/west/1"],
        "fps": 8,
        "loop": true
      },
      "north-west": {
        "frames": ["walk/north-west/0", "walk/north-west/1"],
        "fps": 8,
        "loop": true
      },
      "north": {
        "frames": ["walk/north/0", "walk/north/1"],
        "fps": 8,
        "loop": true
      },
      "north-east": {
        "frames": ["walk/north-east/0", "walk/north-east/1"],
        "fps": 8,
        "loop": true
      },
      "east": {
        "frames": ["walk/east/0", "walk/east/1"],
        "fps": 8,
        "loop": true
      },
      "south-east": {
        "frames": ["walk/south-east/0", "walk/south-east/1"],
        "fps": 8,
        "loop": true
      }
    },
    "attack": {
      "south": {
        "frames": ["attack/south/0", "attack/south/1"],
        "fps": 5,
        "loop": false
      },
      "south-west": {
        "frames": ["attack/south-west/0", "attack/south-west/1"],
        "fps": 5,
        "loop": false
      },
      "west": {
        "frames": ["attack/west/0", "attack/west/1"],
        "fps": 5,
        "loop": false
      },
      "north-west": {
        "frames": ["attack/north-west/0", "attack/north-west/1"],
        "fps": 5,
        "loop": false
      },
      "north": {
        "frames": ["attack/north/0", "attack/north/1"],
        "fps": 5,
        "loop": false
      },
      "north-east": {
        "frames": ["attack/north-east/0", "attack/north-east/1"],
        "fps": 5,
        "loop": false
      },
      "east": {
        "frames": ["attack/east/0", "attack/east/1"],
        "fps": 5,
        "loop": false
      },
      "south-east": {
        "frames": ["attack/south-east/0", "attack/south-east/1"],
        "fps": 5,
        "loop": false
      }
    },
    "dodge": {
      "south": {
        "frames": ["dodge/south/0", "dodge/south/1"],
        "fps": 8,
        "loop": false
      },
      "south-west": {
        "frames": ["dodge/south-west/0", "dodge/south-west/1"],
        "fps": 8,
        "loop": false
      },
      "west": {
        "frames": ["dodge/west/0", "dodge/west/1"],
        "fps": 8,
        "loop": false
      },
      "north-west": {
        "frames": ["dodge/north-west/0", "dodge/north-west/1"],
        "fps": 8,
        "loop": false
      },
      "north": {
        "frames": ["dodge/north/0", "dodge/north/1"],
        "fps": 8,
        "loop": false
      },
      "north-east": {
        "frames": ["dodge/north-east/0", "dodge/north-east/1"],
        "fps": 8,
        "loop": false
      },
      "east": {
        "frames": ["dodge/east/0", "dodge/east/1"],
        "fps": 8,
        "loop": false
      },
      "south-east": {
        "frames": ["dodge/south-east/0", "dodge/south-east/1"],
        "fps": 8,
        "loop": false
      }
    }
  }
}
```

Walk playback uses elapsed state time. Attack and dodge use normalized controller
progress, clamped to 0–1, and hold the last frame at completion. This keeps every
one-shot clip aligned with the action's actual duration even when the atlas frame
count or authoring FPS changes. Playback does not depend on display refresh rate.
The controller owns action duration and movement; the manifest does not change
gameplay timing. Tune action durations to the approved art's feel when it arrives.

No final character animations should be authored from substitute primitive shapes.
