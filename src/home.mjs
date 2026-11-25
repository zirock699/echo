import {queryLibrary,categoryValues} from './courses.mjs';

// Home is a bounded preview; Library owns complete, paginated results.
export function homeShelves(data,category=''){
 const shelves=[],limit=8;
 const add=(id,title,items,destination)=>{if(items.length)shelves.push({id,title,items:items.slice(0,limit),total:items.length,hasMore:items.length>limit,destination});};
 const entries=(items,kind)=>items.map(item=>({kind,item}));
 if(category){
  const matches=queryLibrary(data,{category});
  add('category',category,[...entries(matches.courses,'c'),...entries(matches.lessons,'l')],{kind:'all',category});
  return shelves;
 }
 const recent=queryLibrary(data);
 add('courses','Your courses',entries(recent.courses,'c'),{kind:'courses'});
 add('progress','Keep practising',entries(queryLibrary(data,{filter:'progress',sort:'played'}).lessons,'l'),{kind:'lessons',filter:'progress',sort:'played'});
 add('recent','Recently added',entries(recent.lessons,'l'),{kind:'lessons',sort:'recent'});
 add('new','Not started',entries(queryLibrary(data,{filter:'new'}).lessons,'l'),{kind:'lessons',filter:'new'});
 add('favourites','Favourites',entries(queryLibrary(data,{filter:'favourites'}).lessons,'l'),{kind:'lessons',filter:'favourites'});
 for(const [i,name] of categoryValues(data).filter(name=>{const matches=queryLibrary(data,{category:name});return matches.courses.length||matches.lessons.length;}).slice(0,4).entries()){
  const matches=queryLibrary(data,{category:name});
  add('category-'+i,name,[...entries(matches.courses,'c'),...entries(matches.lessons,'l')],{kind:'all',category:name});
 }
 add('collections','Your collections',entries(data.collections||[],'collection'),{view:'collections'});
 return shelves;
}

// Resolve real lesson artwork for the shelf's destination, including courses/collections.
export function shelfArtworkLessons(data,shelf){
 const index=new Map((data.lessons||[]).map(l=>[l.id,l])),seen=new Set(),lessons=[];
 for(const {kind,item} of shelf.items){
  for(const lesson of kind==='l'?[item]:(item.lessonIds||[]).map(id=>index.get(id)).filter(Boolean)){
   if(!seen.has(lesson.id)){seen.add(lesson.id);lessons.push(lesson);if(lessons.length===4)return lessons;}
  }
 }
 return lessons;
}
