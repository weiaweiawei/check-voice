### 介绍
基于vad（voice activity detection）语音活性检测模型，来判断音频段是否含有语音.
typescript版本

使用
```javascript
 const frameProcessor = new FrameProcessor(
      model.process, // 处理每帧的模型函数
      model.reset_state, // 模型的重置函数
      { // 选项参数
        frameSamples: fullOptions.frameSamples,
        positiveSpeechThreshold: fullOptions.positiveSpeechThreshold,
        negativeSpeechThreshold: fullOptions.negativeSpeechThreshold,
        redemptionFrames: fullOptions.redemptionFrames,
        preSpeechPadFrames: fullOptions.preSpeechPadFrames,
        minSpeechFrames: fullOptions.minSpeechFrames,
        submitUserSpeechOnPause: fullOptions.submitUserSpeechOnPause,
      }
    )

```