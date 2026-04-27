const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    try {
      if (fs.statSync(dirFile).isDirectory()) {
        if (!dirFile.includes('node_modules') && !dirFile.includes('.git') && !dirFile.includes('.expo')) {
          filelist = walkSync(dirFile, filelist);
        }
      } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        filelist.push(dirFile);
      }
    } catch (e) { }
  });
  return filelist;
};

const mapImports = (content, filePath) => {
  let newContent = content;

  // Simple string replacements for now.
  // We need to account for varying levels of `../`
  const replacements = [
    { from: /['"](.*?)contexts\/BleConnectionContext['"]/g, to: (match, prefix) => `'${prefix}src/connection/BleConnectionContext'` },
    { from: /['"](.*?)contexts\/AppSettingsContext['"]/g, to: (match, prefix) => `'${prefix}src/core/AppSettingsContext'` },
    { from: /['"](.*?)src\/supabase['"]/g, to: (match, prefix) => `'${prefix}src/storage/supabase'` },
    { from: /['"](.*?)constants\/theme['"]/g, to: (match, prefix) => `'${prefix}src/core/constants/theme'` },
    
    // Core (backend/identity)
    { from: /['"](.*?)backend\/identity\/identity['"]/g, to: (match, prefix) => `'${prefix}src/core/identity/identity'` },
    { from: /['"](.*?)backend\/identity\/handShakePayLoad['"]/g, to: (match, prefix) => `'${prefix}src/core/identity/handShakePayLoad'` },
    
    // Core v2 (src/backend/identity)
    { from: /['"](.*?)src\/backend\/identity\/identity['"]/g, to: (match, prefix) => `'${prefix}src/core/identity_v2/identity'` },
    
    // Discovery (backend/ble)
    { from: /['"](.*?)backend\/ble\/([a-zA-Z0-9_-]+)['"]/g, to: (match, prefix, file) => `'${prefix}src/discovery/ble/${file}'` },
    
    // Discovery v2 (src/backend/ble)
    { from: /['"](.*?)src\/backend\/ble\/([a-zA-Z0-9_-]+)['"]/g, to: (match, prefix, file) => `'${prefix}src/discovery/ble_v2/${file}'` },
    
    // Connection (backend/mesh)
    { from: /['"](.*?)backend\/mesh\/([a-zA-Z0-9_-]+)['"]/g, to: (match, prefix, file) => `'${prefix}src/connection/mesh/${file}'` },
    
    // Connection v2 (src/backend/mesh)
    { from: /['"](.*?)src\/backend\/mesh\/([a-zA-Z0-9_-]+)['"]/g, to: (match, prefix, file) => `'${prefix}src/connection/mesh_v2/${file}'` },

    // Connection (backend/peers)
    { from: /['"](.*?)backend\/peers\/([a-zA-Z0-9_-]+)['"]/g, to: (match, prefix, file) => `'${prefix}src/connection/peers/${file}'` },
    
    // Connection Crypto (src/backend/crypto)
    { from: /['"](.*?)src\/backend\/crypto\/([a-zA-Z0-9_-]+)['"]/g, to: (match, prefix, file) => `'${prefix}src/connection/crypto/${file}'` },

    // Chat (backend/msg)
    { from: /['"](.*?)backend\/msg\/([a-zA-Z0-9_-]+)['"]/g, to: (match, prefix, file) => `'${prefix}src/chat/msg/${file}'` },

    // Fix index.ts relative imports in src/core/index.ts
    // In src/core/index.ts: ./ble/scan -> ../discovery/ble_v2/scan
    { from: /['"]\.\/ble\/([a-zA-Z0-9_-]+)['"]/g, to: (match, file) => `'../discovery/ble_v2/${file}'` },
    { from: /['"]\.\/crypto\/([a-zA-Z0-9_-]+)['"]/g, to: (match, file) => `'../connection/crypto/${file}'` },
    { from: /['"]\.\/mesh\/([a-zA-Z0-9_-]+)['"]/g, to: (match, file) => `'../connection/mesh_v2/${file}'` },
    { from: /['"]\.\/identity\/([a-zA-Z0-9_-]+)['"]/g, to: (match, file) => `'./identity_v2/${file}'` },
  ];

  replacements.forEach(rep => {
    newContent = newContent.replace(rep.from, rep.to);
  });

  return newContent;
};

const files = walkSync(path.join(__dirname, '..'));
let changed = 0;
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  let newContent = mapImports(content, file);
  
  if (file.includes('settings.tsx')) {
      newContent = newContent.replace(/import.*?TransportSettingsContext.*?;\n/g, '');
  }

  if (content !== newContent) {
    fs.writeFileSync(file, newContent);
    changed++;
  }
});
console.log(`Updated ${changed} files.`);
