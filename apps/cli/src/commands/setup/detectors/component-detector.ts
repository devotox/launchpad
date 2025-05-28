import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

import parseJson from 'parse-json';
import { stringify } from 'safe-stable-stringify';
import { match } from 'ts-pattern';

import type { Platform, SetupComponent } from '@/utils/config/types';

// Type definitions for dynamic check configurations
type CheckConfig =
  | { type: 'env'; variable?: string; variables?: string[]; value?: string }
  | { type: 'file-contains'; file: string; pattern?: string; patterns?: string[] }
  | { type: 'path-includes'; command: string; includes: string | string[] }
  | { type: 'combined'; checks: CheckConfig[]; operator?: 'AND' | 'OR' }
  | { type: 'command'; command: string };

export class ComponentDetector {
  checkComponentInstalled(component: SetupComponent, platform: Platform): Promise<boolean> {
    const detection = component.detection[platform];
    if (!detection) {
      return Promise.resolve(false);
    }

    try {
      const result = match(detection.type)
        .with('command', () => this.checkCommand(detection.value))
        .with('file', () => this.checkFile(detection.value))
        .with('custom', () => this.executeCustomCheck(detection.customCheck ?? detection.value))
        .otherwise(() => false);

      return Promise.resolve(result);
    } catch {
      return Promise.resolve(false);
    }
  }

  private checkCommand(command: string): boolean {
    try {
      // Validate command is not empty
      if (!command.trim()) {
        return false;
      }
      execSync(command, { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  private checkFile(filePath: string): boolean {
    // Expand environment variables in the path
    const expandedPath = filePath.replace(/\$([A-Z_]+[A-Z0-9_]*)/g, (_match, varName: string) => {
      const envValue = process.env[varName];
      return envValue ?? '';
    });

    return existsSync(expandedPath);
  }

  private executeCustomCheck(checkLogic: string): boolean {
    try {
      // Parse the custom check as a JSON object with check configuration
      const checkConfig = this.parseCheckConfig(checkLogic);

      return match(checkConfig.type)
        .with('env', () => this.checkEnvironmentVariable(checkConfig as Extract<CheckConfig, { type: 'env' }>))
        .with('file-contains', () => this.checkFileContains(checkConfig as Extract<CheckConfig, { type: 'file-contains' }>))
        .with('path-includes', () => this.checkPathIncludes(checkConfig as Extract<CheckConfig, { type: 'path-includes' }>))
        .with('combined', () => this.checkCombined(checkConfig as Extract<CheckConfig, { type: 'combined' }>))
        .with('command', () => this.checkCommand((checkConfig as Extract<CheckConfig, { type: 'command' }>).command))
        .otherwise(() => this.checkCommand(checkLogic));
    } catch {
      // If parsing fails, treat as a simple command
      return this.checkCommand(checkLogic);
    }
  }

  private parseCheckConfig(checkLogic: string): CheckConfig {
    try {
      // Try to parse as JSON
      return parseJson(checkLogic) as CheckConfig;
    } catch {
      // If not JSON, return a simple command config
      return { type: 'command', command: checkLogic };
    }
  }

  private checkEnvironmentVariable(config: Extract<CheckConfig, { type: 'env' }>): boolean {
    const { variable, variables, value } = config;

        // Check single variable
    if (variable?.trim()) {
      const envValue = process.env[variable];
      if (envValue?.trim()) {
        if (value?.trim()) {
          return envValue === value;
        }
        return true;
      }
    }

    // Check multiple variables (any one present)
    if (variables && Array.isArray(variables)) {
      return variables.some(varName => {
        const envValue = process.env[varName];
        return envValue?.trim();
      });
    }

    return false;
  }

  private checkFileContains(config: Extract<CheckConfig, { type: 'file-contains' }>): boolean {
    const { file, pattern, patterns } = config;

    const expandedPath = file.replace(/\$([A-Z_]+[A-Z0-9_]*)/g, (_match, varName: string) => {
      const envValue = process.env[varName];
      return envValue ?? '';
    });

    if (!existsSync(expandedPath)) {
      return false;
    }

    try {
      const content = readFileSync(expandedPath, 'utf-8');

      if (pattern?.trim()) {
        return content.includes(pattern);
      }

      if (patterns && Array.isArray(patterns)) {
        return patterns.some(patternItem => content.includes(patternItem));
      }

      return false;
    } catch {
      return false;
    }
  }

  private checkPathIncludes(config: Extract<CheckConfig, { type: 'path-includes' }>): boolean {
    const { command, includes } = config;

    try {
      const result = execSync(command, { encoding: 'utf-8' }).trim();

      if (typeof includes === 'string') {
        return result.includes(includes);
      }

      if (Array.isArray(includes)) {
        return includes.some(includeItem => result.includes(includeItem));
      }

      return false;
    } catch {
      return false;
    }
  }

  private checkCombined(config: Extract<CheckConfig, { type: 'combined' }>): boolean {
    const { checks, operator = 'OR' } = config;

    if (!Array.isArray(checks)) {
      return false;
    }

    const results = checks.map(check => this.executeCustomCheck(stringify(check)));

    return match(operator.toUpperCase())
      .with('AND', () => results.every(result => result))
      .with('OR', () => results.some(result => result))
      .otherwise(() => false);
  }
}
