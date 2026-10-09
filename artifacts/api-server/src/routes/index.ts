import { Router, type IRouter } from "express";
import authRouter from "./auth";
import cognitoRouter from "./cognito";
import healthRouter from "./health";
import socialRouter from "./social";
import creatorProgramRouter from "./creator-program";
import creatorContentRouter from "./creator-content";
import accountProfessionalRouter from "./account-professional";
import analyticsEventsRouter from "./analytics-events";
import analyticsReportRouter from "./analytics-report";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(cognitoRouter);
router.use(socialRouter);
router.use(creatorProgramRouter);
router.use(creatorContentRouter);
router.use(accountProfessionalRouter);
router.use(analyticsEventsRouter);
router.use(analyticsReportRouter);

export default router;
