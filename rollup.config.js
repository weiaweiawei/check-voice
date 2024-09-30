import typescript from 'rollup-plugin-typescript2';
import dts from 'rollup-plugin-dts';
import terser from '@rollup/plugin-terser';
import url from 'rollup-plugin-url'; // 引入插件
import resolve from '@rollup/plugin-node-resolve'; // 新增
import commonjs from '@rollup/plugin-commonjs'; // 新增
import wasm from 'rollup-plugin-wasm';
import copy from 'rollup-plugin-copy'; // 添加复制插件

const config = [
  {
    input: ['src/index.ts', 'src/worklet.ts'],
    output: [
      {
        dir: './dist/es',
        format: 'es',
        sourcemap: false
      },
      {
        dir: './dist/umd',
        format: 'umd',
        name: 'checkVoice',
        sourcemap: false
      }
    ],
    plugins: [
      resolve(), // 新增
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false // 不生成 .d.ts 文件
        // exclude: ['**/*.d.ts'],       // 排除 .d.ts 文件
      }),
      commonjs(), // 新增
      // url({
      //   include: ['**/*.onnx', '**/*.wasm'],
      //   limit: 0, // 不压缩，强制生成文件
      //   destDir: 'dist', // 输出到指定目录
      //   emitFiles: true, // 生成文件
      //   fileName: `[name][extname]`,
      // }),
      terser(),
      wasm(),
      copy({
        targets: [
          { src: 'node_modules/onnxruntime-web/**/*.wasm', dest: 'dist' }, // 复制 .wasm 文件
          { src: 'silero_vad.onnx', dest: 'dist' } // 复制 .wasm 文件
          // { src: './src/worklet.js', dest: 'dist' },
        ]
      })
    ]
  }
  // {
  //   input: "types/index.d.ts",
  //   output: [{ file: "dist/check-voice.d.ts", format: "es" }],
  //   plugins: [dts()],
  // },
];

export default config;
