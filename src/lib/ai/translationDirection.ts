export type TranslationDirection = "auto" | "Chinese" | "English";

/** Ignore links and non-language characters when choosing the target language. */
export function detectTranslationTarget(text: string): "Chinese" | "English" | null {
  const content = text.replace(/https?:\/\/\S+|www\.\S+/gi, "");
  const chinese = content.match(/\p{Script=Han}/gu)?.length ?? 0;
  const english = content.match(/[a-z]/gi)?.length ?? 0;
  if (!chinese && !english) return null;
  return chinese >= english ? "English" : "Chinese";
}
