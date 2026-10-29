/** Locally bundled fonts (Fontsource) — no network font loading. */
import '@fontsource/allerta-stencil/400.css';
import '@fontsource/stardos-stencil/400.css';
import '@fontsource/stardos-stencil/700.css';
import '@fontsource/special-elite/400.css';
import '@fontsource/share-tech-mono/400.css';
import { FONTS } from './tokens';

/** Canvas text needs the faces loaded before the first draw. */
export async function loadFonts() {
  try {
    await Promise.all([
      document.fonts.load(`16px ${FONTS.stencil}`),
      document.fonts.load(`700 16px ${FONTS.stencilHeavy}`),
      document.fonts.load(`16px ${FONTS.type}`),
      document.fonts.load(`16px ${FONTS.mono}`),
    ]);
  } catch { /* fall back to the stack */ }
}
