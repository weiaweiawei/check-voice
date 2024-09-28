import * as ort from "onnxruntime-web";
import { Silero } from "./models";

// @ts-ignore
const onnxFile = new URL('../silero_vad.onnx', import.meta.url).href;

const ortInstance = ort;

let model: Silero;

const init = async () => {
  try {
    model = await Silero.new(ortInstance, async () => {
      const response = await fetch(onnxFile);
      if (!response.ok) {
        throw new Error(`Failed to load model: ${response.status} ${response.statusText}`);
      }
      console.log("模型导入成功");
      return response.arrayBuffer();
    });
  } catch (e) {
    console.error("导入模型地址失败", e);
    throw e;
  } finally {
    return model;
  }
};

export default init;


// import modleInit from "check-voice"; 
// export default {
//   name: "App",
//   components: {
//     // HelloWorld,
//   },
//   async mounted() {
//     const tempModel = await modleInit();
//     console.log(tempModel);
//   },
// };