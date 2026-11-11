import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { atomicWriteFile } from "../knowledge/fs.js";
import { KnowledgeError } from "../knowledge/errors.js";

export const TOPIC_STATUSES = ["not_started", "learning", "understood", "mastered"] as const;
export type TopicStatus = (typeof TOPIC_STATUSES)[number];

export type TopicRecord = {
  name: string;
  status: TopicStatus;
  lastStudied?: string;
};

export type SubjectRecord = {
  subject: string;
  topics: TopicRecord[];
};

export type RevisionItem = {
  subject: string;
  topic: string;
  dueDate?: string;
  addedAt: string;
};

export type StudySession = {
  subject: string;
  topics: string[];
  duration?: string;
  summary?: string;
  at: string;
};

export type StudyState = {
  subjects: SubjectRecord[];
  revisionQueue: RevisionItem[];
  sessions: StudySession[];
};

const EMPTY: StudyState = { subjects: [], revisionQueue: [], sessions: [] };

export function statePath(root: string): string {
  return join(root, ".study-mcp", "study-progress.json");
}

export function loadStudyState(root: string): StudyState {
  const file = statePath(root);
  if (!existsSync(file)) {
    return structuredClone(EMPTY);
  }
  const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<StudyState>;
  return {
    subjects: parsed.subjects ?? [],
    revisionQueue: parsed.revisionQueue ?? [],
    sessions: parsed.sessions ?? [],
  };
}

export function saveStudyState(root: string, state: StudyState): void {
  mkdirSync(join(root, ".study-mcp"), { recursive: true });
  atomicWriteFile(statePath(root), `${JSON.stringify(state, null, 2)}\n`);
}

function subjectRecord(state: StudyState, subject: string): SubjectRecord {
  let record = state.subjects.find((item) => item.subject.toLowerCase() === subject.toLowerCase());
  if (!record) {
    record = { subject, topics: [] };
    state.subjects.push(record);
  }
  return record;
}

export function getStudyProgress(root: string, subject?: string) {
  const state = loadStudyState(root);
  const subjects = subject
    ? state.subjects.filter((item) => item.subject.toLowerCase() === subject.toLowerCase())
    : state.subjects;
  return {
    subjects,
    revisionDue: dueRevision(state, subject),
    recentSessions: state.sessions.slice(0, 10),
  };
}

export function updateTopicStatus(root: string, subject: string, topic: string, status: TopicStatus) {
  if (!TOPIC_STATUSES.includes(status)) {
    throw new KnowledgeError("INVALID_STATUS", `Status must be one of ${TOPIC_STATUSES.join(", ")}`);
  }
  const state = loadStudyState(root);
  const record = subjectRecord(state, subject);
  let item = record.topics.find((entry) => entry.name.toLowerCase() === topic.toLowerCase());
  if (!item) {
    item = { name: topic, status };
    record.topics.push(item);
  }
  item.status = status;
  item.lastStudied = new Date().toISOString().slice(0, 10);
  saveStudyState(root, state);
  return item;
}

export function addRevisionItem(root: string, subject: string, topic: string, dueDate?: string) {
  const state = loadStudyState(root);
  const item: RevisionItem = {
    subject,
    topic,
    dueDate,
    addedAt: new Date().toISOString(),
  };
  state.revisionQueue = state.revisionQueue.filter(
    (entry) => !(entry.subject.toLowerCase() === subject.toLowerCase() && entry.topic.toLowerCase() === topic.toLowerCase()),
  );
  state.revisionQueue.push(item);
  saveStudyState(root, state);
  return item;
}

function dueRevision(state: StudyState, subject?: string, limit = 20): RevisionItem[] {
  const today = new Date().toISOString().slice(0, 10);
  return state.revisionQueue
    .filter((item) => (subject ? item.subject.toLowerCase() === subject.toLowerCase() : true))
    .filter((item) => !item.dueDate || item.dueDate <= today)
    .sort((a, b) => (a.dueDate ?? a.addedAt).localeCompare(b.dueDate ?? b.addedAt))
    .slice(0, limit);
}

export function getRevisionQueue(root: string, subject?: string, limit = 20) {
  return dueRevision(loadStudyState(root), subject, limit);
}

export function recordStudySession(
  root: string,
  input: { subject: string; topics: string[]; duration?: string; summary?: string },
) {
  const state = loadStudyState(root);
  const session: StudySession = {
    ...input,
    at: new Date().toISOString(),
  };
  state.sessions.unshift(session);
  state.sessions = state.sessions.slice(0, 200);
  const record = subjectRecord(state, input.subject);
  for (const topic of input.topics) {
    let item = record.topics.find((entry) => entry.name.toLowerCase() === topic.toLowerCase());
    if (!item) {
      item = { name: topic, status: "learning" };
      record.topics.push(item);
    }
    item.lastStudied = session.at.slice(0, 10);
    if (item.status === "not_started") {
      item.status = "learning";
    }
  }
  saveStudyState(root, state);
  return session;
}
