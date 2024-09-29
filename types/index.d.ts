export interface FrameProcessorOptions {
  positiveSpeechThreshold: number; // 当 Silero VAD 模型返回的值超过此阈值时，视为积极的语音指示。该值应在 0 和 1 之间。

  negativeSpeechThreshold: number; // 当 Silero VAD 模型返回的值低于此阈值时，视为没有语音。通常，此值比 positiveSpeechThreshold 少 0.15。

  redemptionFrames: number; // 在检测到的语音结束后，算法会等待此数量的帧数（即音频片段），然后再调用 onSpeechEnd。如果在这段时间内模型返回的值超过 positiveSpeechThreshold，则认为之前的语音结束检测是错误的。

  frameSamples: number; // 表示一个“帧”的音频样本数量（在 16000 的采样率下）。此选项的推荐值是 1536，因为 Silero VAD 模型在这个值上训练过。

  preSpeechPadFrames: number; // 在传递给 onSpeechEnd 的音频段前，预先添加的帧数。这可以帮助模型在检测语音结束时有更多上下文信息。

  minSpeechFrames: number; // 如果检测到的语音片段的帧数少于此值，将丢弃该片段，而运行 onVADMisfire，以防误判语音段。

  submitUserSpeechOnPause: boolean; // 如果设置为 true，当用户暂停 VAD 时，可能会触发 onSpeechEnd 事件。这允许更灵活的用户交互。
}

export interface SpeechProbabilities {
  notSpeech: number;
  isSpeech: number;
  audioFrame: Float32Array;
}

interface RealTimeVADCallbacks {
  /** 每帧处理后执行的回调。帧的大小（样本数量）由 `frameSamples` 给出。 */
  onFrameProcessed: (probabilities: SpeechProbabilities) => any;

  /** 如果检测到语音开始，但由于音频段小于 `minSpeechFrames`，不会运行 `onSpeechEnd`，则执行此回调。 */
  onVADMisfire: () => any;

  /** 当检测到语音开始时执行的回调。 */
  onSpeechStart: () => any;
  /**
   * 当检测到语音结束时执行的回调。
   * 参数为一个 Float32Array 的音频样本，范围在 -1 到 1 之间，采样率为 16000。
   * 如果音频段小于 `minSpeechFrames`，则不会执行此回调。
   */
  onSpeechEnd: (audio: Float32Array) => any;
}

export type OrtOptions = {
  ortConfig?: (ort: any) => any;
};

type AssetOptions = {
  workletURL: string; //worklet的url
};

/**
 * VAD 的可自定义音频约束。
 * 排除了某些默认为用户设置的约束。  Omit是排除工具类型
 */
type AudioConstraints = Omit<
  MediaTrackConstraints,
  "channelCount" | "echoCancellation" | "autoGainControl" | "noiseSuppression"
>;

// 有数据流的
interface RealTimeVADOptionsWithStream
  extends FrameProcessorOptions,
    RealTimeVADCallbacks,
    OrtOptions,
    AssetOptions {
  stream: MediaStream;
}

// 没有数据流的
interface RealTimeVADOptionsWithoutStream
  extends FrameProcessorOptions,
    RealTimeVADCallbacks,
    OrtOptions,
    AssetOptions {
  additionalAudioConstraints?: AudioConstraints;
  stream: undefined;
}

export type RealTimeVADOptions =
  | RealTimeVADOptionsWithStream
  | RealTimeVADOptionsWithoutStream;

// export interface Model {
//   reset_state: () => void;
//   process: (arr: Float32Array) => Promise<SpeechProbabilities>;
// }

export enum Message {
    AudioFrame = "AUDIO_FRAME",
    SpeechStart = "SPEECH_START",
    VADMisfire = "VAD_MISFIRE",
    SpeechEnd = "SPEECH_END",
    SpeechStop = "SPEECH_STOP",
  }
