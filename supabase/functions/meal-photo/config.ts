// The one line to change the model. Cheapest current Flash model that reads images and has a free tier (checked 2026-10-31).
// Override without a redeploy by setting the GEMINI_MODEL secret.
export const MODEL = 'gemini-3.1-flash-lite'

export const CAP = 20 // photos per person per day, reset 5:30 am IST (midnight UTC)
export const MAX_IMAGE_CHARS = 1_500_000 // base64 of a 1024 px JPEG is about 150 to 400 KB
