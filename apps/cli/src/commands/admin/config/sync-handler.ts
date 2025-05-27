import chalk from 'chalk';
import inquirer from 'inquirer';

import { DataManager } from '@/utils/config/data-manager';
import { ConfigManager } from '@/utils/config';
import type { ConfigBundle } from '@/utils/config/types';

export class SyncHandler {
  private dataManager = DataManager.getInstance();
  private configManager = ConfigManager.getInstance();

  async downloadConfig(options: {
    provider: string;
    repository?: string;
    branch?: string;
    token?: string;
    path?: string;
    gistId?: string;
    fileName?: string;
    localPath?: string;
  }): Promise<void> {
    try {
      console.log(chalk.cyan('📥 Downloading configuration...'));

      let bundle: ConfigBundle;
      let providerToUse = options.provider;
      let configToUse = { ...options };

      // If no specific options provided, try to use stored sync config
      if ((providerToUse === "github" && !options.repository) || (providerToUse === "gist" && !options.gistId) || providerToUse === "gist") {
        const syncConfig = await this.configManager.getSyncConfig();
        if (syncConfig) {
          providerToUse = syncConfig.defaultProvider;
          const providerConfig = syncConfig.providers[providerToUse as keyof typeof syncConfig.providers];

          if (providerToUse === "github" && providerConfig) {
            const githubConfig = providerConfig as any;
            configToUse = {
              ...configToUse,
              repository: githubConfig.repository,
              branch: githubConfig.branch,
              token: githubConfig.token,
              path: githubConfig.path,
            };
            console.log(chalk.gray(`Using stored ${providerToUse} configuration...`));
          } else if (providerToUse === "gist" && providerConfig) {
            const gistConfig = providerConfig as any;
            configToUse = {
              ...configToUse,
              gistId: gistConfig.gistId,
              fileName: gistConfig.fileName,
              token: gistConfig.token,
            };
            console.log(chalk.gray(`Using stored ${providerToUse} configuration...`));
          } else if (providerToUse === "local" && providerConfig) {
            const localConfig = providerConfig as any;
            configToUse = {
              ...configToUse,
              localPath: localConfig.path,
            };
            console.log(chalk.gray(`Using stored ${providerToUse} configuration...`));
          }
        }
      }

      if (providerToUse === "github") {
        if (!configToUse.repository) {
          console.log(chalk.red("❌ GitHub repository is required for GitHub provider"));
          console.log(chalk.gray("Example: --repository loveholidays/launchpad-config"));
          console.log(chalk.gray("Or configure it with: launchpad admin config providers:add"));
          return;
        }

        bundle = await this.dataManager.downloadConfigFromGitHub({
          repository: configToUse.repository,
          branch: configToUse.branch,
          token: configToUse.token,
          path: configToUse.path,
        });
      } else if (providerToUse === "gist") {
        if (!configToUse.gistId) {
          console.log(chalk.red("❌ No GitHub Gist configured"));
          console.log(chalk.gray("To download from a specific gist: --gist-id abc123def456"));
          console.log(chalk.gray("To configure a default gist: launchpad admin config providers:add"));
          console.log(chalk.gray("To upload and create a new gist: launchpad admin config upload"));
          return;
        }

        bundle = await this.dataManager.downloadConfigFromGist({
          gistId: configToUse.gistId,
          fileName: configToUse.fileName,
          token: configToUse.token,
        });
      } else if (providerToUse === "local") {
        if (!configToUse.localPath) {
          console.log(chalk.red("❌ Local path is required for local provider"));
          console.log(chalk.gray("Or configure it with: launchpad admin config providers:add"));
          return;
        }

        const fs = await import("node:fs/promises");
        const content = await fs.readFile(configToUse.localPath, "utf-8");
        bundle = JSON.parse(content) as ConfigBundle;
      } else {
        console.log(chalk.red(`❌ Unsupported provider: ${providerToUse}`));
        return;
      }

      console.log(chalk.yellow("⚠️  This will replace your current configuration."));
      console.log(chalk.gray(`Bundle version: ${bundle.version}`));
      console.log(chalk.gray(`Bundle timestamp: ${bundle.timestamp}`));
      console.log(chalk.gray(`Teams: ${bundle.teams.length}`));
      console.log(chalk.gray(`Setup components: ${bundle.setupComponents.length}`));
      console.log(chalk.gray(`Global docs: ${bundle.globalDocs.length}`));

      const { confirm } = await inquirer.prompt([
        {
          type: "confirm",
          name: "confirm",
          message: "Do you want to proceed with the import?",
          default: false,
        },
      ]);

      if (!confirm) {
        console.log(chalk.gray("Import cancelled."));
        return;
      }

      await this.dataManager.importConfigBundle(bundle);

      // Update last sync time
      await this.configManager.updateSyncConfig({
        lastSync: new Date().toISOString(),
      });

      console.log(chalk.green("✅ Configuration downloaded and imported successfully!"));
    } catch (error) {
      console.error(chalk.red(`❌ Failed to download config: ${error}`));
    }
  }

