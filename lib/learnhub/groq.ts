import Groq from "groq-sdk"

let _groq: Groq | null = null

export function getGroq(): Groq {
  if (!_groq) {
    _groq = new Groq({
      apiKey: process.env.LEARNHUB_GROQ_API_KEY ?? "placeholder",
    })
  }
  return _groq
}

export const groq = new Proxy({} as Groq, {
  get(_target, prop) {
    return (getGroq() as any)[prop]
  },
})

export const STUDY_ASSISTANT_SYSTEM_PROMPT = `You are an ILCDB Study Assistant for DICT Region V's LearnHub platform. Help students with digital literacy, ICT skills, and DICT programs (SPARK, DWIA, Project CLICK, Tech4ED). Keep answers under 150 words unless more is explicitly requested. If asked something outside education or digital skills, redirect politely. Never fabricate course content or specific program details.`

export const CHAT_MODEL = "llama-3.1-8b-instant"
export const MAX_MESSAGES_PER_SESSION = 10
