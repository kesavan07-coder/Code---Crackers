import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import authRoutes from "./routes/auth";
import competitionRoutes from "./routes/competition";
import round1Routes from "./routes/round1";
import adminQuestionsRoutes from "./routes/adminQuestions";
import adminParticipantsRoutes from "./routes/adminParticipants";
import round2Routes from "./routes/round2";
import adminQuestionsCodingRoutes from "./routes/adminQuestionsCoding";
import round3Routes from "./routes/round3";
import adminQuestionsDebugRoutes from "./routes/adminQuestionsDebug";
import portalManagementRoutes from "./routes/portalManagement";
import adminManagementRoutes from "./routes/adminManagement";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure data directory exists for lowdb file
const dataDir = path.join(__dirname, "../../data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// CORS — allow Next.js dev server & Vercel production domains
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/competition", competitionRoutes);
app.use("/api/round1", round1Routes);
app.use("/api/round2", round2Routes);
app.use("/api/round3", round3Routes);
app.use("/api/admin/questions", adminQuestionsRoutes);
app.use("/api/admin/questions", adminQuestionsCodingRoutes);
app.use("/api/admin/questions", adminQuestionsDebugRoutes);
app.use("/api/admin/participants", adminParticipantsRoutes);
app.use("/api/admin/management", adminManagementRoutes);
app.use("/api/portal", portalManagementRoutes);

// Health check
app.get("/status", (req, res) => {
  res.json({ status: "online", time: new Date().toISOString(), db: "lowdb (file-based)" });
});

// Start server — no async DB connection needed, lowdb is synchronous
app.listen(PORT, () => {
  console.log("=====================================");
  console.log(" Code Crackers Backend");
  console.log(` Listening on http://localhost:${PORT}`);
  console.log(` Database: lowdb → data/db.json`);
  console.log("=====================================");
  console.log("First time? Call POST /api/auth/seed to create test accounts.");
});
