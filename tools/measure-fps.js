// Frame-rate probe for the campaign map (M2, V2): ≥ 55 fps median while panning and zooming, all layers on.
//
// Paste it into the browser's console on the game page with the map showing (not the list), and keep the window
// in front: a hidden window slows its animation frames. It drives the map as a player would, with synthetic
// input: zooming from the whole theatre to the closest view, dragging the map around at the local and operations
// zooms, zooming back out, and playing the last turn again if there is one. It measures the time between
// animation frames in each phase. It changes nothing but the map's view, which it leaves on the whole theatre,
// and sends nothing anywhere.

(async () => {
  const svg = document.querySelector('svg.map');
  if (!svg) throw new Error('No map on the page: show the map, not the list.');
  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const centre = () => {
    const r = svg.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  const key = (k) => svg.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  /** Zoom as a trackpad pinch does (Ctrl + wheel), about the map's centre: about 0.5 wheel units a millisecond. */
  const wheel = (deltaY) => svg.dispatchEvent(new WheelEvent('wheel', { deltaY, ctrlKey: true, clientX: centre().x, clientY: centre().y, bubbles: true, cancelable: true }));
  const pointer = (type, x, y) => svg.dispatchEvent(new PointerEvent(type, { pointerId: 77, isPrimary: true, pointerType: 'mouse', button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y, bubbles: true, cancelable: true }));

  /** Runs `step(ms since the last frame, ms since the start)` once a frame for `ms`; returns the frame-time figures. */
  async function phase(name, ms, step = () => {}) {
    const times = [];
    let last = await nextFrame();
    const start = last;
    while (last - start < ms) {
      step(times.length === 0 ? 16 : times[times.length - 1], last - start);
      const now = await nextFrame();
      times.push(now - last);
      last = now;
    }
    const sorted = [...times].sort((a, b) => a - b);
    const at = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
    return {
      phase: name,
      frames: times.length,
      medianFps: Math.round(10_000 / at(0.5)) / 10,
      // The slowest twentieth of the frames: what a stutter would show.
      worst5PercentFps: Math.round(10_000 / at(0.95)) / 10,
      framesOver25ms: times.filter((t) => t > 25).length,
      band: document.querySelector('.map-band')?.textContent ?? null,
      // About one frame a second: the window was hidden or covered during this phase, which then measures nothing.
      throttled: sorted.length > 0 && at(0.5) > 200,
    };
  }

  /** A drag in a slow circle, about 7 screen pixels a frame at 60 fps, so the view stays on the map. */
  async function drag(name, ms) {
    // Synthetic pointers cannot be captured; the map captures a drag only to keep it when the pointer leaves.
    const capture = svg.setPointerCapture;
    svg.setPointerCapture = () => {};
    let { x, y } = centre();
    pointer('pointerdown', x, y);
    const result = await phase(name, ms, (dt, t) => {
      x += Math.cos(t / 400) * 0.42 * dt;
      y += Math.sin(t / 400) * 0.42 * dt;
      pointer('pointermove', x, y);
    });
    pointer('pointerup', x, y);
    svg.setPointerCapture = capture;
    // The map ignores the click that ends a drag; this one only clears that, and lands on no place.
    svg.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return result;
  }

  // What the map draws before the probe starts: the layers measured.
  const count = (selector) => document.querySelectorAll(selector).length;
  const layers = {
    roads: count('.road'),
    places: count('.place'),
    groups: count('.friend'),
    enemies: count('.enemy'),
    supplyLines: count('.supply'),
    districts: count('.district'),
    dust: count('.dust'),
    mud: count('.mud-wash'),
    scars: count('.scar'),
    trails: count('.trail'),
    planned: count('.planned'),
    raining: document.querySelector('.rain-overlay.raining') !== null,
    rivers: count('.river'),
    terrain: document.querySelector('.terrain image') !== null,
  };
  const screen = { mapWidthPx: Math.round(svg.getBoundingClientRect().width), devicePixelRatio: window.devicePixelRatio };

  const results = [];
  key('0');
  results.push(await phase('still, whole theatre', 2000));
  results.push(await phase('zooming in, theatre to local', 2500, (dt) => wheel(-0.5 * dt)));
  results.push(await drag('dragging, local', 2500));
  results.push(await phase('zooming out to operations', 1200, (dt) => wheel(0.5 * dt)));
  results.push(await drag('dragging, operations', 2500));
  results.push(await phase('zooming out to the theatre', 1600, (dt) => wheel(0.5 * dt)));
  key('0');
  const again = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Play the last turn again');
  if (again) {
    again.click();
    results.push(await phase('playing the last turn', 3500));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  }
  // A window that is hidden or behind another gets about one frame a second: such a phase measures nothing.
  const throttled = results.filter((r) => r.throttled).map((r) => r.phase);
  return { throttled, results, screen, layers };
})();
