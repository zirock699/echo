import {queryLibrary,categoryValues} from './courses.mjs';

// Home is a bounded preview; Library owns complete, paginated results.
export function homeShelves(data,category=''){
 const shelves=[],limit=8;
 const add=(id,title,items,destination)=>{if(items.length)shelves.push({id,title,items:items.slice(0,limit),destination});};
 const entries=(items,kind)=>items.map(item=>({kind,item}));
 if(category){
  const matches=queryLibrary(data,{category});
  add('category',category,[...entries(matches.courses,'c'),...entries(matches.lessons,'l')],{kind:'all',category});
  return shelves;
 }
 const recent=queryLibrary(data);
 add('courses','Your courses',entries(recent.courses,'c'),{kind:'courses'});
 add('recent','Recently added',entries(recent.lessons,'l'),{kind:'lessons',sort:'recent'});
 add('favourites','Favourites',entries(queryLibrary(data,{filter:'favourites'}).lessons,'l'),{kind:'lessons',filter:'favourites'});
 for(const [i,name] of categoryValues(data).filter(name=>data.courses.some(c=>c.category===name)||data.lessons.some(l=>l.category===name)).slice(0,4).entries()){
  const matches=queryLibrary(data,{category:name});
  add('category-'+i,name,[...entries(matches.courses,'c'),...entries(matches.lessons,'l')],{kind:'all',category:name});
 }
 add('collections','Your collections',entries(data.collections||[],'collection'),{view:'collections'});
 return shelves;
}
