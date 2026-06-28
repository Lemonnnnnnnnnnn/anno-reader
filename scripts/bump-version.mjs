#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const args = process.argv.slice(2);
const version = args.find(a => !a.startsWith('-'));
const dryRun = args.includes('--dry-run');

if (!version) {
  console.error('Error: Version argument required');
  console.error('Usage: node scripts/bump-version.mjs <version> [--dry-run]');
  console.error('Example: node scripts/bump-version.mjs 0.2.0');
  process.exit(1);
}

// Validate semver format
if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(version)) {
  console.error('Error: Invalid version format. Expected semver (e.g., 1.0.0, 0.2.0-beta.1)');
  process.exit(1);
}

const run = (cmd, opts = {}) => {
  if (dryRun) {
    console.log(`  [dry-run] ${cmd}`);
  } else {
    execSync(cmd, { stdio: 'inherit', ...opts });
  }
};

console.log(`Bumping version to ${version}...`);

// Update package.json
const pkgPath = 'package.json';
const pkg = readFileSync(pkgPath, 'utf8');
if (!dryRun) {
  writeFileSync(pkgPath, pkg.replace(/"version": "[^"]*"/, `"version": "${version}"`));
}
console.log('  Updated package.json');

// Update Cargo.toml
const cargoPath = 'src-tauri/Cargo.toml';
const cargo = readFileSync(cargoPath, 'utf8');
if (!dryRun) {
  writeFileSync(cargoPath, cargo.replace(/^version = "[^"]*"/m, `version = "${version}"`));
}
console.log('  Updated src-tauri/Cargo.toml');

// Update Cargo.lock
console.log('  Updating Cargo.lock...');
run('cargo check --quiet', { cwd: 'src-tauri', stdio: 'ignore' });
console.log('  Updated Cargo.lock');

// Git operations
console.log('\nCommitting changes...');
run('git add -A');
run(`git commit -m "chore: bump version to ${version}"`);

console.log('\nTagging...');
run(`git tag v${version}`);

console.log('\nPushing...');
run('git push');
run('git push --tags');

console.log(`\n✓ Released v${version}`);