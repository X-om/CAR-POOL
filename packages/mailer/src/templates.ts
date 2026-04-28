import fs from "node:fs/promises";
import path from "node:path";
import Handlebars from "handlebars";
import type { EmailTemplateId, EmailTemplateVariables } from "./types";

Handlebars.registerHelper("eq", (a: unknown, b: unknown) => a === b);

export type RenderedEmail = {
  subject: string;
  text: string;
  html: string;
};

function getPackageRootDir(): string {
  // This module lives in `src/` during tsx/dev and in `dist/` after build.
  // In both cases, the package root is one directory up.
  return path.resolve(__dirname, "..");
}

function templateDir(templateId: EmailTemplateId): string {
  return path.join(getPackageRootDir(), "templates", templateId);
}

const templateCache = new Map<string, Handlebars.TemplateDelegate>();

async function loadAndCompile(filePath: string): Promise<Handlebars.TemplateDelegate> {
  const cached = templateCache.get(filePath);
  if (cached) return cached;

  const source = await fs.readFile(filePath, "utf8");
  const compiled = Handlebars.compile(source, { noEscape: false });
  templateCache.set(filePath, compiled);
  return compiled;
}

export async function renderEmail<TTemplateId extends EmailTemplateId>(input: {
  templateId: TTemplateId;
  templateVariables: EmailTemplateVariables[TTemplateId];
}): Promise<RenderedEmail> {
  const dir = templateDir(input.templateId);
  const subjectPath = path.join(dir, "subject.hbs");
  const textPath = path.join(dir, "text.hbs");
  const htmlPath = path.join(dir, "html.hbs");

  const [subjectTpl, textTpl, htmlTpl] = await Promise.all([
    loadAndCompile(subjectPath),
    loadAndCompile(textPath),
    loadAndCompile(htmlPath),
  ]);

  const subject = String(subjectTpl(input.templateVariables)).trim();
  const text = String(textTpl(input.templateVariables)).trim();
  const html = String(htmlTpl(input.templateVariables)).trim();

  return { subject, text, html };
}
