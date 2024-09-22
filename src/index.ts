export interface FrameProcessorInterface {
  resume: () => void
  process: (arr: Float32Array) => Promise<{
    probs?: SpeechProbabilities
    msg?: Message
    audio?: Float32Array
  }>
  endSegment: () => { msg?: Message; audio?: Float32Array }
}