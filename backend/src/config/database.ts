import low from "lowdb";
import FileSync from "lowdb/adapters/FileSync";
import path from "path";
import { v4 as uuidv4 } from "uuid";

// ── Schema ──────────────────────────────────────────────────────────
export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  role: "super_admin" | "admin" | "participant";
  permissions?: string[];
  department?: string;
  email?: string;
  isActive: boolean;
  currentSessionToken: string | null;
  createdAt: string;
  fullName?: string;
  year?: string;
  college?: string;
  isApproved: boolean;
  isLocked: boolean;
  loginEnabled: boolean;
  qualificationStatus?: "waiting" | "qualified" | "eliminated";
  roundPermissions?: Record<number, "open" | "locked" | "skipped" | "completed" | "disqualified">;
  timerExtensionSeconds?: number;
  scoreOverrides?: Record<number, number>;
  displayPassword?: string;  // plain-text stored at creation for printing credentials
  firstLoginCompleted?: boolean; // tracks if participant completed first-time profile name setup
}

export interface DynamicRound {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: "mcq" | "coding" | "bug_hunter" | "rapid_fire" | "manual" | "custom";
  order: number;
  timeLimit: number;           // minutes
  countdownDuration: number;   // seconds (default 10)
  maxScore: number;
  passingScore: number;
  enabled: boolean;
  leaderboardEnabled: boolean;
  antiCheatEnabled: boolean;
  fullscreenRequired: boolean;
  tabDetectionEnabled: boolean;
  copyProtectionEnabled: boolean;
  autoSubmitOnTimeout: boolean;
  autoSubmitOnViolation: boolean;
  allowResubmission: boolean;
}

export interface RoundTemplate {
  id: string;
  name: string;
  type: string;
  description: string;
  icon: string;
  timeLimit: number;
  maxScore: number;
  passingScore: number;
  questionSchema: Record<string, any>;
  sampleQuestions?: any[];
  isBuiltIn?: boolean;
  createdAt?: string;
}

export interface PortalSettings {
  // General Branding & Institution Details
  eventName: string;
  eventSubtitle: string;
  collegeName: string;
  collegeLogo?: string;
  departmentName: string;
  departmentLogo?: string;
  symposiumName: string;
  academicYear?: string;
  eventDate: string;
  venue: string;
  coordinatorName: string;
  hodName: string;
  principalName?: string;
  contactNumber?: string;
  emailAddress?: string;
  website?: string;
  address?: string;
  contactDetails: string;
  browserTitle: string;
  themeColor: string;
  maintenanceMode?: boolean;
  savedTemplates?: RoundTemplate[];
  // Custom Participant-Facing Notification Messages
  messages: {
    waitingForEvaluation: string;
    roundStarted: string;
    roundCompleted: string;
    qualified: string;
    eliminated: string;
    countdownMessage: string;
    submissionSuccessful: string;
    sessionExpired: string;
    fullscreenWarning: string;
    tabSwitchWarning: string;
  };
  // Leaderboard display prefs
  leaderboardShowScore: boolean;
  leaderboardShowTimeTaken: boolean;
  leaderboardShowCollege: boolean;
  leaderboardShowDepartment: boolean;
  leaderboardRankingMethod: "score_then_time" | "score_only";
}

export interface CompetitionSettingsRecord {
  currentRound: number;
  roundStatus: "locked" | "open" | "closed";
  competitionState: "idle" | "running" | "paused" | "ended";
  startedAt: string | null;
  endsAt: string | null;
  fullscreenModeEnabled: boolean;
  rightClickBlocked: boolean;
  copyPasteRestricted: boolean;
  keyboardShortcutsBlocked: boolean;
  devToolsDetectionEnabled: boolean;
  tabSwitchDetectionEnabled: boolean;
  autoSubmitOnTabSwitch: boolean;
  autoSubmitOnFullscreenExit: boolean;
  singleDeviceLoginEnabled: boolean;
  autoSaveIntervalSeconds: number;
  timerMode: "global" | "individual";
  announcement: string | null;
  broadcastMessage: string | null;
  resultsPublished: boolean;
  roundDurations?: Record<number, number>;
  roundStartedAt?: Record<number, string | null>;
  // New Phase 6 fields
  countdownStartedAt?: Record<number, string | null>;   // when admin starts countdown per round
  publishedLeaderboards?: Record<string, boolean>;       // "1","2","3","overall" → true/false
  portalSettings?: PortalSettings;
  dynamicRounds?: DynamicRound[];
}