  async uploadConfig(options: {
    provider: string;
    repository?: string;
    branch?: string;
    token?: string;
    path?: string;
    message?: string;
    gistId?: string;
    fileName?: string;
    description?: string;
    localPath?: string;
  }): Promise<void> {
    try {
      console.log(chalk.cyan("📤 Creating configuration bundle..."));

      const bundle = await this.dataManager.createConfigBundle();

      console.log(chalk.gray("Bundle created with:"));
      console.log(chalk.gray(`  Teams: ${bundle.teams.length}`));
      console.log(chalk.gray(`  Setup components: ${bundle.setupComponents.length}`));
      console.log(chalk.gray(`  Global docs: ${bundle.globalDocs.length}`));

      let providerToUse = options.provider;
      let configToUse = { ...options };

      // If no specific options provided, try to use stored sync config
      if ((providerToUse === "github" && !options.repository) || (providerToUse === "gist" && !options.gistId) || providerToUse === "gist") {
        const syncConfig = await this.configManager.getSyncConfig();
        if (syncConfig) {
          providerToUse = syncConfig.defaultProvider;
          const providerConfig = syncConfig.providers[providerToUse as keyof typeof syncConfig.providers];

          if (providerToUse === "github" && providerConfig) {
            const githubConfig = providerConfig as any;
            configToUse = {
              ...configToUse,
              repository: githubConfig.repository,
              branch: githubConfig.branch,
              token: githubConfig.token,
              path: githubConfig.path,
            };
            console.log(chalk.gray(`Using stored ${providerToUse} configuration...`));
          } else if (providerToUse === "gist" && providerConfig) {
            const gistConfig = providerConfig as any;
            configToUse = {
              ...configToUse,
              gistId: gistConfig.gistId,
              fileName: gistConfig.fileName,
              token: gistConfig.token,
              description: gistConfig.description,
            };
            console.log(chalk.gray(`Using stored ${providerToUse} configuration...`));
          } else if (providerToUse === "local" && providerConfig) {
            const localConfig = providerConfig as any;
            configToUse = {
              ...configToUse,
              localPath: localConfig.path,
            };
            console.log(chalk.gray(`Using stored ${providerToUse} configuration...`));
          }
        }
      }

      if (providerToUse === "github") {
        if (!configToUse.repository) {
          console.log(chalk.red("❌ GitHub repository is required for GitHub provider"));
          console.log(chalk.gray("Example: --repository loveholidays/launchpad-config"));
          console.log(chalk.gray("Or configure it with: launchpad admin config providers:add"));
          return;
        }

        if (!configToUse.token) {
          console.log(chalk.red("❌ GitHub token is required for uploading"));
          console.log(chalk.gray("Create a token at: https://github.com/settings/tokens"));
          console.log(chalk.gray("Or configure it with: launchpad admin config providers:add"));
          return;
        }

        await this.dataManager.uploadConfigToGitHub(bundle, {
          repository: configToUse.repository,
          branch: configToUse.branch,
          token: configToUse.token,
          path: configToUse.path,
          message: configToUse.message,
        });
      } else if (providerToUse === "gist") {
        if (!configToUse.token) {
          console.log(chalk.red("❌ GitHub token is required for Gist uploads"));
          console.log(chalk.gray("Create a token at: https://github.com/settings/tokens"));
          console.log(chalk.gray("Then use: --token YOUR_TOKEN"));
          console.log(chalk.gray("Or configure it permanently: launchpad admin config providers:add"));
          return;
        }

        const resultGistId = await this.dataManager.uploadConfigToGist(bundle, {
          gistId: configToUse.gistId,
          fileName: configToUse.fileName,
          token: configToUse.token,
          description: configToUse.description,
          saveConfig: !configToUse.gistId, // Save config when creating new gist
        });

        // If we created a new gist and don't have stored config, save it
        if (!configToUse.gistId && resultGistId) {
          const syncConfig = await this.configManager.getSyncConfig();
          if (!syncConfig?.providers.gist) {
            console.log(chalk.cyan("🔧 Setting up Gist as your default sync provider..."));
            await this.configManager.setSyncProvider("gist", {
              gistId: resultGistId,
              fileName: configToUse.fileName || 'launchpad-config.json',
              token: configToUse.token,
              description: configToUse.description || 'Launchpad configuration',
            });
            await this.configManager.setDefaultSyncProvider("gist");
          }
        }
      } else if (providerToUse === "local") {
        if (!configToUse.localPath) {
          console.log(chalk.red("❌ Local path is required for local provider"));
          console.log(chalk.gray("Or configure it with: launchpad admin config providers:add"));
          return;
        }

        const fs = await import("node:fs/promises");
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `launchpad-config-${timestamp}.json`;
        const fullPath = require("node:path").join(configToUse.localPath, fileName);

        await fs.writeFile(fullPath, JSON.stringify(bundle, null, 2));
        console.log(chalk.green(`✅ Configuration saved to: ${fullPath}`));
      } else {
        console.log(chalk.red(`❌ Unsupported provider: ${providerToUse}`));
        return;
      }

      // Update last sync time
      await this.configManager.updateSyncConfig({
        lastSync: new Date().toISOString(),
      });

      console.log(chalk.green("✅ Configuration uploaded successfully!"));
    } catch (error) {
      console.error(chalk.red(`❌ Failed to upload config: ${error}`));
    }
  }

