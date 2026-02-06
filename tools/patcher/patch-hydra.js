#!/usr/bin/env node
/**
 * Hydra Launcher Backend URL Patcher
 * 
 * This script patches the compiled Hydra Launcher to use custom backend URLs.
 * It works on already-built releases without needing to rebuild from source.
 * 
 * Usage:
 *   node patch-hydra.js <hydra-install-path> [options]
 * 
 * Options:
 *   --api-url <url>      API server URL (default: http://localhost:3001)
 *   --auth-url <url>     Auth server URL (default: http://localhost:3001/auth)
 *   --ws-url <url>       WebSocket URL (default: ws://localhost:3001/ws)
 *   --restore            Restore original (if backup exists)
 *   --dry-run            Show what would be changed without making changes
 */

const fs = require('fs');
const path = require('path');
const asar = require('@electron/asar');
require('dotenv').config();

// Load from .env with fallbacks to defaults
const DEFAULT_CONFIG = {
  apiUrl: process.env.API_URL || 'http://localhost:3001',
  authUrl: process.env.AUTH_URL || 'http://localhost:3001/auth',
  wsUrl: process.env.WS_URL || 'ws://localhost:3001/ws',
  nimbusUrl: process.env.NIMBUS_URL || 'http://localhost:3001',
  checkoutUrl: process.env.CHECKOUT_URL || 'http://localhost:3001/checkout',
  assetsUrl: process.env.ASSETS_URL || null,
  launcherSubdomain: 'localhost'
};

// Hydra path from .env (can be overridden by CLI arg)
const ENV_HYDRA_PATH = process.env.HYDRA_PATH || null;

// Known patterns in compiled Hydra builds (these are what we search for and replace)
// Updated based on actual compiled Hydra analysis
const KNOWN_PATTERNS = {
  apiUrl: [
    // Production API endpoints
    'https://hydra-api-us-east-1.losbroxas.org',
    'https://api.hydralauncher.gg',
    // Staging variants
    'https://staging-api.hydralauncher.gg',
    'https://staging-hydra-api.losbroxas.org'
  ],
  authUrl: [
    // Production Auth endpoints  
    'https://auth.hydra.losbroxas.org',
    'https://auth.hydralauncher.gg',
    // Staging variants
    'https://staging-auth.hydralauncher.gg',
    'https://staging-auth.hydra.losbroxas.org'
  ],
  wsUrl: [
    // Production WebSocket endpoints
    'wss://ws.hydralauncher.gg',
    // Staging variants
    'wss://staging-ws.hydralauncher.gg'
  ],
  nimbusUrl: [
    // Production Nimbus API (file hosting)
    'https://api.hydranimbus.com',
    'https://nimbus.hydralauncher.gg',
    // Staging variants
    'https://staging-nimbus.hydralauncher.gg',
    'https://staging-api.hydranimbus.com'
  ],
  checkoutUrl: [
    // Production Checkout endpoints
    'https://checkout.hydralauncher.gg',
    // Staging variants
    'https://staging-checkout.hydralauncher.gg'
  ],
  // Additional URLs that might need patching
  assetsUrl: [
    'https://assets.hydralauncher.gg',
    'https://cdn.losbroxas.org'
  ]
};

function parseArgs(args) {
  const config = { ...DEFAULT_CONFIG };
  let hydraPath = ENV_HYDRA_PATH; // Use .env path as default
  let restore = false;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--api-url':
        config.apiUrl = args[++i];
        break;
      case '--auth-url':
        config.authUrl = args[++i];
        break;
      case '--ws-url':
        config.wsUrl = args[++i];
        break;
      case '--nimbus-url':
        config.nimbusUrl = args[++i];
        break;
      case '--checkout-url':
        config.checkoutUrl = args[++i];
        break;
      case '--restore':
        restore = true;
        break;
      case '--dry-run':
        dryRun = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
      default:
        if (!arg.startsWith('-')) {
          hydraPath = arg; // CLI arg overrides .env
        }
    }
  }

  return { config, hydraPath, restore, dryRun };
}

