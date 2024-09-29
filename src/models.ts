
import  { SpeechProbabilities } from "../types/index.d"

export type ONNXRuntimeAPI = any;
export type ModelFetcher = () => Promise<ArrayBuffer>;
export type OrtOptions = {
  ortConfig?: (ort: ONNXRuntimeAPI) => any;
};



export class Silero {
  _session: any; // 负责模型推理的会话对象。
  _h: any; // （hidden state）隐状态张量，保存时间步之间的信息。
  _c: any; //（cell state） 单元状态张量，通常用于 LSTM 模型的记忆机制，它与隐状态一起存储信息，帮助模型决定哪些信息应该被保留或遗忘
  _sr: any; // （sample rate） 采样率张量，指示音频信号的采样频率。

  constructor(
    private ort: ONNXRuntimeAPI,
    private modelFetcher: ModelFetcher
  ) {}
  //  // 创建新的 Silero 实例并初始化
  static new = async (ort: ONNXRuntimeAPI, modelFetcher: ModelFetcher) => {
    const model = new Silero(ort, modelFetcher);
    await model.init();
    return model;
  };

  init = async () => {
    console.log("初始化 VAD...");
    // 获取模型数据
    const modelArrayBuffer = await this.modelFetcher();
    this._session = await this.ort.InferenceSession.create(modelArrayBuffer);
    // 创建采样率
    this._sr = new this.ort.Tensor("int64", [16000n]);
    // 重置状态
    this.reset_state();
    console.log("VAD 初始化完成");
  };
  // 重置状态
  reset_state = () => {
    const zeroes = Array(2 * 64).fill(0);
    this._h = new this.ort.Tensor("float32", zeroes, [2, 1, 64]);
    this._c = new this.ort.Tensor("float32", zeroes, [2, 1, 64]);
  };

  // 处理音频帧并返回语音概率
  process = async (audioFrame: Float32Array): Promise<SpeechProbabilities> => {
    // 创建输入张量
    const t = new this.ort.Tensor("float32", audioFrame, [
      1,
      audioFrame.length,
    ]);
    const inputs = {
      input: t,
      h: this._h,
      c: this._c,
      sr: this._sr,
    };
    // 运行模型
    const out = await this._session.run(inputs);
    // 更新状态
    this._h = out.hn;
    this._c = out.cn;
    const [isSpeech] = out.output.data;
    const notSpeech = 1 - isSpeech;
    // 返回音频帧和语音概率
    return { notSpeech, isSpeech, audioFrame };
  };
}
