// Preview-only backing stores. Production uses Sites-managed D1 and R2 bindings.
export class DevDB {
 constructor(){this.rows=new Map();}
 prepare(sql){const rows=this.rows;return {bind(...a){return {async first(){return rows.get(a[0])||null;},async run(){if(sql.startsWith('INSERT')){if(rows.has(a[0]))return {meta:{changes:0}};rows.set(a[0],{revision:1,data:a[1]});return {meta:{changes:1}};}if(sql.startsWith('UPDATE')){const old=rows.get(a[2]);if(!old||old.revision!==a[3])return {meta:{changes:0}};rows.set(a[2],{revision:old.revision+1,data:a[0]});return {meta:{changes:1}};}return {meta:{changes:0}};}};}};}
}
export class DevBucket {
 constructor(){this.files=new Map();}
 async put(key,body,options){this.files.set(key,{body:new Uint8Array(body),...options});}
 async head(key){const f=this.files.get(key);return f?{size:f.body.byteLength,httpMetadata:f.httpMetadata}:null;}
 async get(key,options){const f=this.files.get(key);if(!f)return null;const r=options?.range;return {body:r?f.body.slice(r.offset,r.offset+r.length):f.body};}
 async delete(key){this.files.delete(key);}
}
