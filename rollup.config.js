import resolve from "@rollup/plugin-node-resolve"
import commonjs from "@rollup/plugin-commonjs"

export default {
  input: 'bg-utils/entry.js',
  output: {
    file: 'bg-utils/bundled.js',
    format: 'iife',
    name: 'BGUtils'
  },
  plugins: [
    resolve(),
    commonjs()
  ]
}
