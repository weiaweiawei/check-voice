import * as ort from "onnxruntime-web";
import { Silero } from "./models";

import { FrameProcessor } from "./frame-processor";
import {
  RealTimeVADOptions,
  FrameProcessorOptions,
  SpeechProbabilities,
  Message
} from "../types/index.d";
import { log } from "./logging";

// @ts-ignore
const onnxFile = new URL("../silero_vad.onnx", import.meta.url).href;

const workletURL = new URL("./worklet.js", import.meta.url).href;

console.log(onnxFile);
const ortInstance = ort;

let model: Silero;

// const init = async () => {
//   try {
//     model = await Silero.new(ortInstance, async () => {
//       const response = await fetch(onnxFile);
//       if (!response.ok) {
//         throw new Error(`Failed to load model: ${response.status} ${response.statusText}`);
//       }
//       console.log("模型导入成功");
//       return response.arrayBuffer();
//     });
//     // 创建音频帧处理器
//     const frameProcessor = new FrameProcessor(
//       model.process,
//       model.reset_state,
//       {
//         positiveSpeechThreshold: 0.5,
//         negativeSpeechThreshold: 0.5 - 0.15,
//         preSpeechPadFrames: 1,
//         redemptionFrames: 8,
//         frameSamples: 1536,
//         minSpeechFrames: 3,
//         submitUserSpeechOnPause: false,
//       }
//     )
//     // 将音频帧处理器和Silero模型绑定

//   } catch (e) {
//     console.error("导入模型地址失败", e);
//     throw e;
//   } finally {
//     return model;
//   }
// };

export const defaultFrameProcessorOptions: FrameProcessorOptions = {
  positiveSpeechThreshold: 0.5,
  negativeSpeechThreshold: 0.5 - 0.15,
  preSpeechPadFrames: 1,
  redemptionFrames: 8,
  frameSamples: 1536,
  minSpeechFrames: 3,
  submitUserSpeechOnPause: false,
};

export const defaultRealTimeVADOptions: RealTimeVADOptions = {
  ...defaultFrameProcessorOptions,
  onFrameProcessed: (probabilities) => {},
  onVADMisfire: () => {
    log.debug("VAD misfire");
  },
  onSpeechStart: () => {
    log.debug("Detected speech start");
  },
  onSpeechEnd: () => {
    log.debug("Detected speech end");
  },
  workletURL: "worklet.url",
  stream: undefined,
  ortConfig: undefined,
};

class MicVAD {
  static async new(options: Partial<RealTimeVADOptions> = {}) {
    // 合并默认选项和用户提供的选项
    const fullOptions: RealTimeVADOptions = {
      ...defaultRealTimeVADOptions,
      ...options,
    };
    // validateOptions(fullOptions);

    // 获取音频流
    let stream: MediaStream
    if (fullOptions.stream === undefined)
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...fullOptions.additionalAudioConstraints,
          channelCount: 1,
          echoCancellation: true,
          autoGainControl: true,
          noiseSuppression: true,
        },
      })
    else stream = fullOptions.stream

    // 创建音频上下文和源节点
    const audioContext = new AudioContext();
    const sourceNode = new MediaStreamAudioSourceNode(audioContext, {
      mediaStream: stream,
    });

    // 初始化 VAD 处理节点
    const audioNodeVAD = await AudioNodeVAD.new(audioContext, fullOptions);
    audioNodeVAD.receive(sourceNode);

    return new MicVAD(
      fullOptions,
      audioContext,
      stream,
      audioNodeVAD,
      sourceNode
    );
  }

  private constructor(
    public options: RealTimeVADOptions,
    private audioContext: AudioContext,
    private stream: MediaStream,
    private audioNodeVAD: AudioNodeVAD,
    private sourceNode: MediaStreamAudioSourceNode,
    private listening = false
  ) {}

  pause = () => {
    this.audioNodeVAD.pause();
    this.listening = false;
  };

  start = () => {
    this.audioNodeVAD.start();
    this.listening = true;
  };

  destroy = () => {
    if (this.listening) {
      this.pause();
    }
    if (this.options.stream === undefined) {
      this.stopMediaTracks();
    }
    this.cleanup();
  };

  private stopMediaTracks() {
    this.stream.getTracks().forEach((track) => track.stop());
  }

  private cleanup() {
    this.sourceNode.disconnect();
    this.audioNodeVAD.destroy();
    this.audioContext.close();
  }
}