export interface QuestionMCQRecord {
  id: string;
  roundId?: string; // "built_in_1" or custom round id
  questionText: string;
  options: string[];
  correctAnswer: number; // 0-3 index
  difficulty: "easy" | "medium" | "hard";
  order: number;
}

export interface SubmissionRecord {
  id: string;
  userId: string;
  roundId: number | string; // 1, 2, 3 or custom round id
  // Holds current state of answers: { "questionId": { answer: number, markedForReview: boolean } }
  answerData: Record<string, { answer: number | null; markedForReview: boolean }>;
  submittedAt: string | null;
  status: "in_progress" | "submitted";
  tabSwitchCount: number;
  updatedAt: string;
}

export interface TestCase {
  input: string;
  expectedOutput: string;
  label?: string;
}

export interface QuestionCodingRecord {
  id: string;
  roundId?: string;
  title: string;
  story: string;           // Narrative/problem description (markdown supported)
  examples: Array<{ input: string; output: string; explanation?: string }>;
  constraints: string;
  visibleTestCases: TestCase[];
  difficulty: "easy" | "medium" | "hard";
  order: number;
  timeLimit: number;       // seconds
  memoryLimit: number;     // MB
}

// Per-question code save for Round 2
export interface CodeAnswerData {
  code: string;
  language: string;        // "javascript" | "python" | "java" | "cpp" | "c"
  lastSaved: string | null;
  isSubmitted: boolean;
}

export interface CodeSubmissionRecord {
  id: string;
  userId: string;
  roundId: number | string;
  // keyed by questionId → code answer data
  answerData: Record<string, CodeAnswerData>;
  submittedAt: string | null;
  status: "in_progress" | "submitted";
  updatedAt: string;
  tabSwitchCount: number;
}

// ── Round 3: Bug Hunter ─────────────────────────────────────────────────
export interface QuestionDebugRecord {
  id: string;
  roundId?: string;
  title: string;
  description: string;        // What the code is supposed to do
  buggyCode: string;          // The code with intentional bugs
  fixedCode: string;          // Correct version (used by admin for scoring)
  language: string;           // Language of the buggy code (javascript, python, etc.)
  hints: string[];            // Optional hints revealed per attempt
  points: number;             // Points awarded for correct fix
  difficulty: "easy" | "medium" | "hard";
  order: number;
}

export interface DebugAnswerData {
  fixedCode: string;
  language: string;
  lastSaved: string | null;
  isSubmitted: boolean;
  pointsEarned: number;
}

export interface DebugSubmissionRecord {
  id: string;
  userId: string;
  roundId: number | string;
  answerData: Record<string, DebugAnswerData>;
  submittedAt: string | null;
  status: "in_progress" | "submitted";
  updatedAt: string;
  tabSwitchCount: number;
}

export interface DynamicSubmissionRecord {
  id: string;
  userId: string;
  roundId: string | number;
  answerData: Record<string, any>;
  score: number;
  submittedAt: string | null;
  status: "in_progress" | "submitted";
  updatedAt: string;
  tabSwitchCount: number;
}

interface Schema {
  users: UserRecord[];
  competition: CompetitionSettingsRecord;
  questionsMCQ: QuestionMCQRecord[];
  questionsCoding: QuestionCodingRecord[];
  questionsDebug: QuestionDebugRecord[];
  submissions: SubmissionRecord[];
  codeSubmissions: CodeSubmissionRecord[];
  debugSubmissions: DebugSubmissionRecord[];
  dynamicSubmissions: DynamicSubmissionRecord[];
  activityLog: Array<{
    id: string;
    userId: string;
    action: string;
    timestamp: string;
    metadata: Record<string, unknown>;
  }>;
}

const DB_PATH = path.join(__dirname, "../../data/db.json");

const adapter = new FileSync<Schema>(DB_PATH);
export const db = low(adapter);