  async setupSyncConfig(): Promise<void> {
    console.log(chalk.cyan("\n🔄 Setup Sync Configuration"));
    console.log(chalk.gray("─".repeat(40)));

    const existingSync = await this.configManager.getSyncConfig();
    if (existingSync) {
      console.log(chalk.yellow("⚠️  Sync configuration already exists."));
      console.log(chalk.gray(`Current default provider: ${existingSync.defaultProvider}`));

      const { overwrite } = await inquirer.prompt([
        {
          type: "confirm",
          name: "overwrite",
          message: "Do you want to reconfigure sync settings?",
          default: false,
        },
      ]);

      if (!overwrite) {
        console.log(chalk.gray("Setup cancelled."));
        return;
      }
    }

    const answers = await inquirer.prompt([
      {
        type: "list",
        name: "defaultProvider",
        message: "Choose your default sync provider:",
        choices: [
          { name: "GitHub Gist (simple file sharing) - Recommended", value: "gist" },
          { name: "GitHub (repository sync)", value: "github" },
          { name: "Local (file system backup)", value: "local" },
          { name: "Google Drive (cloud storage)", value: "googledrive" },
        ],
      },
      {
        type: "confirm",
        name: "autoSync",
        message: "Enable automatic sync?",
        default: false,
      },
    ]);

    await this.configManager.updateSyncConfig({
      defaultProvider: answers.defaultProvider,
      autoSync: answers.autoSync,
    });

    console.log(chalk.green("✅ Sync configuration created successfully!"));
    console.log(chalk.gray(`Default provider: ${answers.defaultProvider}`));
    console.log(chalk.gray(`Auto sync: ${answers.autoSync ? "Enabled" : "Disabled"}`));
    console.log(chalk.cyan("\n💡 Next: Configure your provider with 'launchpad admin config providers:add'"));
  }
}
