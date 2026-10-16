# Asset preparation

The eye mark, paper cards, cover compositions, interface CSS and SVG sources were created in this project. The detective redesign adds an original SVG office scene and eight vector suspect portraits. No stock illustrations, photographs, third party game imagery, store badges or external logos were imported.

Bungee Regular and Barlow Semi Condensed Medium and Bold are bundled from the Google Fonts source repository under the SIL Open Font License. Original license files are included in public/Bungee-LICENSE.txt and public/Barlow-LICENSE.txt and copied into the client bundle. Sources: https://github.com/google/fonts/tree/main/ofl/bungee and https://github.com/google/fonts/tree/main/ofl/barlowsemicondensed. Barlow font binaries keep their original embedded family names; the CSS family alias is Barlow.

The music uses four original arrangements of synthesized bass, melody, chords and percussion, with variations across a sixteen bar cycle. Action cues are synthesized from original short note patterns. No external recording, music sample or generated audio service was used. Synthesis source is public/audio.js. There is no third party music license dependency.

The cover drafts now use the detective office, suspect portraits, paper files, Bungee lettering and amber title palette from the game. They contain only the game title as text. Source SVG and PNG exports are in release/covers. The cover SVG files embed the font; its license is copied beside them. The generation script checks font loading, the required landscape, portrait and square pixel dimensions, exact title text and title bounds, and records file sizes and SHA256 hashes. These checks do not establish editorial approval or legal certification.

Preview videos remain pending the final platform flow. They must be recorded from actual gameplay at normal speed, with the static cover opening frame, no audio and the official dimensions and duration. Do not replace real footage with accelerated test clocks or a fabricated demonstration. The current browser test traces are diagnostics and are not submission videos.

Physical device and portal compatibility checks remain pending. Cover drafts and submission copy are preparation artifacts, not a completed Phase 8 gate.

## Procedural room revision

The 3D room, furniture, lamps, window, books and evidence props in public/environment.js and the suspects in public/characters.js are original procedural geometry, composed and lit by public/room3d.js. No downloaded character models or external textures are used. Three.js 0.186.1 is pinned in package lock. The unmodified renderer files are copied from that dependency, and public/Three-LICENSE.txt contains its MIT license. Source checks compare these vendor files byte for byte against the dependency rather than treating third party code as authored game prose.

Existing cover images predate the 3D scene and need review against the final accepted presentation before submission. No claim of visual approval is made by the deterministic renderer or layout checks.

The room detail revision adds original clock, trunk, foliage, cup and clothing geometry. Four original synthesized arrangements cover lounge, investigation, accusation and celebration, with no imported recordings or samples.

The character revision adds eight original block proportioned suspects with beveled geometry, tailored outfits, hairstyles, hats, faces and accessories. Cloth, skin, hair, leather, metal, eye, rubber and wood finishes use procedural colors and material settings. Heads, eyes and arms have independent animation pivots. Static outfit pieces are merged by material and the eight model templates are cached for reuse. No Roblox models, branding, textures or animations are included.

The lounge revision adds original parquet boards, paneled walls, cabinet construction, book spines, an evidence board with portrait silhouettes and strings, a city window, a bench, a trunk, plants, a desk fan and pendant lamps. The table includes a patterned rug, pedestal construction, brass inlay, case files, stationery and coffee settings. All surfaces use geometry, vertex colors and procedural material settings. Clock, fan, lamp and steam movement is authored in code. No stock scene, photographic texture, external animation or generated bitmap is used. The louder score uses the same original arrangements, with a separate music gain so action cues retain their previous level.

The full window interface revision uses original inline SVG menu icons and authored CSS in public/interface.css for beveled controls, inset panels, brass edging, shadows and ambient framing. The room canvas extends behind the whole interface. No icon pack, stock interface kit, game screenshot or external background image was added.
