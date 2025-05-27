import { Command } from 'commander';

import { TeamsCommand } from './teams';
import { ComponentsCommand } from './components';
import { DocsCommand } from './docs';
import { ConfigCommand } from './config';
import { InfoCommand } from './info';

export class AdminCommand {
  getCommand(): Command {
    const adminCmd = new Command('admin')
      .description('Administrative commands for managing teams and configuration');

    // Add sub-command handlers
    const teamsCommand = new TeamsCommand();
    const componentsCommand = new ComponentsCommand();
    const docsCommand = new DocsCommand();
    const configCommand = new ConfigCommand();
    const infoCommand = new InfoCommand();

    // Register all sub-commands
    adminCmd.addCommand(teamsCommand.getCommand());
    adminCmd.addCommand(componentsCommand.getCommand());
    adminCmd.addCommand(docsCommand.getCommand());
    adminCmd.addCommand(configCommand.getCommand());
    adminCmd.addCommand(infoCommand.getCommand());

    return adminCmd;
  }
}