export class AudioNodeVAD {
  static async new(
    ctx: AudioContext,
    options: Partial<RealTimeVADOptions> = {}
  ) {
    // 合并默认选项与用户提供的选项
    const fullOptions: RealTimeVADOptions = {
      ...defaultRealTimeVADOptions,
      ...options,
    };
    // validateOptions(fullOptions);

    // 配置 ORT
    if (fullOptions.ortConfig) {
      fullOptions.ortConfig(ort);
    }

    // 加载音频工作单元 worklet
    const vadNode = await this.loadAudioWorklet(ctx, fullOptions);

    // 初始化模型
    const model = await this.loadModel(fullOptions);

    // 创建帧处理器
    const frameProcessor = new FrameProcessor(
      model.process,
      model.reset_state,
      {
        frameSamples: fullOptions.frameSamples,
        positiveSpeechThreshold: fullOptions.positiveSpeechThreshold,
        negativeSpeechThreshold: fullOptions.negativeSpeechThreshold,
        redemptionFrames: fullOptions.redemptionFrames,
        preSpeechPadFrames: fullOptions.preSpeechPadFrames,
        minSpeechFrames: fullOptions.minSpeechFrames,
        submitUserSpeechOnPause: fullOptions.submitUserSpeechOnPause,
      }
    );

    // 创建 AudioNodeVAD 实例
    const audioNodeVAD = new AudioNodeVAD(
      ctx,
      fullOptions,
      frameProcessor,
      vadNode
    );
    this.setupMessageHandler(vadNode, audioNodeVAD);

    return audioNodeVAD;
  }

  private static async loadAudioWorklet(
    ctx: AudioContext,
    fullOptions: RealTimeVADOptions
  ) {
    try {
      await ctx.audioWorklet.addModule(workletURL);
    } catch (e) {
      console.error(
        `加载工作单元时出错。请确保 ${workletURL} 可用。`
      );
      throw e;
    }
    return new AudioWorkletNode(ctx, "vad-helper-worklet", {
      processorOptions: {
        frameSamples: fullOptions.frameSamples,
      },
    });
  }

  private static async loadModel(fullOptions: RealTimeVADOptions) {
    try {
      return await Silero.new(ortInstance, async () => {
        const response = await fetch(onnxFile);
        if (!response.ok) {
          throw new Error(
            `Failed to load model: ${response.status} ${response.statusText}`
          );
        }
        console.log("模型导入成功");
        return response.arrayBuffer();
      });
    } catch (e) {
      console.error(
        `加载模型文件时出错。请确保 ${onnxFile} 可用。`
      );
      throw e;
    }
  }

  private static setupMessageHandler(
    vadNode: AudioWorkletNode,
    audioNodeVAD: AudioNodeVAD
  ) {
    vadNode.port.onmessage = async (ev: MessageEvent) => {
      if (ev.data?.message === Message.AudioFrame) {
        const frame = new Float32Array(ev.data.data);
        await audioNodeVAD.processFrame(frame);
      }
    };
  }

  constructor(
    public ctx: AudioContext,
    public options: RealTimeVADOptions,
    private frameProcessor: FrameProcessor,
    private entryNode: AudioWorkletNode
  ) {}

  pause = () => {
    const ev = this.frameProcessor.pause();
    this.handleFrameProcessorEvent(ev);
  };

  start = () => {
    this.frameProcessor.resume();
  };

  receive = (node: AudioNode) => {
    node.connect(this.entryNode);
  };

  processFrame = async (frame: Float32Array) => {
    const ev = await this.frameProcessor.process(frame);
    this.handleFrameProcessorEvent(ev);
  };

  private handleFrameProcessorEvent(
    ev: Partial<{
      probs: SpeechProbabilities;
      msg: Message;
      audio: Float32Array;
    }>
  ) {
    if (ev.probs) {
      this.options.onFrameProcessed(ev.probs);
    }
    switch (ev.msg) {
      case Message.SpeechStart:
        this.options.onSpeechStart();
        break;
      case Message.VADMisfire:
        this.options.onVADMisfire();
        break;
      case Message.SpeechEnd:
        this.options.onSpeechEnd(ev.audio as Float32Array);
        break;
    }
  }

  destroy = () => {
    this.entryNode.port.postMessage({ message: Message.SpeechStop });
    this.entryNode.disconnect();
  };
}

export default MicVAD;
