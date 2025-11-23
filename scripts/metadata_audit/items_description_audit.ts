import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const RPC = process.env.RPC;
const ITEM = process.env.ITEM_V1;

if (!RPC || !ITEM) {
  throw new Error('Missing required environment variables RPC or ITEM_V1');
}

function runCast(cmd: string): string {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

interface AuditResult {
  id: number;
  name: string;
  description: string;
  hasImage: boolean;
}

interface FullMetadata {
  id: number;
  full_metadata: any;
}

const results: AuditResult[] = [];
const fullMetadata: FullMetadata[] = [];

for (let id = 0; id < 64; id++) {
  console.log(`Auditing token ID: ${id}...`);

  const raw = runCast(`cast call ${ITEM} "uri(uint256)(string)" ${id} --rpc-url ${RPC}`);

  // Remove quotes if present
  const cleaned = raw.trim().replace(/^"|"$/g, '');

  if (!cleaned.startsWith('data:application/json;base64,')) {
    throw new Error(`Token ${id} metadata missing base64 data URI prefix`);
  }

  const b64 = cleaned.replace('data:application/json;base64,', '');
  const jsonBuf = Buffer.from(b64, 'base64');
  const decoded = JSON.parse(jsonBuf.toString('utf8'));

  const name = decoded.name || '';
  const description = decoded.description || '';
  const image = decoded.image || '';

  if (!name) throw new Error(`Token ${id} missing name field`);
  if (!description) throw new Error(`Token ${id} missing description field`);
  if (!image) throw new Error(`Token ${id} missing image field`);
  if (!image.startsWith('data:image/png;base64,')) {
    throw new Error(`Token ${id} image field is not a PNG data URI`);
  }

  results.push({
    id,
    name,
    description: description.slice(0, 120) + (description.length > 120 ? '...' : ''),
    hasImage: true
  });

  fullMetadata.push({
    id,
    full_metadata: decoded
  });
}

const auditPath = path.join(process.cwd(), 'descriptions_audit.json');
const fullMetadataPath = path.join(process.cwd(), 'descriptions_audit_full.json');

fs.writeFileSync(auditPath, JSON.stringify(results, null, 2));
fs.writeFileSync(fullMetadataPath, JSON.stringify(fullMetadata, null, 2));

console.log('\n=== ITEM DESCRIPTION AUDIT COMPLETE ===');
console.table(results);
console.log(`\nFull metadata written to: ${auditPath}`);
console.log(`Full metadata (complete) written to: ${fullMetadataPath}`);


