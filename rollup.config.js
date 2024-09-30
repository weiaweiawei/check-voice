import typescript from 'rollup-plugin-typescript2';
import terser from '@rollup/plugin-terser';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import wasm from 'rollup-plugin-wasm';
import copy from 'rollup-plugin-copy';

const config = [
  // ES Module 输出，支持多入口和代码分割
  {
    input: ['src/index.ts', 'src/worklet.ts'],
    output: {
      dir: './dist/es',  // 使用目录输出
      format: 'es',      // ES 格式支持代码分割
      sourcemap: true
    },
    plugins: [
      resolve(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false
      }),
      commonjs(),
      terser(),
      wasm(),
      copy({
        targets: [
          { src: 'node_modules/onnxruntime-web/**/*.wasm', dest: 'dist' },
          { src: 'silero_vad.onnx', dest: 'dist' }
        ]
      })
    ]
  },

  // UMD 格式，只支持单入口
  {
    input: 'src/index.ts',  // UMD 格式需要单入口文件
    output: {
      file: './dist/checkVoice.umd.js',  // 输出的 UMD 模块文件
      format: 'umd',
      name: 'checkVoice',
      sourcemap: false
    },
    plugins: [
      resolve(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false
      }),
      commonjs(),
      terser(),
      wasm(),
      copy({
        targets: [
          { src: 'node_modules/onnxruntime-web/**/*.wasm', dest: 'dist' },
          { src: 'silero_vad.onnx', dest: 'dist' }
        ]
      })
    ]
  }
];

export default config;