// Set defaults (first-time init)
db.defaults({
  users: [],
  competition: {
    currentRound: 0,
    roundStatus: "locked",
    competitionState: "idle",
    startedAt: null,
    endsAt: null,
    fullscreenModeEnabled: false,
    rightClickBlocked: false,
    copyPasteRestricted: false,
    keyboardShortcutsBlocked: false,
    devToolsDetectionEnabled: false,
    tabSwitchDetectionEnabled: false,
    autoSubmitOnTabSwitch: false,
    autoSubmitOnFullscreenExit: false,
    singleDeviceLoginEnabled: true,
    autoSaveIntervalSeconds: 30,
    timerMode: "global",
    announcement: null,
    broadcastMessage: null,
    resultsPublished: false,
    roundDurations: { 1: 30, 2: 45, 3: 20 },
    countdownStartedAt: { 1: null, 2: null, 3: null },
    publishedLeaderboards: { "1": false, "2": false, "3": false, "overall": false },
    portalSettings: {
      eventName: "Code Crackers",
      eventSubtitle: "Technical Quiz Competition",
      collegeName: "Muthayammal Engineering College (Autonomous)",
      departmentName: "Department of Computer Science & Business Systems",
      symposiumName: "NEXUS'26",
      eventDate: "",
      venue: "",
      coordinatorName: "",
      hodName: "",
      contactDetails: "",
      browserTitle: "Code Crackers – NEXUS'26",
      themeColor: "#000000",
      messages: {
        waitingForEvaluation: "Your submission has been received. Please wait while organizers evaluate all participants. The leaderboard will be available after it is published by the admin.",
        roundStarted: "Round has started! Good luck!",
        roundCompleted: "You have completed this round. Waiting for results.",
        qualified: "Congratulations! You have qualified for the next round.",
        eliminated: "Thank you for participating. Better luck next time!",
        countdownMessage: "Get Ready! The round is about to begin.",
        submissionSuccessful: "Your answers have been submitted successfully.",
        sessionExpired: "Your session has expired. Please log in again.",
        fullscreenWarning: "Please remain in fullscreen mode during the competition.",
        tabSwitchWarning: "Tab switching detected! Please stay on the competition page.",
      },
      leaderboardShowScore: true,
      leaderboardShowTimeTaken: true,
      leaderboardShowCollege: true,
      leaderboardShowDepartment: true,
      leaderboardRankingMethod: "score_then_time",
    },
    dynamicRounds: [],
  },
  questionsMCQ: [],
  questionsCoding: [],
  questionsDebug: [],
  submissions: [],
  codeSubmissions: [],
  debugSubmissions: [],
  dynamicSubmissions: [],
  activityLog: [],
}).write();

export const DynamicSubmissions = {
  find(query: Partial<DynamicSubmissionRecord>): DynamicSubmissionRecord[] {
    return (db.get("dynamicSubmissions").value() ? db.get("dynamicSubmissions").filter(query).value() : []) as DynamicSubmissionRecord[];
  },

  findOne(query: Partial<DynamicSubmissionRecord>): DynamicSubmissionRecord | undefined {
    return (db.get("dynamicSubmissions").value() ? db.get("dynamicSubmissions").find(query).value() : undefined) as DynamicSubmissionRecord | undefined;
  },

  create(data: Omit<DynamicSubmissionRecord, "id" | "updatedAt" | "tabSwitchCount"> & Partial<DynamicSubmissionRecord>): DynamicSubmissionRecord {
    const record: DynamicSubmissionRecord = {
      id: uuidv4(),
      userId: data.userId,
      roundId: data.roundId,
      answerData: data.answerData || {},
      score: data.score ?? 0,
      submittedAt: data.submittedAt || null,
      status: data.status || "in_progress",
      updatedAt: new Date().toISOString(),
      tabSwitchCount: data.tabSwitchCount ?? 0,
    };
    if (!db.get("dynamicSubmissions").value()) {
      db.set("dynamicSubmissions", []).write();
    }
    db.get("dynamicSubmissions").push(record).write();
    return record;
  },

  update(id: string, patch: Partial<DynamicSubmissionRecord>): DynamicSubmissionRecord | undefined {
    db.get("dynamicSubmissions").find({ id }).assign({ ...patch, updatedAt: new Date().toISOString() }).write();
    return db.get("dynamicSubmissions").find({ id }).value() as DynamicSubmissionRecord | undefined;
  },
};


