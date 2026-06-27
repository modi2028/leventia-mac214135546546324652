// Platform abstraction layer - exports appropriate implementation for current platform
import launcher from './win32/index.js'
import darwinLauncher from './darwin/index.js'

// Select launcher based on platform
const selectedLauncher = process.platform === 'darwin' ? darwinLauncher : launcher

export default selectedLauncher
export type { RobloxLauncher, PlatformLauncher } from './types.js'
