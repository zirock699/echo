export const CATEGORY_PRESETS=[
 {name:'Philosophy',keywords:'philosophy,philosopher,ethics,meaning'},
 {name:'Science & technology',keywords:'science,technology,engineering,computing'},
 {name:'Business',keywords:'business,leadership,management,entrepreneur'},
 {name:'Communication',keywords:'communication,speaking,presentation,conversation'},
 {name:'Wellbeing',keywords:'wellbeing,psychology,health,mindfulness'},
 {name:'Culture',keywords:'culture,history,literature,music,art'}
];
export function matchesCategoryRule(item,rule,progress){
 if(!rule||typeof rule!=='object')return false;
 const words=String(rule.keywords||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 if(!words.length&&!rule.tag&&!rule.course&&(!rule.filter||rule.filter==='all'))return false;
 const text=[item.title,item.channel,item.speaker,item.category,...(item.tags||[])].filter(Boolean).join(' ').toLowerCase();
 return (!words.length||words.some(word=>text.includes(word)))&&(!rule.tag||item.tags?.includes(rule.tag))&&(!rule.course||item.courseId===rule.course||item.id===rule.course)&&(!rule.filter||rule.filter==='all'||rule.filter==='favourites'&&item.favourite||rule.filter==='new'&&progress===0||rule.filter==='progress'&&progress>0&&progress<100||rule.filter==='complete'&&progress===100);
}
