import { Router, type IRouter } from "express";
import healthRouter from "./health";
import contactsRouter from "./contacts";
import relationshipsRouter from "./relationships";
import chatMessagesRouter from "./chatMessages";
import memoryRouter from "./memory";
import statusRouter from "./status";
import dashboardRouter from "./dashboard";
import openaiRouter from "./openai";
import usersRouter from "./users";
import versionRouter from "./version";

const router: IRouter = Router();

router.use(healthRouter);
router.use(versionRouter);
router.use(usersRouter);
router.use(contactsRouter);
router.use(relationshipsRouter);
router.use(chatMessagesRouter);
router.use(memoryRouter);
router.use(statusRouter);
router.use(dashboardRouter);
router.use(openaiRouter);

export default router;