function printHelp() {
  console.log(`
Hydra Launcher Backend URL Patcher
===================================

Usage:
  node patch-hydra.js <hydra-install-path> [options]

Arguments:
  hydra-install-path    Path to Hydra installation directory
                        (contains resources/app.asar)

Options:
  --api-url <url>       API server URL
                        Default: ${DEFAULT_CONFIG.apiUrl}
  
  --auth-url <url>      Auth server URL  
                        Default: ${DEFAULT_CONFIG.authUrl}
  
  --ws-url <url>        WebSocket server URL
                        Default: ${DEFAULT_CONFIG.wsUrl}
  
  --nimbus-url <url>    Nimbus API URL
                        Default: ${DEFAULT_CONFIG.nimbusUrl}
  
  --checkout-url <url>  Checkout URL
                        Default: ${DEFAULT_CONFIG.checkoutUrl}
  
  --restore             Restore original app.asar from backup
  
  --dry-run             Show changes without applying them

Examples:
  # Patch with default localhost URLs
  node patch-hydra.js "C:\\Program Files\\Hydra"
  
  # Patch with custom URLs
  node patch-hydra.js "C:\\Program Files\\Hydra" \\
    --api-url https://my-api.example.com \\
    --ws-url wss://my-ws.example.com/ws
  
  # Restore original
  node patch-hydra.js "C:\\Program Files\\Hydra" --restore
`);
}

