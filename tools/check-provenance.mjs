#!/usr/bin/env node
// Reports which metadata and provenance blocks an image carries, without modifying it (§6.2).
// Usage: node tools/check-provenance.mjs <image> [<image> …]

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** @param {Uint8Array} bytes */
export function inspect(bytes) {
  const b = Buffer.from(bytes);
  if (b[0] === 0xff && b[1] === 0xd8) return inspectJpeg(b);
  if (PNG_SIGNATURE.every((v, i) => b[i] === v)) return inspectPng(b);
  return { format: 'unknown', blocks: [], notes: [] };
}

function xmpNotes(text) {
  const notes = [];
  const source = text.match(/DigitalSourceType(?:="|>)([^"<]+)/);
  if (source) notes.push(`IPTC digital source type: ${source[1]}`);
  if (/c2pa/i.test(text)) notes.push('XMP mentions C2PA');
  return notes;
}

function inspectJpeg(b) {
  const blocks = [];
  const notes = [];
  let i = 2;
  while (i + 4 <= b.length && b[i] === 0xff) {
    const marker = b[i + 1];
    if (marker === 0xda || marker === 0xd9) break; // image data follows; no more metadata segments
    const len = b.readUInt16BE(i + 2);
    const body = b.subarray(i + 4, i + 2 + len);
    const head = body.subarray(0, 40).toString('latin1');
    if (marker === 0xe1 && head.startsWith('Exif')) blocks.push('EXIF');
    else if (marker === 0xe1 && head.startsWith('http://ns.adobe.com/xap/1.0/')) {
      blocks.push('XMP');
      notes.push(...xmpNotes(body.toString('utf8')));
    } else if (marker === 0xe2 && head.startsWith('ICC_PROFILE')) blocks.push('ICC colour profile');
    else if (marker === 0xed) blocks.push('IPTC / Photoshop');
    else if (marker === 0xeb && body.includes('jumb')) blocks.push(body.includes('c2pa') ? 'C2PA manifest (JUMBF)' : 'JUMBF');
    i += 2 + len;
  }
  return { format: 'JPEG', blocks: [...new Set(blocks)], notes };
}

function inspectPng(b) {
  const blocks = [];
  const notes = [];
  let i = 8;
  while (i + 8 <= b.length) {
    const len = b.readUInt32BE(i);
    const type = b.subarray(i + 4, i + 8).toString('latin1');
    const data = b.subarray(i + 8, i + 8 + len);
    if (type === 'eXIf') blocks.push('EXIF');
    else if (type === 'iCCP') blocks.push('ICC colour profile');
    else if (type === 'caBX') blocks.push('C2PA manifest (JUMBF)');
    else if (type === 'iTXt' && data.subarray(0, 17).toString('latin1') === 'XML:com.adobe.xmp') {
      blocks.push('XMP');
      notes.push(...xmpNotes(data.toString('utf8')));
    } else if (type === 'tEXt' || type === 'zTXt' || type === 'iTXt') blocks.push(`text chunk "${data.subarray(0, Math.max(0, data.indexOf(0))).toString('latin1')}"`);
    if (type === 'IEND') break;
    i += 12 + len;
  }
  return { format: 'PNG', blocks: [...new Set(blocks)], notes };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  for (const file of process.argv.slice(2)) {
    const r = inspect(readFileSync(file));
    console.log(`${file}\n  format: ${r.format}\n  blocks: ${r.blocks.length ? r.blocks.join(', ') : 'none'}${r.notes.map((n) => `\n  note: ${n}`).join('')}`);
  }
}
