export class KnowledgeError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "KnowledgeError";
    this.code = code;
  }
}

export function isKnowledgeError(error: unknown): error is KnowledgeError {
  return error instanceof KnowledgeError;
}