// ── Helper functions (Mongoose-like API) ────────────────────────────
export const Users = {
  findOne(query: Partial<UserRecord>): UserRecord | undefined {
    return db.get("users").find(query).value() as UserRecord | undefined;
  },

  findById(id: string): UserRecord | undefined {
    return db.get("users").find({ id }).value() as UserRecord | undefined;
  },

  findAll(): UserRecord[] {
    return db.get("users").value() as UserRecord[];
  },

  create(data: Omit<UserRecord, "id" | "createdAt" | "isApproved" | "isLocked" | "loginEnabled" | "qualificationStatus" | "timerExtensionSeconds"> & Partial<UserRecord>): UserRecord {
    const user: UserRecord = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      isApproved: data.role === "admin" ? true : false,
      isLocked: false,
      loginEnabled: true,
      qualificationStatus: "waiting",
      timerExtensionSeconds: 0,
      roundPermissions: { 1: "locked", 2: "locked", 3: "locked" },
      scoreOverrides: {},
      ...data,
    };
    db.get("users").push(user).write();
    return user;
  },

  update(id: string, patch: Partial<UserRecord>): UserRecord | undefined {
    db.get("users").find({ id }).assign(patch).write();
    return Users.findById(id);
  },

  remove(id: string): void {
    db.get("users").remove({ id }).write();
  },

  count(): number {
    return db.get("users").value().length;
  },
};

export const Competition = {
  get(): CompetitionSettingsRecord {
    return db.get("competition").value() as CompetitionSettingsRecord;
  },

  update(patch: Partial<CompetitionSettingsRecord>): void {
    db.get("competition").assign(patch).write();
  },
};

export const QuestionsMCQ = {
  findAll(): QuestionMCQRecord[] {
    return db.get("questionsMCQ").sortBy("order").value() as QuestionMCQRecord[];
  },

  findById(id: string): QuestionMCQRecord | undefined {
    return db.get("questionsMCQ").find({ id }).value() as QuestionMCQRecord | undefined;
  },

  create(data: Omit<QuestionMCQRecord, "id">): QuestionMCQRecord {
    const record: QuestionMCQRecord = {
      id: uuidv4(),
      ...data,
    };
    db.get("questionsMCQ").push(record).write();
    return record;
  },

  update(id: string, patch: Partial<QuestionMCQRecord>): QuestionMCQRecord | undefined {
    db.get("questionsMCQ").find({ id }).assign(patch).write();
    return QuestionsMCQ.findById(id);
  },

  remove(id: string): void {
    db.get("questionsMCQ").remove({ id }).write();
  },

  count(): number {
    return db.get("questionsMCQ").value().length;
  },
};

export const Submissions = {
  find(query: Partial<SubmissionRecord>): SubmissionRecord[] {
    return db.get("submissions").filter(query).value() as SubmissionRecord[];
  },

  findOne(query: Partial<SubmissionRecord>): SubmissionRecord | undefined {
    return db.get("submissions").find(query).value() as SubmissionRecord | undefined;
  },

  create(data: Omit<SubmissionRecord, "id" | "updatedAt">): SubmissionRecord {
    const record: SubmissionRecord = {
      id: uuidv4(),
      updatedAt: new Date().toISOString(),
      ...data,
    };
    db.get("submissions").push(record).write();
    return record;
  },

  update(id: string, patch: Partial<SubmissionRecord>): SubmissionRecord | undefined {
    db.get("submissions").find({ id }).assign({ ...patch, updatedAt: new Date().toISOString() }).write();
    return db.get("submissions").find({ id }).value() as SubmissionRecord | undefined;
  },
};

export const ActivityLog = {
  add(userId: string, action: string, metadata: Record<string, unknown> = {}): void {
    db
      .get("activityLog")
      .push({ id: uuidv4(), userId, action, timestamp: new Date().toISOString(), metadata })
      .write();
  },

  getByUser(userId: string) {
    return db.get("activityLog").filter({ userId }).value();
  },
};

