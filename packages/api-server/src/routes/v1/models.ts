import { Router, type IRouter } from "express";
import { registry } from "../../gateway/index.js";
import { META_MODEL_ENTRIES } from "../../gateway/config.js";

const modelsRouter: IRouter = Router();

modelsRouter.get("/", (_req, res) => {
  const providerModels = registry.getAllModels();
  const all = [...META_MODEL_ENTRIES, ...providerModels];

  res.json({
    object: "list",
    data: all,
  });
});

export default modelsRouter;
