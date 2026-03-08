import express from "express";
import { identify } from "./identify.js";
import type { IdentifyRequest } from "./types.js";

const app = express();
app.use(express.json());

app.post("/identify", (req, res) => {
  try {
    const body = req.body as IdentifyRequest;
    const result = identify(body);
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Bad request" });
  }
});

const port = process.env.PORT ?? 3000;
app.listen(port, () => console.log(`Server on http://localhost:${port}`));
