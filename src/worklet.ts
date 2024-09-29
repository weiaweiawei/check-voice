import { log } from "./logging";

import { Message } from "../types/index.d";

import { Resampler } from "./resampler";

interface WorkletOptions {
  frameSamples: number;
}

class Processor extends AudioWorkletProcessor {
  // @ts-ignore
  resampler: Resampler;
  _initialized = false;
  _stopProcessing = false;
  options: WorkletOptions;
  port: any;

  constructor(options: any) {
    super();
    this.options = options.processorOptions as WorkletOptions;

    this.port.onmessage = (ev: any) => {
      if (ev.data.message === Message.SpeechStop) {
        this._stopProcessing = true;
      }
    };

    this.init();
  }
  init = async () => {
    log.debug("initializing worklet");
    this.resampler = new Resampler({
      nativeSampleRate: 16000,
      targetSampleRate: 16000,
      targetFrameSize: this.options.frameSamples,
    });
    this._initialized = true;
    log.debug("initialized worklet");
  };
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean {
    if (this._stopProcessing) {
      return false;
    }

    // @ts-ignore
    const arr = inputs[0][0];

    if (this._initialized && arr instanceof Float32Array) {
      const frames = this.resampler.process(arr);
      for (const frame of frames) {
        this.port.postMessage(
          { message: Message.AudioFrame, data: frame.buffer },
          [frame.buffer]
        );
      }
    }

    return true;
  }
}

registerProcessor("vad-helper-worklet", Processor);


// import MicVAD from "check-voice"; 
// import { onMounted } from "vue";

// onMounted(async () => {

//   const myvad = await MicVAD.new({
//       onSpeechEnd: (audio: any) => {
//         console.log(audio);
//         // do something with `audio` (Float32Array of audio samples at sample rate 16000)...
//       }
//     })

//   console.log(myvad);
// })