import { LaunchpadCLI } from "@/cli";

const cli = new LaunchpadCLI();
cli.run().catch((error: Error) => {
  console.error("Error running Launchpad CLI:", error.message);
  process.exit(1);
});
