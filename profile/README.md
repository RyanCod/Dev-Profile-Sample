# Alex Rivera — developer profile

Single-page portfolio. Static files, no build step. Placeholder copy and data throughout.

## Run

```bash
cd profile
python3 -m http.server 5173
# → http://localhost:5173
```

Or open `index.html` directly — everything is relative.

## Stack

- **HTML / CSS / vanilla JS** — no framework, no bundler.
- **GSAP + ScrollTrigger** (`vendor/`) — scroll reveals, stacked work cards, counters, parallax.
- **Lenis** (`vendor/`) — smooth scroll, synced to the GSAP ticker.
- **WebGL** — the hero's animated iridescent liquid field (raw shaders, no Three.js). The field forms a vortex around the cursor; swirl strength comes from the pointer's angular velocity around the hero centre.
- **Canvas 2D emblem** — the `AR` monogram is 620 particles. Circling the pointer around it assembles them; stop and they dissolve back into dust.
- **Liquid glass** — `backdrop-filter` + animated conic border + pointer-tracked specular highlight, over a fixed aurora layer so the glass has colour to refract.
- **Cursor** — a soft iridescent glow that trails the pointer, shifts hue as it moves, and drags the aurora with it.

## Files

```
index.html   markup + placeholder content
styles.css   tokens, layout, glass recipes, responsive, reduced-motion
main.js      loader, Lenis, shader, cursor, tilt, magnetic, reveals, accordion
vendor/      gsap.min.js, ScrollTrigger.min.js, lenis.min.js
```

## Replace the placeholders

All content is literal markup — no data layer. Search and replace:

| Placeholder | Where |
|---|---|
| `Alex Rivera` / `AR` | hero card, nav brand, title, footer |
| `hello@alexrivera.dev` | contact button + `data-copy` attribute |
| Project names, copy, tags | `.work-card` blocks in `index.html` |
| Stats | `data-count` attributes (with `data-suffix`, `data-decimals`) |
| Social links | `.contact-foot a[href="#"]` |

Colours live in `:root` in `styles.css` (`--violet`, `--cyan`, `--amber`, `--rose`).

## Motion notes

- Everything degrades: `prefers-reduced-motion` kills the shader loop, Lenis, cursor, parallax and reveals.
- `hover: none` devices skip the custom cursor, magnetic/tilt handlers and the swirl emblem (hidden under 900px).
- The shader pauses when the hero leaves the viewport or the tab is hidden; the emblem canvas does the same.
- Scroll effects are built in `boot()` after the preloader, so ScrollTrigger measures final layout.

## The swirl

Circling the pointer around the middle of the hero (roughly one turn) charges the emblem. It fades back to dust in about two seconds. The threshold is `energy` in the `emblem()` module — lower the `0.38` multiplier to make it easier.

## Known limits

- The WebGL field falls back to a CSS gradient if the context or shader fails.
- Work cards are `position: sticky`; below 1024px they become normal stacked cards.
- No contact form backend — the CTA is a `mailto:` plus a clipboard copy.
