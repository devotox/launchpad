import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';

import chalk from 'chalk';

export class LogManager {
  private logDir: string;

  constructor(logDir: string) {
    this.logDir = logDir;
  }

  async showLogs(repo: string, follow = false): Promise<void> {
    try {
      const logFiles = await this.findLogFiles(repo);

      if (logFiles.length === 0) {
        console.log(chalk.yellow(`No log files found for repository '${repo}'.`));
        return;
      }

      const latestLogFile = this.getLatestLogFile(logFiles);
      console.log(chalk.cyan(`\n📋 Showing logs for ${repo}: ${latestLogFile}\n`));

      if (follow) {
        await this.followLogFile(latestLogFile);
      } else {
        await this.displayLogFile(latestLogFile);
      }
    } catch (error) {
      console.log(chalk.red(`❌ Failed to show logs for ${repo}:`));
      console.log(chalk.red(`   ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  private async findLogFiles(repo: string): Promise<string[]> {
    try {
      const files = await fs.readdir(this.logDir);
      return files
        .filter((file) => file.startsWith(`${repo}-`) && file.endsWith('.log'))
        .map((file) => `${this.logDir}/${file}`);
    } catch {
      return [];
    }
  }

  private getLatestLogFile(logFiles: string[]): string {
    // Sort by modification time (newest first)
    const sortedFiles = logFiles.sort((a, b) => {
      // Extract timestamp from filename
      const timestampA = this.extractTimestamp(a);
      const timestampB = this.extractTimestamp(b);
      return timestampB - timestampA;
    });

    const latestFile = sortedFiles[0];
    if (!latestFile) {
      throw new Error('No log files available');
    }

    return latestFile;
  }

  private extractTimestamp(filePath: string): number {
    const filename = filePath.split('/').pop() || '';
    const timestampMatch = filename.match(/-(\d+)\.log$/);
    if (timestampMatch?.[1]) {
      return Number.parseInt(timestampMatch[1], 10);
    }
    return 0;
  }

  private async displayLogFile(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim());

      for (const line of lines) {
        this.formatLogLine(line);
      }
    } catch (error) {
      console.log(
        chalk.red(
          `Failed to read log file: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  private async followLogFile(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tailProcess = spawn('tail', ['-f', filePath], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      tailProcess.stdout.on('data', (data: Buffer) => {
        const lines = data
          .toString()
          .split('\n')
          .filter((line) => line.trim());
        for (const line of lines) {
          this.formatLogLine(line);
        }
      });

      tailProcess.stderr.on('data', (data: Buffer) => {
        console.log(chalk.red(`Tail error: ${data.toString()}`));
      });

      tailProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Tail process failed with code ${code}`));
        }
      });

      tailProcess.on('error', reject);

      // Handle Ctrl+C to stop following
      process.on('SIGINT', () => {
        console.log(chalk.yellow('\n📋 Stopped following logs.'));
        tailProcess.kill('SIGTERM');
        resolve();
      });
    });
  }

  private formatLogLine(line: string): void {
    if (line.startsWith('[STDOUT]')) {
      const content = line.substring(8).trim();
      console.log(chalk.gray(content));
    } else if (line.startsWith('[STDERR]')) {
      const content = line.substring(8).trim();
      console.log(chalk.red(content));
    } else {
      console.log(line);
    }
  }
}
