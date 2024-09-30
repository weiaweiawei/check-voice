import { log } from "./logging"

interface ResamplerOptions {
  nativeSampleRate: number
  targetSampleRate: number
  targetFrameSize: number
}

export class Resampler {
  inputBuffer: Float32Array
  private inputBufferIndex: number

  constructor(public options: ResamplerOptions) {
    if (options.nativeSampleRate < 16000) {
      log.error(
        "nativeSampleRate is too low. Should have 16000 <= nativeSampleRate"
      )
    }
    this.inputBuffer = new Float32Array(0)
    this.inputBufferIndex = 0
  }

  process = (audioFrame: Float32Array): Float32Array[] => {
    const outputFrames: Float32Array[] = []
    this.fillInputBuffer(audioFrame)

    while (this.hasEnoughDataForFrame()) {
      const outputFrame = this.generateOutputFrame()
      outputFrames.push(outputFrame)
    }

    return outputFrames
  }

  stream = async function* (this: Resampler, audioFrame: Float32Array) {
    this.fillInputBuffer(audioFrame)

    while (this.hasEnoughDataForFrame()) {
      const outputFrame = this.generateOutputFrame()
      yield outputFrame
    }
  }

  private fillInputBuffer(audioFrame: Float32Array) {
    const newBuffer = new Float32Array(this.inputBuffer.length + audioFrame.length)
    newBuffer.set(this.inputBuffer, 0)
    newBuffer.set(audioFrame, this.inputBuffer.length)
    this.inputBuffer = newBuffer
  }

  private hasEnoughDataForFrame(): boolean {
    const availableSamples = this.inputBuffer.length - this.inputBufferIndex
    const requiredSamples = (this.options.targetFrameSize * this.options.nativeSampleRate) / this.options.targetSampleRate
    return availableSamples >= requiredSamples
  }

  private generateOutputFrame(): Float32Array {
    const outputFrame = new Float32Array(this.options.targetFrameSize)
    const resampleRatio = this.options.nativeSampleRate / this.options.targetSampleRate
    let outputIndex = 0
    let inputIndex = this.inputBufferIndex

    for (outputIndex = 0; outputIndex < this.options.targetFrameSize; outputIndex++) {
      const inputStart = inputIndex
      const inputEnd = Math.min(inputIndex + resampleRatio, this.inputBuffer.length)

      // 计算 inputStart 到 inputEnd 之间的平均值
      let sum = 0
      let count = 0
      for (let i = inputStart; i < inputEnd; i++) {
        sum += this.inputBuffer[i]
        count++
      }

      outputFrame[outputIndex] = sum / count
      inputIndex += resampleRatio
    }

    this.inputBufferIndex = Math.floor(inputIndex) // 更新 inputBuffer 的消费位置
    return outputFrame
  }
}