function findAsarPath(hydraPath) {
  // Possible locations for app.asar
  const possiblePaths = [
    path.join(hydraPath, 'resources', 'app.asar'),
    path.join(hydraPath, 'Resources', 'app.asar'), // macOS
    path.join(hydraPath, 'app.asar'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return null;
}

function createBackup(asarPath) {
  const backupPath = asarPath + '.backup';
  
  if (!fs.existsSync(backupPath)) {
    console.log(`📦 Creating backup at: ${backupPath}`);
    fs.copyFileSync(asarPath, backupPath);
  } else {
    console.log(`📦 Backup already exists: ${backupPath}`);
  }
  
  return backupPath;
}

function restoreBackup(asarPath) {
  const backupPath = asarPath + '.backup';
  
  if (fs.existsSync(backupPath)) {
    console.log(`🔄 Restoring from backup...`);
    fs.copyFileSync(backupPath, asarPath);
    console.log(`✅ Restored successfully!`);
    return true;
  } else {
    console.error(`❌ No backup found at: ${backupPath}`);
    return false;
  }
}

function patchContent(content, config, dryRun) {
  let patchedContent = content;
  let changeCount = 0;
  const changes = [];

  // Replace API URLs
  for (const pattern of KNOWN_PATTERNS.apiUrl) {
    if (patchedContent.includes(pattern)) {
      changes.push(`API: ${pattern} → ${config.apiUrl}`);
      if (!dryRun) {
        patchedContent = patchedContent.split(pattern).join(config.apiUrl);
      }
      changeCount++;
    }
  }

  // Replace Auth URLs
  for (const pattern of KNOWN_PATTERNS.authUrl) {
    if (patchedContent.includes(pattern)) {
      changes.push(`AUTH: ${pattern} → ${config.authUrl}`);
      if (!dryRun) {
        patchedContent = patchedContent.split(pattern).join(config.authUrl);
      }
      changeCount++;
    }
  }

  // Replace WebSocket URLs
  for (const pattern of KNOWN_PATTERNS.wsUrl) {
    if (patchedContent.includes(pattern)) {
      changes.push(`WS: ${pattern} → ${config.wsUrl}`);
      if (!dryRun) {
        patchedContent = patchedContent.split(pattern).join(config.wsUrl);
      }
      changeCount++;
    }
  }

  // Replace Nimbus URLs
  for (const pattern of KNOWN_PATTERNS.nimbusUrl) {
    if (patchedContent.includes(pattern)) {
      changes.push(`NIMBUS: ${pattern} → ${config.nimbusUrl}`);
      if (!dryRun) {
        patchedContent = patchedContent.split(pattern).join(config.nimbusUrl);
      }
      changeCount++;
    }
  }

  // Replace Checkout URLs
  for (const pattern of KNOWN_PATTERNS.checkoutUrl) {
    if (patchedContent.includes(pattern)) {
      changes.push(`CHECKOUT: ${pattern} → ${config.checkoutUrl}`);
      if (!dryRun) {
        patchedContent = patchedContent.split(pattern).join(config.checkoutUrl);
      }
      changeCount++;
    }
  }

  // Replace Assets/CDN URLs (optional)
  if (config.assetsUrl) {
    for (const pattern of KNOWN_PATTERNS.assetsUrl) {
      if (patchedContent.includes(pattern)) {
        changes.push(`ASSETS: ${pattern} → ${config.assetsUrl}`);
        if (!dryRun) {
          patchedContent = patchedContent.split(pattern).join(config.assetsUrl);
        }
        changeCount++;
      }
    }
  }

  return { patchedContent, changeCount, changes };
}

async function patchAsar(asarPath, config, dryRun) {
  const tempDir = path.join(path.dirname(asarPath), 'app-temp');
  
  console.log(`\n📂 Extracting ${asarPath}...`);
  
  // Extract asar
  asar.extractAll(asarPath, tempDir);
  
  // Find all JS files in the output directory
  const jsFiles = [];
  
  function findJsFiles(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        findJsFiles(fullPath);
      } else if (file.endsWith('.js') || file.endsWith('.mjs')) {
        jsFiles.push(fullPath);
      }
    }
  }
  
  findJsFiles(tempDir);
  
  console.log(`📝 Found ${jsFiles.length} JavaScript files to process`);
  
  let totalChanges = 0;
  const allChanges = [];
  
  for (const jsFile of jsFiles) {
    const content = fs.readFileSync(jsFile, 'utf8');
    const { patchedContent, changeCount, changes } = patchContent(content, config, dryRun);
    
    if (changeCount > 0) {
      const relativePath = path.relative(tempDir, jsFile);
      console.log(`  🔧 ${relativePath}: ${changeCount} replacement(s)`);
      allChanges.push(...changes.map(c => `    ${c}`));
      
      if (!dryRun) {
        fs.writeFileSync(jsFile, patchedContent, 'utf8');
      }
      totalChanges += changeCount;
    }
  }
  
  if (allChanges.length > 0) {
    console.log(`\n📋 Changes:`);
    for (const change of allChanges) {
      console.log(change);
    }
  }
  
  if (!dryRun && totalChanges > 0) {
    console.log(`\n📦 Repacking asar...`);
    await asar.createPackage(tempDir, asarPath);
    console.log(`✅ Patched successfully! ${totalChanges} URL(s) replaced.`);
  } else if (dryRun) {
    console.log(`\n🔍 Dry run complete. ${totalChanges} URL(s) would be replaced.`);
  } else {
    console.log(`\n⚠️ No matching URLs found to patch.`);
  }
  
  // Cleanup temp directory
  fs.rmSync(tempDir, { recursive: true, force: true });
  
  return totalChanges;
}

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║           Hydra Launcher Backend URL Patcher              ║
║                                                           ║
║  Patch Hydra to use your own backend without rebuilding   ║
╚═══════════════════════════════════════════════════════════╝
`);

  const args = process.argv.slice(2);
  
  // Allow running with no args if .env has HYDRA_PATH configured
  if (args.length === 0 && !ENV_HYDRA_PATH) {
    printHelp();
    process.exit(1);
  }
  
  const { config, hydraPath, restore, dryRun } = parseArgs(args);
  
  if (!hydraPath) {
    console.error('❌ Error: Please specify the Hydra installation path');
    console.error('   Set HYDRA_PATH in .env or pass it as an argument');
    printHelp();
    process.exit(1);
  }
  
  console.log(`📍 Using configuration from: ${ENV_HYDRA_PATH ? '.env file' : 'command line'}`);
  
  if (!fs.existsSync(hydraPath)) {
    console.error(`❌ Error: Path does not exist: ${hydraPath}`);
    process.exit(1);
  }
  
  const asarPath = findAsarPath(hydraPath);
  
  if (!asarPath) {
    console.error(`❌ Error: Could not find app.asar in: ${hydraPath}`);
    console.error('   Make sure you provided the Hydra installation directory.');
    process.exit(1);
  }
  
  console.log(`📍 Found app.asar: ${asarPath}`);
  
  if (restore) {
    restoreBackup(asarPath);
    return;
  }
  
  if (dryRun) {
    console.log(`\n🔍 DRY RUN MODE - No changes will be made\n`);
  } else {
    // Create backup before patching
    createBackup(asarPath);
  }
  
  console.log(`\n🎯 Target URLs:`);
  console.log(`   API:      ${config.apiUrl}`);
  console.log(`   Auth:     ${config.authUrl}`);
  console.log(`   WS:       ${config.wsUrl}`);
  console.log(`   Nimbus:   ${config.nimbusUrl}`);
  console.log(`   Checkout: ${config.checkoutUrl}`);
  
  try {
    await patchAsar(asarPath, config, dryRun);
  } catch (error) {
    console.error(`\n❌ Error during patching:`, error.message);
    process.exit(1);
  }
}

main().catch(console.error);
