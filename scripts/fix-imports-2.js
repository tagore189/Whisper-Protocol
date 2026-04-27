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

const replacements = [
  { from: /..\/..\/src\/src\/core\/identity\/identity/g, to: '../../src/core/identity_v2/identity' },
  { from: /..\/mesh\/packet/g, to: '../../connection/mesh/packet' },
  { from: /..\/..\/src\/core\/identity\/identity/g, to: '../../core/identity/identity' },
  { from: /..\/src\/storage\/supabase/g, to: '../storage/supabase' },
  { from: /..\/crypto\/randomBytes/g, to: '../../connection/crypto/randomBytes' },
  { from: /..\/mesh\/router/g, to: '../../connection/mesh/router' },
  { from: /..\/identity\/identity/g, to: '../../core/identity/identity' },
  { from: /..\/src\/discovery\/ble\/advertise/g, to: '../discovery/ble/advertise' },
  { from: /..\/src\/discovery\/ble\/scan/g, to: '../discovery/ble/scan' },
  { from: /..\/backend\/crypto\/encrypt/g, to: '../connection/crypto/encrypt' },
  { from: /..\/backend\/crypto\/keyManager/g, to: '../connection/crypto/keyManager' },
  { from: /..\/src\/core\/identity\/identity/g, to: '../core/identity/identity' },
  { from: /..\/src\/connection\/mesh\/messageStore/g, to: '../connection/mesh/messageStore' },
  { from: /..\/src\/connection\/mesh\/packet/g, to: '../connection/mesh/packet' },
  { from: /..\/..\/src\/core\/identity\/identity/g, to: '../../core/identity/identity' }
];

const files = walkSync(path.join(__dirname, '..', 'src'));
files.push(path.join(__dirname, '..', 'app', '(tabs)', 'mesh.tsx'));
files.push(path.join(__dirname, '..', 'app', 'settings.tsx'));

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content;
  
  if (file.includes('settings.tsx')) {
      newContent = newContent.replace(/import.*?TransportSettingsContext.*?;\n/g, '');
  }

  replacements.forEach(rep => {
    newContent = newContent.replace(rep.from, rep.to);
  });
  
  // also fix src/src
  newContent = newContent.replace(/src\/src\//g, 'src/');

  if (content !== newContent) {
    fs.writeFileSync(file, newContent);
  }
});