export const QuestionsCoding = {
  findAll(): QuestionCodingRecord[] {
    return db.get("questionsCoding").sortBy("order").value() as QuestionCodingRecord[];
  },

  findById(id: string): QuestionCodingRecord | undefined {
    return db.get("questionsCoding").find({ id }).value() as QuestionCodingRecord | undefined;
  },

  create(data: Omit<QuestionCodingRecord, "id">): QuestionCodingRecord {
    const record: QuestionCodingRecord = { id: uuidv4(), ...data };
    db.get("questionsCoding").push(record).write();
    return record;
  },

  update(id: string, patch: Partial<QuestionCodingRecord>): QuestionCodingRecord | undefined {
    db.get("questionsCoding").find({ id }).assign(patch).write();
    return QuestionsCoding.findById(id);
  },

  remove(id: string): void {
    db.get("questionsCoding").remove({ id }).write();
  },

  count(): number {
    return db.get("questionsCoding").value().length;
  },
};

export const CodeSubmissions = {
  findOne(query: Partial<CodeSubmissionRecord>): CodeSubmissionRecord | undefined {
    return db.get("codeSubmissions").find(query).value() as CodeSubmissionRecord | undefined;
  },

  find(query: Partial<CodeSubmissionRecord>): CodeSubmissionRecord[] {
    return db.get("codeSubmissions").filter(query).value() as CodeSubmissionRecord[];
  },

  create(data: Omit<CodeSubmissionRecord, "id" | "updatedAt" | "tabSwitchCount"> & Partial<CodeSubmissionRecord>): CodeSubmissionRecord {
    const record: CodeSubmissionRecord = {
      id: uuidv4(),
      updatedAt: new Date().toISOString(),
      tabSwitchCount: 0,
      ...data,
    } as CodeSubmissionRecord;
    db.get("codeSubmissions").push(record).write();
    return record;
  },
  
  update(id: string, patch: Partial<CodeSubmissionRecord>): CodeSubmissionRecord | undefined {
    db.get("codeSubmissions").find({ id }).assign({ ...patch, updatedAt: new Date().toISOString() }).write();
    return db.get("codeSubmissions").find({ id }).value() as CodeSubmissionRecord | undefined;
  },
};

export const QuestionsDebug = {
  findAll(): QuestionDebugRecord[] {
    return db.get("questionsDebug").sortBy("order").value() as QuestionDebugRecord[];
  },

  findById(id: string): QuestionDebugRecord | undefined {
    return db.get("questionsDebug").find({ id }).value() as QuestionDebugRecord | undefined;
  },

  create(data: Omit<QuestionDebugRecord, "id">): QuestionDebugRecord {
    const record: QuestionDebugRecord = { id: uuidv4(), ...data };
    db.get("questionsDebug").push(record).write();
    return record;
  },

  update(id: string, patch: Partial<QuestionDebugRecord>): QuestionDebugRecord | undefined {
    db.get("questionsDebug").find({ id }).assign(patch).write();
    return QuestionsDebug.findById(id);
  },

  remove(id: string): void {
    db.get("questionsDebug").remove({ id }).write();
  },

  count(): number {
    return db.get("questionsDebug").value().length;
  },
};

export const DebugSubmissions = {
  findOne(query: Partial<DebugSubmissionRecord>): DebugSubmissionRecord | undefined {
    return db.get("debugSubmissions").find(query).value() as DebugSubmissionRecord | undefined;
  },

  find(query: Partial<DebugSubmissionRecord>): DebugSubmissionRecord[] {
    return db.get("debugSubmissions").filter(query).value() as DebugSubmissionRecord[];
  },

  create(data: Omit<DebugSubmissionRecord, "id" | "updatedAt" | "tabSwitchCount"> & Partial<DebugSubmissionRecord>): DebugSubmissionRecord {
    const record: DebugSubmissionRecord = {
      id: uuidv4(),
      updatedAt: new Date().toISOString(),
      tabSwitchCount: 0,
      ...data,
    } as DebugSubmissionRecord;
    db.get("debugSubmissions").push(record).write();
    return record;
  },

  update(id: string, patch: Partial<DebugSubmissionRecord>): DebugSubmissionRecord | undefined {
    db.get("debugSubmissions").find({ id }).assign({ ...patch, updatedAt: new Date().toISOString() }).write();
    return db.get("debugSubmissions").find({ id }).value() as DebugSubmissionRecord | undefined;
  },
};
