/** Practice recordings remain on this device and are not uploaded. */
function stopTracks(stream) {
  for (const track of stream?.getTracks() ?? []) track.stop();
}

export class PracticeRecorder {
  constructor(notify) {
    this.notify = notify;
    this.url = null;
    this.error = '';
    this.permissionRequest = null;
    this.capture = null;
  }

  get requesting() { return this.permissionRequest !== null; }
  get recorder() { return this.capture?.recorder ?? null; }

  async start() {
    if (this.requesting || this.recorder?.state === 'recording') return;
    this.error = '';
    const devices = globalThis.navigator?.mediaDevices;
    if (!devices?.getUserMedia || !globalThis.MediaRecorder) {
      this.error = 'Recording needs a supported browser and a secure connection.';
      this.notify();
      return;
    }

    const request = {};
    this.permissionRequest = request;
    this.notify();
    if (this.permissionRequest !== request) return;

    let stream;
    let capture;
    try {
      stream = await devices.getUserMedia({audio: true});
      if (this.permissionRequest !== request) {
        stopTracks(stream);
        return;
      }

      const recorder = new MediaRecorder(stream);
      const chunks = [];
      capture = {recorder, stream};
      this.capture = capture;
      recorder.ondataavailable = ({data}) => {
        if (this.capture === capture && data.size) chunks.push(data);
      };
      recorder.onstop = () => {
        this.release(capture);
        if (this.capture !== capture) return;
        this.capture = null;
        if (chunks.length) {
          const url = URL.createObjectURL(new Blob(chunks, {type: recorder.mimeType}));
          if (this.url) URL.revokeObjectURL(this.url);
          this.url = url;
        }
        this.notify();
      };
      recorder.onerror = () => this.captureFailed(capture);
      recorder.start();
    } catch {
      if (capture) this.release(capture);
      else stopTracks(stream);
      if (this.capture === capture) this.capture = null;
      if (this.permissionRequest === request) {
        this.error = stream ? 'Recording could not start. Please try again.' :
          'Microphone access was denied or unavailable. Check browser permissions and try again.';
      }
    } finally {
      if (this.permissionRequest === request) {
        this.permissionRequest = null;
        this.notify();
      }
    }
  }

  release(capture) {
    const {stream} = capture;
    capture.stream = null;
    stopTracks(stream);
  }

  captureFailed(capture) {
    this.release(capture);
    if (this.capture !== capture) return;
    this.capture = null;
    this.error = 'Recording was interrupted. Please try again.';
    this.notify();
  }

  stopCapture(capture) {
    if (!capture) return;
    try {
      if (capture.recorder.state !== 'inactive') capture.recorder.stop();
    } catch {
      this.captureFailed(capture);
    } finally {
      this.release(capture);
    }
  }

  stop() {
    const wasRequesting = this.requesting;
    this.permissionRequest = null;
    this.stopCapture(this.capture);
    if (wasRequesting) this.notify();
  }

  reset() {
    this.permissionRequest = null;
    const capture = this.capture;
    this.capture = null;
    this.stopCapture(capture);
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
    this.error = '';
  }
}
