// V8 explicit compile hints for the page-load chunks (PageSpeed, 2026-10-08).
//
// Chrome compiles a function the first time it is called. Our page-load
// chunks (React, Next's client runtime, each route's own entry chunks) are
// almost entirely code that runs at startup, so on a cold load that lazy
// compilation all lands inside the one long task in which React boots and
// hydrates. The magic comment `//# allFunctionsCalledOnLoad` on the first line
// of a script tells V8 (Chrome 136+) to compile every function in it eagerly,
// while the script is being loaded - before that task starts. Browsers that do
// not know the comment ignore it.
//
// Measured on the live landing page served with this build's chunks, phone
// viewport, 4x CPU throttle, 6 runs each (lh/lt-test.mjs in the PageSpeed
// session): the longest main-thread task after first paint went from a median
// of 326 ms to 154 ms, and the blocking time summed over long tasks from 308 ms
// to 138 ms. Total Blocking Time is 30% of the mobile PageSpeed score.
//
// Only initial chunks get the comment: Next names them `[name]-[contenthash].js`
// (output.filename). Chunks loaded on demand - menus, the map, Clerk - are
// `[id].[contenthash].js` (output.chunkFilename) and stay lazily compiled;
// eagerly compiling code a visitor may never run would only cost memory.
// The comment is added after minification (which would strip it) and before
// source maps and content hashing, so maps stay aligned and file names still
// change with content.
const HINT = '//# allFunctionsCalledOnLoad\n'
const INITIAL_CHUNK = /^static\/chunks\/(?:.+\/)?[^/.]+-[0-9a-f]{8,}\.js$/

export function withCompileHints(config, { dev, isServer, webpack }) {
  if (dev || isServer) return config
  config.plugins.push({
    apply(compiler) {
      compiler.hooks.thisCompilation.tap('BdCompileHints', (compilation) => {
        compilation.hooks.processAssets.tap(
          { name: 'BdCompileHints', stage: webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE + 1 },
          (assets) => {
            for (const name of Object.keys(assets)) {
              if (!INITIAL_CHUNK.test(name) || /\/polyfills-/.test(name)) continue
              compilation.updateAsset(name, (source) => new webpack.sources.ConcatSource(HINT, source))
            }
          }
        )
      })
    },
  })
  return config
}
