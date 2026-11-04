// The map camera (TECHNICAL_ARCHITECTURE §3.1): what part of the theatre the map shows, as an SVG view box in map
// units. Pure functions, so pan, zoom and the zoom bands can be tested without a browser.

export interface Camera {
  /** The view box: the top-left corner and the width shown, in map units; the height follows the map's shape. */
  x: number;
  y: number;
  width: number;
}

export interface World {
  width: number;
  height: number;
}

/** How far in the camera may go: a fifth of the map's width across at the closest. */
export const MAX_ZOOM = 5;

/** The three zoom bands of the Living Map (M2, V2): what the map draws depends on them. */
export type Band = 'theatre' | 'operations' | 'local';

/** The whole theatre in view. */
export const fit = (world: World): Camera => ({ x: 0, y: 0, width: world.width });

export const zoomOf = (world: World, c: Camera) => world.width / c.width;

export const heightOf = (world: World, c: Camera) => (c.width * world.height) / world.width;

export function bandOf(world: World, c: Camera): Band {
  const z = zoomOf(world, c);
  return z < 1.75 ? 'theatre' : z < 3.5 ? 'operations' : 'local';
}

/** Keeps the view on the map: never wider than the map, never closer than MAX_ZOOM, never off its edges. */
export function clamp(world: World, c: Camera): Camera {
  const width = Math.min(world.width, Math.max(world.width / MAX_ZOOM, c.width));
  const height = heightOf(world, { ...c, width });
  return {
    width,
    x: Math.min(world.width - width, Math.max(0, c.x)),
    y: Math.min(world.height - height, Math.max(0, c.y)),
  };
}

/**
 * Zooms by `factor` (above 1 closer, below 1 further) about a point given as a fraction of the view across and down,
 * so that the place under the pointer stays under it.
 */
export function zoomAbout(world: World, c: Camera, factor: number, fx = 0.5, fy = 0.5): Camera {
  const width = Math.min(world.width, Math.max(world.width / MAX_ZOOM, c.width / factor));
  const h0 = heightOf(world, c);
  const h1 = heightOf(world, { ...c, width });
  return clamp(world, { width, x: c.x + fx * (c.width - width), y: c.y + fy * (h0 - h1) });
}

/** Moves the view by a fraction of its own width and height (a drag to the right moves the map right). */
export function panBy(world: World, c: Camera, dxFraction: number, dyFraction: number): Camera {
  return clamp(world, { ...c, x: c.x - dxFraction * c.width, y: c.y - dyFraction * heightOf(world, c) });
}

/** Centres the view on a map point at the present zoom. */
export function centreOn(world: World, c: Camera, x: number, y: number): Camera {
  return clamp(world, { ...c, x: x - c.width / 2, y: y - heightOf(world, c) / 2 });
}

/** The camera's keys: arrows pan a tenth of the view, + and − zoom about the centre, 0 shows the whole theatre. */
export function onKey(world: World, c: Camera, key: string): Camera | null {
  switch (key) {
    case 'ArrowLeft':
      return panBy(world, c, 0.1, 0);
    case 'ArrowRight':
      return panBy(world, c, -0.1, 0);
    case 'ArrowUp':
      return panBy(world, c, 0, 0.1);
    case 'ArrowDown':
      return panBy(world, c, 0, -0.1);
    case '+':
    case '=':
      return zoomAbout(world, c, 1.25);
    case '-':
    case '_':
      return zoomAbout(world, c, 1 / 1.25);
    case '0':
      return fit(world);
    default:
      return null;
  }
}

export const viewBoxOf = (world: World, c: Camera) => `${c.x} ${c.y} ${c.width} ${heightOf(world, c)}`;
