import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,realpathSync,statSync} from 'node:fs';
import path from 'node:path';

const manifestPath='/manifest.webmanifest';
const workerPath='/sw.js';
const shellFiles=['/index.html',manifestPath,'/assets/icon.svg'];
const supplementaryFiles=['/assets/colorthief-LICENSE.txt','/tests/viewport.html','/tests/notices.html'];
const fixedFiles=new Set([...shellFiles,workerPath,...supplementaryFiles]);
const clientSource=/^\/src\/[\w-][\w.-]*\.(?:mjs|css)$/;
const imageFile=/^\/assets\/[\w-][\w.-]*\.(?:png|svg)$/;
const types={
 '.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
 '.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
 '.svg':'image/svg+xml','.png':'image/png','.txt':'text/plain; charset=utf-8',
 '.webmanifest':'application/manifest+json',
};

export const publicAsset=pathname=>fixedFiles.has(pathname)||clientSource.test(pathname)||imageFile.test(pathname);
export const contentType=pathname=>types[path.extname(pathname)];
const hash=bytes=>createHash('sha256').update(bytes).digest('base64');

function directFiles(root,directory,pattern){
 return readdirSync(path.join(root,directory),{withFileTypes:true})
  .filter(entry=>entry.isFile()).map(entry=>`/${directory}/${entry.name}`)
  .filter(name=>pattern.test(name));
}

function readAsset(root,pathname){
 const file=path.join(root,pathname.slice(1));
 if(realpathSync(file)!==file||!statSync(file).isFile())throw Error(`Expected a direct asset at ${pathname}`);
 return readFileSync(file);
}

export function shellAssets(root){
 const manifest=readAsset(root,manifestPath);
 const icons=JSON.parse(manifest.toString('utf8')).icons.map(icon=>icon.src);
 if(!icons.every(icon=>typeof icon==='string'&&imageFile.test(icon)))throw Error('Expected local manifest icons');
 const paths=[...new Set([...shellFiles,...icons,...directFiles(root,'src',clientSource)])].sort();
 const files=new Map(paths.map(name=>[name,name===manifestPath?manifest:readAsset(root,name)]));
 const assets=Object.fromEntries([...files].map(([name,bytes])=>[name,'sha256-'+hash(bytes)]));
 const source=readAsset(root,workerPath);
 const version=createHash('sha256').update(JSON.stringify(assets)).update(source).digest('hex');
 const config=Buffer.from(`const SHELL = ${JSON.stringify({cache:'echo-studio-app-'+version,assets})};\n`);
 files.set(workerPath,Buffer.concat([config,source]));
 return files;
}

export function publicAssets(root){
 const files=shellAssets(root);
 const extra=[...supplementaryFiles,...directFiles(root,'assets',imageFile)].sort();
 for(const name of extra)if(!files.has(name))files.set(name,readAsset(root,name));
 return files;
}
