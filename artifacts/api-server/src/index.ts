import app from "./app";
import { logger } from "./lib/logger";
import { startCreatorMembershipRefresh } from "./lib/creator-program";
import { startCreatorMediaCleanup } from "./lib/creator-media-cleanup";
import { startAnalyticsMaintenance } from "./lib/analytics-events";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startCreatorMembershipRefresh();
  startCreatorMediaCleanup();
  startAnalyticsMaintenance();
});
