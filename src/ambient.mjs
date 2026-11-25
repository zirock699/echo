import {getPaletteSync} from './vendor-colorthief.mjs';
import {isManagedMediaPath} from './library-mutations.mjs';
import {isYouTubeVideoId,usesUploadedAudio} from './player.mjs';
const pending=new Set(),VERSION=1;
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
function managedArtworkURL(url){
 if(isManagedMediaPath(url))return url;
 if(typeof url!=='string'||!/^https?:\/\//i.test(url))return null;
 try{
  const {origin,pathname,username,password}=new URL(url);
  if(origin===globalThis.location?.origin&&!username&&!password&&isManagedMediaPath(pathname))return pathname;
 }catch{}
 return null;
}
export function artworkURL(item,{allowYouTube=false,large=false}={}){
 for(const asset of [item?.thumbnail,item?.frame,item?.cover]){
  const local=managedArtworkURL(asset?.url);
  if(local)return local;
 }
 const id=item?.videoId;
 if(!allowYouTube||usesUploadedAudio(item)||!isYouTubeVideoId(id))return null;
 return `https://i.ytimg.com/vi/${id}/${large?'hqdefault':'mqdefault'}.jpg`;
}
export function rgbToHsl([r,g,b]){
 [r,g,b]=[r,g,b].map(x=>clamp(Number(x)||0,0,255)/255);
 const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;
 let h=0,s=0;if(d){s=d/(1-Math.abs(2*l-1));h=max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;h=(h*60+360)%360;}
 return [h,s,l];
}
export function refinePalette(colours,seed=''){
 const useful=colours.filter(c=>Array.isArray(c)&&c.length===3&&c.every(Number.isFinite)).map(rgbToHsl).filter(([,s,l])=>s>.12&&l>.1&&l<.9).sort((a,b)=>b[1]-a[1]);
 const hash=[...seed].reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,0),first=useful[0]||[250+hash%65,.48,.35];
 const second=useful.find(c=>Math.min(Math.abs(c[0]-first[0]),360-Math.abs(c[0]-first[0]))>38)||[(first[0]+65)%360,.45,.3];
 const tone=(c,l)=>`hsl(${Math.round(c[0])} ${Math.round(clamp(c[1],.3,.6)*100)}% ${l}%)`;
 return {primary:tone(first,24),secondary:tone(second,22),glow:tone(first,35),lightPrimary:tone(first,86),lightSecondary:tone(second,88)};
}
export function validPalette(value,videoId){return value?.version===VERSION&&value.videoId===videoId&&Array.isArray(value.colours)&&value.colours.length<=8&&value.colours.every(c=>/^#[a-f0-9]{6}$/i.test(c));}
const fromHex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
export function applyAmbient(lesson){
 const cached=validPalette(lesson?.ambientPalette,lesson?.videoId)?lesson.ambientPalette.colours.map(fromHex):[];
 for(const [key,value] of Object.entries(refinePalette(cached,lesson?.videoId||'echo')))document.body.style.setProperty('--ambient-'+key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),value);
}
export async function prepareAmbient(lesson,save,{allowYouTube=false}={}){
 const key=lesson?.id||lesson?.videoId;if(!lesson||validPalette(lesson.ambientPalette,lesson.videoId)||pending.has(key))return;
 const options={allowYouTube,large:true},url=artworkURL(lesson,options);
 if(!url)return;
 pending.add(key);let colours=[],source='fallback';
 try{
  const img=new Image();img.crossOrigin='anonymous';img.decoding='async';
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{img.removeAttribute('src');reject(Error('Thumbnail timeout'));},5000);img.onload=()=>{clearTimeout(timer);resolve();};img.onerror=()=>{clearTimeout(timer);reject(Error('Thumbnail unavailable'));};img.src=url;});
  colours=getPaletteSync(img,{colorCount:6,quality:15}).map(c=>c.hex());source='thumbnail';
 }catch{/* Colour extraction never blocks playback. */}
 try{if(artworkURL(lesson,options)===url)save({version:VERSION,videoId:lesson.videoId,colours,source});}finally{pending.delete(key);}
}
