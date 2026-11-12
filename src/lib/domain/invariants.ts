import type {
  IngestStatus,
  PostStatus,
  RunStatus,
  SourceStatus,
  SourceType,
  UserRole,
} from "@prisma/client";

// @uwe A8 — Invariantes de dominio (restricciones OCL ejecutables).
//
// Cada `check*` devuelve la lista de violaciones encontradas. Los servicios
// pueden usar `assertNoViolations` para convertir esa lista en un error. Las
// constraints de unicidad siguen viviendo en Prisma/SQL; aquí se cubren las
// reglas que dependen del estado y de la coherencia entre campos.
//
// Ver docs/uwe/02-modelo-conceptual/03-restricciones-ocl.md.

export type SourceInvariantInput = {
  name: string;
  type: SourceType;
  status: SourceStatus;
  autopublish: boolean;
  pollIntervalMinutes: number | null;
  consecutiveFailures: number;
};

export type RawItemInvariantInput = {
  externalId: string;
  contentHash: string;
  status: IngestStatus;
  processedAt: Date | null;
  hasSource: boolean;
  postCount: number;
};

export type PostInvariantInput = {
  title: string;
  bodyHtml: string;
  status: PostStatus;
  publishedAt: Date | null;
  views: number;
};

export type CategoryInvariantInput = {
  name: string;
  slug: string;
};

export type UserInvariantInput = {
  email: string;
  passwordHash: string;
  role: UserRole;
};

export type SourceRunInvariantInput = {
  status: RunStatus;
  fetched: number;
  newItems: number;
  duplicates: number;
  durationMs: number | null;
  error: string | null;
};

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const SCRIPT_PATTERN = /<script\b/i;
const JAVASCRIPT_SCHEME_PATTERN = /javascript:/i;

export function checkSourceInvariants(
  source: SourceInvariantInput
): string[] {
  const violations: string[] = [];
  if (source.name.trim().length === 0) {
    violations.push("Source.name no puede estar vacio");
  }
  if (source.type === "WHATSAPP" && source.pollIntervalMinutes != null) {
    violations.push("Source WHATSAPP no debe tener pollIntervalMinutes");
  }
  if (
    source.pollIntervalMinutes != null &&
    source.pollIntervalMinutes <= 0
  ) {
    violations.push("Source.pollIntervalMinutes debe ser mayor que 0");
  }
  if (source.consecutiveFailures < 0) {
    violations.push("Source.consecutiveFailures no puede ser negativo");
  }
  return violations;
}

export function checkRawItemInvariants(item: RawItemInvariantInput): string[] {
  const violations: string[] = [];
  if (item.externalId.trim().length === 0) {
    violations.push("RawItem.externalId no puede estar vacio");
  }
  if (item.contentHash.length !== 64) {
    violations.push("RawItem.contentHash debe ser SHA-256 (64 hex)");
  }
  if (!item.hasSource) {
    violations.push("RawItem debe referenciar una Source");
  }
  if (
    (item.status === "PROCESSED" || item.status === "DISCARDED") &&
    item.processedAt == null
  ) {
    violations.push(
      `RawItem ${item.status} requiere processedAt no nulo`
    );
  }
  if (item.status === "NEW" && item.postCount > 0) {
    violations.push("RawItem NEW no puede tener Post asociado");
  }
  if (item.postCount > 1) {
    violations.push("RawItem no puede producir mas de un Post");
  }
  return violations;
}

export function checkPostInvariants(post: PostInvariantInput): string[] {
  const violations: string[] = [];
  if (post.title.trim().length === 0) {
    violations.push("Post.title no puede estar vacio");
  }
  if (post.status === "PUBLISHED" && post.publishedAt == null) {
    violations.push("Post PUBLISHED requiere publishedAt no nulo");
  }
  if (post.status !== "PUBLISHED" && post.publishedAt != null) {
    violations.push(
      `Post ${post.status} no debe tener publishedAt`
    );
  }
  if (post.views < 0) {
    violations.push("Post.views no puede ser negativo");
  }
  if (SCRIPT_PATTERN.test(post.bodyHtml)) {
    violations.push("Post.bodyHtml no puede contener <script>");
  }
  if (JAVASCRIPT_SCHEME_PATTERN.test(post.bodyHtml)) {
    violations.push("Post.bodyHtml no puede contener javascript:");
  }
  return violations;
}

export function checkCategoryInvariants(
  category: CategoryInvariantInput
): string[] {
  const violations: string[] = [];
  if (category.name.trim().length === 0) {
    violations.push("Category.name no puede estar vacio");
  }
  if (category.slug.trim().length === 0) {
    violations.push("Category.slug no puede estar vacio");
  }
  if (category.slug !== category.slug.toLowerCase()) {
    violations.push("Category.slug debe estar en minusculas");
  }
  return violations;
}

export function checkUserInvariants(user: UserInvariantInput): string[] {
  const violations: string[] = [];
  if (!EMAIL_PATTERN.test(user.email)) {
    violations.push("User.email no tiene formato valido");
  }
  if (!user.passwordHash.startsWith("scrypt:")) {
    violations.push("User.passwordHash debe usar scrypt");
  }
  if (user.role !== "ADMIN" && user.role !== "EDITOR") {
    violations.push("User.role debe ser ADMIN o EDITOR");
  }
  return violations;
}

export function checkSourceRunInvariants(run: SourceRunInvariantInput): string[] {
  const violations: string[] = [];
  if (run.fetched < 0 || run.newItems < 0 || run.duplicates < 0) {
    violations.push("SourceRun: los contadores no pueden ser negativos");
  }
  if (run.durationMs != null && run.durationMs < 0) {
    violations.push("SourceRun.durationMs no puede ser negativo");
  }
  if (run.status === "OK" && run.error != null) {
    violations.push("SourceRun OK no debe tener error");
  }
  return violations;
}

export function assertNoViolations(
  entity: string,
  violations: readonly string[]
): void {
  if (violations.length > 0) {
    throw new Error(`Invariantes de ${entity}: ${violations.join("; ")}`);
  }
}
