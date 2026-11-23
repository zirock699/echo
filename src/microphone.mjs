/** Browser permission diagnostics; the app cannot override host/browser policy. */
export function microphoneBlock(environment=globalThis){
 if(environment.isSecureContext===false)return {kind:'secure',message:'Microphone access needs HTTPS. Open Echo Studio over a secure connection (or localhost for development).'};
 const policy=environment.document?.permissionsPolicy||environment.document?.featurePolicy;
 if(policy?.allowsFeature&&!policy.allowsFeature('microphone'))return {kind:'policy',message:'This embedded page is not allowed to use the microphone. Open the app in its own tab. The host must allow microphone access for embedded recording.'};
 if(!environment.navigator?.mediaDevices?.getUserMedia||!environment.MediaRecorder)return {kind:'unsupported',message:'Recording needs a supported browser with microphone access. Try a current Safari, Chrome, Edge or Firefox browser.'};
 return null;
}
export function microphoneError(error){
 if(['NotAllowedError','PermissionDeniedError','SecurityError'].includes(error?.name))return 'Microphone access was denied or blocked. Use your browser’s site permissions to allow Microphone, check your device’s privacy settings, then tap Try again. The app cannot reset a blocked permission.';
 if(error?.name==='NotFoundError')return 'No microphone was found. Connect or enable a microphone, then try again.';
 if(['NotReadableError','TrackStartError'].includes(error?.name))return 'The microphone could not be opened. Close other apps using it and check your device’s microphone permissions, then try again.';
 if(error?.name==='OverconstrainedError')return 'This microphone does not support the requested capture settings. Try another input device.';
 return error?.message||'Recording could not start. Check microphone access and try again.';
}
export function recordingOptions(Recorder=globalThis.MediaRecorder){const mimeType=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(t=>Recorder?.isTypeSupported?.(t));return mimeType?{mimeType}:undefined;}
