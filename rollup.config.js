import typescript from "@rollup/plugin-typescript";
import dts from "rollup-plugin-dts";
import terser from '@rollup/plugin-terser';
import url from "rollup-plugin-url"; // 引入插件
import resolve from '@rollup/plugin-node-resolve'; // 新增
import commonjs from '@rollup/plugin-commonjs'; // 新增
import wasm from 'rollup-plugin-wasm';
import copy from 'rollup-plugin-copy'; // 添加复制插件

const config = [
  {
    input: ["src/index.ts", "src/worklet.js"],
    output: [
      {
        file: "./dist/checkVoice.esm.js",
        format: "es",
        sourcemap: false,
      },
      {
        file: "./dist/checkVoice.umd.js",
        format: "umd",
        name: "checkVoice",
        sourcemap: false,
      }
    ],
    plugins: [
      resolve(), // 新增
      commonjs(), // 新增
      // url({
      //   include: ['**/*.onnx', '**/*.wasm'],
      //   limit: 0, // 不压缩，强制生成文件
      //   destDir: 'dist', // 输出到指定目录
      //   emitFiles: true, // 生成文件
      //   fileName: `[name][extname]`,
      // }),
      copy({
        targets: [
          { src: 'node_modules/onnxruntime-web/**/*.wasm', dest: 'dist' }, // 复制 .wasm 文件
          { src: 'silero_vad.onnx', dest: 'dist' }, // 复制 .wasm 文件
          // { src: './src/worklet.js', dest: 'dist' },
        ]
      }),
      typescript({
        tsconfig: "./tsconfig.json",
      }),
      terser(),
      wasm()
    ],
  },
  // {
  //   input: "types/index.d.ts",
  //   output: [{ file: "dist/BotaSDK.d.ts", format: "es" }],
  //   plugins: [dts()],
  // },
];

export default config;
