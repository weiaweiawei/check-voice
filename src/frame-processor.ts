/*
Some of this code, together with the default options found in index.ts,
were taken (or took inspiration) from https://github.com/snakers4/silero-vad
*/

import { SpeechProbabilities } from "../types/index.d"
import { Message } from "./messages"
import { log } from "./logging"
import  { FrameProcessorOptions } from "../types/index.d"

const RECOMMENDED_FRAME_SAMPLES = [512, 1024, 1536]



export const defaultFrameProcessorOptions: FrameProcessorOptions = {
  positiveSpeechThreshold: 0.5,
  negativeSpeechThreshold: 0.5 - 0.15,
  preSpeechPadFrames: 1,
  redemptionFrames: 8,
  frameSamples: 1536,
  minSpeechFrames: 3,
  submitUserSpeechOnPause: false,
}

export function validateOptions(options: FrameProcessorOptions) {
  if (!RECOMMENDED_FRAME_SAMPLES.includes(options.frameSamples)) {
    log.warn("您使用的帧大小不寻常")
  }
  if (
    options.positiveSpeechThreshold < 0 ||
    options.negativeSpeechThreshold > 1
  ) {
    log.error("positiveSpeechThreshold 应该是 0 到 1 之间的数字")
  }
  if (
    options.negativeSpeechThreshold < 0 ||
    options.negativeSpeechThreshold > options.positiveSpeechThreshold
  ) {
    log.error(
      "negativeSpeechThreshold 应该在 0 和 positiveSpeechThreshold 之间"
    )
  }
  if (options.preSpeechPadFrames < 0) {
    log.error("preSpeechPadFrames 应该为正数")
  }
  if (options.redemptionFrames < 0) {
    log.error("redemptionFrames 应该为正数")
  }
}


export interface FrameProcessorInterface {
  resume: () => void
  process: (arr: Float32Array) => Promise<{
    probs?: SpeechProbabilities
    msg?: Message
    audio?: Float32Array
  }>
  endSegment: () => { msg?: Message; audio?: Float32Array }
}

const concatArrays = (arrays: Float32Array[]): Float32Array => {
  const sizes = arrays.reduce(
    (out, next) => {
      out.push((out[out.length - 1] as number) + next.length);

      return out
    },
    [0]
  )
  const outArray = new Float32Array(sizes[sizes.length - 1] as number)
  arrays.forEach((arr, index) => {
    const place = sizes[index]
    outArray.set(arr, place)
  })
  return outArray
}

export class FrameProcessor implements FrameProcessorInterface {
  speaking: boolean = false
  audioBuffer: { frame: Float32Array; isSpeech: boolean }[]
  redemptionCounter = 0
  active = false

  constructor(
    public modelProcessFunc: (
      frame: Float32Array
    ) => Promise<SpeechProbabilities>,
    public modelResetFunc: () => any,
    public options: FrameProcessorOptions
  ) {
    this.audioBuffer = []
    this.reset()
  }

  reset = () => {
    this.speaking = false
    this.audioBuffer = []
    this.modelResetFunc()
    this.redemptionCounter = 0
  }

  pause = () => {
    this.active = false
    if (this.options.submitUserSpeechOnPause) {
      return this.endSegment()
    } else {
      this.reset()
      return {}
    }
  }

  resume = () => {
    this.active = true
  }

  endSegment = () => {
    const audioBuffer = this.audioBuffer
    this.audioBuffer = []
    const speaking = this.speaking
    this.reset()

    const speechFrameCount = audioBuffer.reduce((acc, item) => {
      return acc + +item.isSpeech
    }, 0)

    if (speaking) {
      if (speechFrameCount >= this.options.minSpeechFrames) {
        const audio = concatArrays(audioBuffer.map((item) => item.frame))
        return { msg: Message.SpeechEnd, audio }
      } else {
        return { msg: Message.VADMisfire }
      }
    }
    return {}
  }

  process = async (frame: Float32Array) => {
    if (!this.active) {
      return {}
    }

    const probs = await this.modelProcessFunc(frame)
    this.audioBuffer.push({
      frame,
      isSpeech: probs.isSpeech >= this.options.positiveSpeechThreshold,
    })

    if (
      probs.isSpeech >= this.options.positiveSpeechThreshold &&
      this.redemptionCounter
    ) {
      this.redemptionCounter = 0
    }

    if (
      probs.isSpeech >= this.options.positiveSpeechThreshold &&
      !this.speaking
    ) {
      this.speaking = true
      return { probs, msg: Message.SpeechStart }
    }

    if (
      probs.isSpeech < this.options.negativeSpeechThreshold &&
      this.speaking &&
      ++this.redemptionCounter >= this.options.redemptionFrames
    ) {
      this.redemptionCounter = 0
      this.speaking = false

      const audioBuffer = this.audioBuffer
      this.audioBuffer = []

      const speechFrameCount = audioBuffer.reduce((acc, item) => {
        return acc + +item.isSpeech
      }, 0)

      if (speechFrameCount >= this.options.minSpeechFrames) {
        const audio = concatArrays(audioBuffer.map((item) => item.frame))
        return { probs, msg: Message.SpeechEnd, audio }
      } else {
        return { probs, msg: Message.VADMisfire }
      }
    }

    if (!this.speaking) {
      while (this.audioBuffer.length > this.options.preSpeechPadFrames) {
        this.audioBuffer.shift()
      }
    }
    return { probs }
  }
}
