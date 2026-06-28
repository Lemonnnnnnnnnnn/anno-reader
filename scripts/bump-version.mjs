#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const version = process.argv[2];

if (!version) {
  console.error('Error: Version argument required');
  console.error('Usage: node scripts/bump-version.mjs <version>');
  console.error('Example: node scripts/bump-version.mjs 0.2.0');
  process.exit(1);
}

// Validate semver format
if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(version)) {
  console.error('Error: Invalid version format. Expected semver (e.g., 1.0.0, 0.2.0-beta.1)');
  process.exit(1);
}

console.log(`Bumping version to ${version}...`);

// Update package.json
const pkgPath = 'package.json';
const pkg = readFileSync(pkgPath, 'utf8');
writeFileSync(pkgPath, pkg.replace(/"version": "[^"]*"/, `"version": "${version}"`));
console.log('  Updated package.json');

// Update Cargo.toml
const cargoPath = 'src-tauri/Cargo.toml';
const cargo = readFileSync(cargoPath, 'utf8');
writeFileSync(cargoPath, cargo.replace(/^version = "[^"]*"/m, `version = "${version}"`));
console.log('  Updated src-tauri/Cargo.toml');

// Update Cargo.lock
console.log('  Updating Cargo.lock...');
execSync('cargo check --quiet', { cwd: 'src-tauri', stdio: 'ignore' });
console.log('  Updated Cargo.lock');

console.log(`
Version bumped to ${version}

Next steps:
  1. Review changes: git diff
  2. Commit: git add -A && git commit -m "chore: bump version to ${version}"
  3. Tag: git tag v${version}
  4. Push: git push && git push --tags
`);