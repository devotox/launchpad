import { homedir } from "node:os";
import { join } from "node:path";
import type { ConfigPaths, ConfigOptions } from "@/utils/config/types";

/**
 * Get the appropriate config directory based on platform and XDG spec
 */
export function getConfigDirectory(options: ConfigOptions = {}): string {
  if (options.customConfigDir) {
    return options.customConfigDir;
  }

  // Use XDG Base Directory specification on Unix-like systems
  if (options.useXDGConfig !== false && process.platform !== "win32") {
    const xdgConfigHome = process.env["XDG_CONFIG_HOME"];
    if (xdgConfigHome) {
      return join(xdgConfigHome, "launchpad");
    }

    // Fallback to ~/.config on Unix-like systems
    const home = process.env["HOME"];
    if (home) {
      return join(home, ".config", "launchpad");
    }
  }

  // Windows or fallback
  const home = process.env["HOME"] || process.env["USERPROFILE"];
  if (home) {
    return join(home, ".launchpad");
  }

  throw new Error("Could not determine config directory");
}

/**
 * Get all configuration-related paths
 */
export function getConfigPaths(options: ConfigOptions = {}): ConfigPaths {
  const configDir = getConfigDirectory(options);

  return {
    configDir,
    configFile: join(configDir, "config.json"),
    logsDir: join(configDir, "logs"),
    cacheDir: join(configDir, "cache"),
  };
}

/**
 * Get the data directory for logs, cache, etc.
 */
export function getDataDirectory(options: ConfigOptions = {}): string {
  if (options.customConfigDir) {
    return options.customConfigDir;
  }

  // Use XDG Base Directory specification on Unix-like systems
  if (options.useXDGConfig !== false && process.platform !== "win32") {
    const xdgDataHome = process.env["XDG_DATA_HOME"];
    if (xdgDataHome) {
      return join(xdgDataHome, "launchpad");
    }
    return join(homedir(), ".local", "share", "launchpad");
  }

  // Fallback to config directory
  return getConfigDirectory(options);
}

/**
 * Get the data directory path following XDG Base Directory specification
 */
export function getDataDir(options: ConfigOptions = {}): string {
  // Use XDG Base Directory specification on Unix-like systems
  if (options.useXDGConfig !== false && process.platform !== "win32") {
    const xdgDataHome = process.env["XDG_DATA_HOME"];
    if (xdgDataHome) {
      return join(xdgDataHome, "launchpad");
    }
  }

  // Fallback to config directory
  return getConfigDirectory(options);
}
