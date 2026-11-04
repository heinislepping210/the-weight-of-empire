// Downloads the approved geodata (download batch 1, approved 4 November 2026; MAP_AND_GEOGRAPHY §3.7) into
// assets-incoming/geo/, which git ignores, and records each file's source, licence, size and SHA-256 hash in
// tools/geo/manifest.json, which is committed. A file already present is kept if its hash matches the manifest.
// Run: node tools/geo/fetch.mjs. Nothing here needs an account, and nothing is sent anywhere but the requests.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, 'assets-incoming', 'geo');
const manifestPath = join(root, 'tools', 'geo', 'manifest.json');
const USER_AGENT = 'the-weight-of-empire geodata fetch (https://github.com/heinislepping210/the-weight-of-empire)';

const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson';
const NE_LICENCE = 'Public domain (Natural Earth terms of use; no permission or attribution needed)';
const SRTM_LICENCE = 'Public domain (SRTM, with GMTED2010 and ETOPO1 filling any voids); credit: "SRTM data courtesy of the U.S. Geological Survey"';
const COMMONS = 'https://upload.wikimedia.org/wikipedia/commons';
const PD_MAP = 'Public domain; Library of Congress, no known restrictions (Wikimedia Commons file record)';

/** Download batch 1. Nothing outside this list is fetched. */
const SOURCES = [
  ...['rivers_europe', 'rivers_lake_centerlines', 'lakes', 'lakes_europe'].map((layer) => ({
    id: `ne-10m-${layer.replaceAll('_', '-')}`,
    file: `natural-earth/ne_10m_${layer}.geojson`,
    url: `${NE}/ne_10m_${layer}.geojson`,
    licence: NE_LICENCE,
    use: 'rivers and lakes',
  })),
  ...[53, 54, 55].flatMap((lat) =>
    [29, 30, 31, 32, 33].map((lon) => {
      const name = `N${lat}E0${lon}`;
      return { id: `srtm-${name}`, file: `srtm/${name}.hgt.gz`, url: `https://s3.amazonaws.com/elevation-tiles-prod/skadi/N${lat}/${name}.hgt.gz`, licence: SRTM_LICENCE, use: 'relief' };
    }),
  ),
  {
    id: 'piadyshev-vitebsk-1820',
    file: 'period-maps/piadyshev-vitebsk-1820-LOC-2018688646.jpg',
    url: `${COMMONS}/2/21/General%CA%B9nai%EF%B8%A0a%EF%B8%A1_Karta_Vitebsko%C4%AD_Gubernii_S%CA%BA_pokazaniem%CA%BA_pochtovykh%CA%BA_i_bol%CA%B9shikh%CA%BA_proi%EF%B8%A0e%EF%B8%A1zzhikh%CA%BA_dorog%CA%BA%2C_stant%EF%B8%A0s%EF%B8%A1i%C4%AD_i_razstoi%EF%B8%A0a%EF%B8%A1nii%EF%B8%A0a%EF%B8%A1_mezhdu_onymi_verst%CA%BA._LOC_2018688646.jpg`,
    licence: PD_MAP,
    use: 'checking roads and rivers (Piadyshev, Geographical Atlas of the Russian Empire, Vitebsk province, 1820)',
  },
  {
    id: 'piadyshev-mogilev-1821',
    file: 'period-maps/piadyshev-mogilev-1821-LOC-2018688648.jpg',
    url: `${COMMONS}/a/a4/General%CA%B9nai%EF%B8%A0a%EF%B8%A1_Karta_Mogilevsko%C4%AD_Gubernii_S%CA%BA_pokazaniem%CA%BA_pochtovykh%CA%BA_i_bol%CA%B9shikh%CA%BA_proi%EF%B8%A0e%EF%B8%A1zzhikh%CA%BA_dorog%CA%BA%2C_stant%EF%B8%A0s%EF%B8%A1i%C4%AD_i_razstoi%EF%B8%A0a%EF%B8%A1nii%EF%B8%A0a%EF%B8%A1_mezhdu_onymi_verst%CA%BA._LOC_2018688648.jpg`,
    licence: PD_MAP,
    use: 'checking roads and rivers (Piadyshev, Mogilev province, 1821)',
  },
  {
    id: 'piadyshev-smolensk-1821',
    file: 'period-maps/piadyshev-smolensk-1821-LOC-2018688655.jpg',
    url: `${COMMONS}/8/8b/General%CA%B9nai%EF%B8%A0a%EF%B8%A1_Karta_Smolensko%C4%AD_Gubernii_S%CA%BA_pokazaniem%CA%BA_pochtovykh%CA%BA_i_bol%CA%B9shikh%CA%BA_proi%EF%B8%A0e%EF%B8%A1zzhikh%CA%BA_dorog%CA%BA%2C_stant%EF%B8%A0s%EF%B8%A1i%C4%AD_i_razstoi%EF%B8%A0a%EF%B8%A1nii%EF%B8%A0a%EF%B8%A1_mezhdu_onymi_verst%CA%BA._LOC_2018688655.jpg`,
    licence: PD_MAP,
    use: 'checking roads and rivers (Piadyshev, Smolensk province, 1821)',
  },
];

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const previous = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { files: [] };
const known = new Map(previous.files.map((f) => [f.id, f]));
const files = [];

for (const s of SOURCES) {
  const path = join(out, s.file);
  const before = known.get(s.id);
  if (before && existsSync(path) && sha256(readFileSync(path)) === before.sha256) {
    files.push(before);
    console.log(`kept      ${s.file}`);
    continue;
  }
  const res = await fetch(s.url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${s.url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buf);
  const entry = { id: s.id, file: s.file, url: s.url, licence: s.licence, use: s.use, bytes: buf.length, sha256: sha256(buf), obtained: new Date().toISOString().slice(0, 10) };
  // A file whose hash changed since it was last recorded is reported: the source has changed under us.
  if (before && before.sha256 !== entry.sha256) console.log(`CHANGED   ${s.file} (was ${before.sha256.slice(0, 12)})`);
  files.push(entry);
  console.log(`fetched   ${s.file}  ${(buf.length / 1e6).toFixed(1)} MB`);
}

writeFileSync(manifestPath, `${JSON.stringify({ batch: 'download batch 1, approved 2026-11-04', files }, null, 2)}\n`);
console.log(`${files.length} files, ${(files.reduce((n, f) => n + f.bytes, 0) / 1e6).toFixed(1)} MB; manifest at tools/geo/manifest.json`);
