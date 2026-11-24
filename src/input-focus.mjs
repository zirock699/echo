// Text selection is supported by search inputs too. Restoring focus alone resets the caret.
export function textSelection(element){
 if(!element||!(element.tagName==='TEXTAREA'||element.tagName==='INPUT'&&['text','search','url','tel','password'].includes(element.type)))return null;
 return [element.selectionStart,element.selectionEnd,element.selectionDirection||'none'];
}
