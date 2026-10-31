import { RULES_VERSION } from '../engine';

// Placeholder shell; the debug map for the M1 prototype replaces it.
export function App() {
  return (
    <main style={{ fontFamily: 'Georgia, serif', maxWidth: 640, margin: '15vh auto', padding: '0 16px', lineHeight: 1.5 }}>
      <h1 style={{ fontWeight: 400 }}>The Weight of Empire</h1>
      <p>Foundations in progress: simulation core, rules {RULES_VERSION}.</p>
    </main>
  );
}
