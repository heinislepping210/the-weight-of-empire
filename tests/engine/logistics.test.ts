import { describe, expect, it } from 'vitest';
import { RULES, advance, createContext, newGame, planLogistics, submit } from '../../src/engine';
import type { Context, Directive, GameState, Input, LogisticsOrders } from '../../src/engine';
import { vitebskDecision } from '../../src/data/vitebsk/scenario';
import { stepUntil } from '../fixtures/driver';
import { forceInit, testGround, passiveContext } from '../fixtures/testGround';

function withLogistics(s: GameState, ctx: Context, logistics: LogisticsOrders) {
  return submit(s, { kind: 'orders', turn: s.resolution.turn, orders: [], logistics }, ctx);
}

function ordered(s: GameState, ctx: Context, logistics: LogisticsOrders): GameState {
  const result = withLogistics(s, ctx, logistics);
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

const at = (slot: number, stage: string) => (s: GameState) => s.resolution.slot === slot && s.resolution.stage === stage;

describe('captured stores (§2.6)', () => {
  it('a depot left to the enemy changes hands at the end of the sub-step, much of it burned first', () => {
    const ctx = passiveContext(testGround((s) => (forceInit(s, 'fr-flank').at = 'F')));
    const start = newGame(ctx, 3);
    const result = advance(start, { kind: 'orders', turn: 1, orders: [] }, ctx);
    if (!result.ok) throw new Error(result.reason);
    const s = stepUntil(ordered(start, ctx, {}), ctx, at(1, 'activity'));
    const depot = s.depots.F!;
    expect(depot.side).toBe('fr');
    const burned = s.ledger.destroyed.food;
    expect(depot.stock.food + burned).toBe(400_000);
    expect(burned).toBeGreaterThanOrEqual(Math.floor((400_000 * RULES.capture.burnMinPermille) / 1000));
    expect(burned).toBeLessThanOrEqual(Math.floor((400_000 * RULES.capture.burnMaxPermille) / 1000));
    expect(result.log.some((e) => e.kind === 'depotCaptured' && e.detail.node === 'F' && e.detail.by === 'fr')).toBe(true);
  });

  it('the captors draw on what was saved from the fire', () => {
    // Without fodder of its own the flank has room to carry four days' food (G-019).
    const ctx = passiveContext(
      testGround((s) => {
        forceInit(s, 'fr-flank').at = 'F';
        forceInit(s, 'fr-flank').stock.fodder = 0;
      }),
    );
    const s = stepUntil(ordered(newGame(ctx, 3), ctx, {}), ctx, at(1, 'night'));
    expect(s.forces['fr-flank']!.stock.food).toBe(20_000 * RULES.depotIssue.foodDays);
  });

  it('the burned share is drawn from the seed: the same on replay', () => {
    const ctx = passiveContext(testGround((s) => (forceInit(s, 'fr-flank').at = 'F')));
    const burned = (seed: number) => stepUntil(ordered(newGame(ctx, seed), ctx, {}), ctx, at(1, 'activity')).ledger.destroyed.food;
    expect(burned(5)).toBe(burned(5));
    expect(new Set([1, 2, 3, 4, 5, 6, 7, 8].map(burned)).size).toBeGreaterThan(1);
  });

  it('a depot its own side still holds does not fall; trains based at a lost depot fall back on the nearest remaining one', () => {
    const ctx = passiveContext(
      testGround((s) => {
        forceInit(s, 'fr-flank').at = 'G';
        forceInit(s, 'ru-post').at = 'A';
        s.depots.push({ node: 'G', side: 'fr', stock: { food: 50_000, fodder: 10_000, ammo: 1_000 } });
      }),
    );
    const s = stepUntil(ordered(newGame(ctx, 4), ctx, {}), ctx, at(1, 'activity'));
    expect(s.depots.A!.side).toBe('ru');
    expect(s.depots.G!.side).toBe('fr');
    expect(s.convoys['cv-fr-1']!.home).toBe('G');
  });
});

describe('forward depots and line trains (§2.6)', () => {
  // The main body carries little fodder, so it has room to draw on a depot (G-019).
  const lineGround = () =>
    passiveContext(
      testGround((s) => {
        s.convoys.push({ id: 'cv-line', side: 'fr', home: 'A', wagons: 100 });
        forceInit(s, 'fr-main').stock.fodder = 2_000;
      }),
    );

  it('a depot can be founded only where French troops hold the ground and no depot stands', () => {
    const ctx = lineGround();
    const s = newGame(ctx, 1);
    expect(withLogistics(s, ctx, { foundDepot: 'C' }).ok).toBe(false); // nobody there
    expect(withLogistics(s, ctx, { foundDepot: 'D' }).ok).toBe(false); // the Russian army stands there
    expect(withLogistics(s, ctx, { foundDepot: 'A' }).ok).toBe(false); // a depot already
    expect(withLogistics(s, ctx, { foundDepot: 'nowhere' }).ok).toBe(false);
    const founded = withLogistics(s, ctx, { foundDepot: 'B' });
    if (!founded.ok) throw new Error(founded.reason);
    expect(founded.state.depots.B).toEqual({ node: 'B', side: 'fr', stock: { food: 0, fodder: 0, ammo: 0 }, incoming: { food: 0, fodder: 0, ammo: 0 } });
    expect(founded.log.some((e) => e.kind === 'depotFounded' && e.detail.node === 'B')).toBe(true);
  });

  it('wagon-train orders must give each train one task based at a French depot', () => {
    const ctx = lineGround();
    const s = newGame(ctx, 1);
    const rejected = (logistics: LogisticsOrders) => !withLogistics(s, ctx, logistics).ok;
    expect(rejected({ convoys: [{ convoy: 'cv-nowhere', home: 'A', serves: 'fr-main' }] })).toBe(true);
    expect(rejected({ convoys: [{ convoy: 'cv-line', home: 'A' }] })).toBe(true);
    expect(rejected({ convoys: [{ convoy: 'cv-line', home: 'A', serves: 'fr-main', feeds: 'A' }] })).toBe(true);
    expect(rejected({ convoys: [{ convoy: 'cv-line', home: 'F', serves: 'fr-main' }] })).toBe(true); // a Russian depot
    expect(rejected({ convoys: [{ convoy: 'cv-line', home: 'A', serves: 'ru-main' }] })).toBe(true);
    expect(rejected({ convoys: [{ convoy: 'cv-line', home: 'A', feeds: 'B' }] })).toBe(true); // no depot at B yet
    expect(rejected({ convoys: [{ convoy: 'cv-line', home: 'A', serves: 'fr-main' }, { convoy: 'cv-line', home: 'A', serves: 'fr-flank' }] })).toBe(true);
    expect(rejected({ foundDepot: 'B', convoys: [{ convoy: 'cv-line', home: 'A', feeds: 'B' }] })).toBe(false);
  });

  it('a line train with no orders stands idle at its depot', () => {
    const ctx = lineGround();
    const s = stepUntil(ordered(newGame(ctx, 1), ctx, {}), ctx, at(3, 'night'));
    expect(s.convoys['cv-line']).toMatchObject({ at: 'A', leg: 'loading', transit: null, cargo: { food: 0, fodder: 0, ammo: 0 } });
  });

  it('a line train stocks a forward depot, and troops there draw on it', () => {
    const ctx = lineGround();
    let s = ordered(newGame(ctx, 1), ctx, { foundDepot: 'B', convoys: [{ convoy: 'cv-line', home: 'A', feeds: 'B' }] });
    // Loaded at A in the first sub-step; 8 km to B on the post road by the next.
    s = stepUntil(s, ctx, at(1, 'night'));
    const { payloadGrams, loadPermille } = RULES.convoy;
    const load = Math.floor((100 * payloadGrams * loadPermille.food) / 1000 / RULES.gramsPerUnit.food);
    expect(s.depots.B!.stock.food).toBe(load);
    expect(s.convoys['cv-line']!.leg).toBe('returning');
    // The stores join the depot only at the end of the sub-step, so the main body draws on them the next morning.
    s = stepUntil(s, ctx, at(2, 'activity'));
    const before = s.forces['fr-main']!.stock.food;
    s = stepUntil(s, ctx, at(3, 'activity'));
    expect(s.depots.B!.stock.food).toBeLessThan(load);
    expect(s.forces['fr-main']!.stock.food).toBeGreaterThan(before);
  });

  it("a group's wagon train ordered to a new depot leaves its old one empty and goes there to load", () => {
    const ctx = lineGround();
    let s = ordered(newGame(ctx, 1), ctx, { foundDepot: 'B', convoys: [{ convoy: 'cv-fr-1', home: 'B', serves: 'fr-main' }] });
    expect(s.convoys['cv-fr-1']).toMatchObject({ leg: 'returning', at: 'A', home: 'B' });
    s = stepUntil(s, ctx, at(0, 'contacts'));
    expect(s.convoys['cv-fr-1']).toMatchObject({ leg: 'loading', at: 'B' });
  });
});

describe('the staff plans supply (§2.6)', () => {
  const ctx = createContext(vitebskDecision());
  const directive = (over: Partial<Directive>): Directive => ({ objective: 'smolensk-north', axis: null, tempo: 'steady', posture: 'concentrated', engagement: 'seek', holdBack: [], logistics: 'forward', ...over });

  it('keeping the depots changes nothing', () => {
    const plan = planLogistics(newGame(ctx, 1812), ctx, directive({ logistics: 'hold' }));
    expect(plan.orders).toBeNull();
    expect(plan.reasons).toHaveLength(1);
  });

  it('bringing depots forward founds one where the army stands, within a line train’s haul, and sends each line train from its own depot', () => {
    const s = newGame(ctx, 1812);
    const plan = planLogistics(s, ctx, directive({}));
    expect(plan.orders?.foundDepot).toBe('liozno');
    expect(plan.orders?.convoys).toEqual([
      { convoy: 'cv-line-orsha', home: 'orsha', feeds: 'liozno' },
      { convoy: 'cv-line-vitebsk', home: 'vitebsk', feeds: 'liozno' },
    ]);
    expect(plan.reasons.some((r) => r.startsWith('Found a depot at Liozno'))).toBe(true);
    const input: Input = { kind: 'orders', turn: 1, orders: [], logistics: plan.orders ?? {} };
    expect(advance(s, input, ctx).ok).toBe(true);
  });

  it('leaves a loaded line train to finish its delivery', () => {
    let s = newGame(ctx, 1812);
    const first = planLogistics(s, ctx, directive({}));
    const r = advance(s, { kind: 'orders', turn: 1, orders: [], logistics: first.orders ?? {} }, ctx);
    if (!r.ok) throw new Error(r.reason);
    s = r.state;
    const loaded = Object.values(s.convoys).filter((c) => c.serves === null && c.leg === 'outbound');
    expect(loaded.length).toBeGreaterThan(0);
    const again = planLogistics(s, ctx, directive({ objective: 'krasnyi' }));
    for (const c of loaded) expect(again.orders?.convoys?.some((o) => o.convoy === c.id) ?? false).toBe(false);
  });
});
